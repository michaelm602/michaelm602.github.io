import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC_DIR = "src/assets/images";
const OUT_DIR = "src/assets/images-webp";

// ---- knobs you can tweak ----
const QUALITY = 78; // good balance for art photos
const HERO_MAX_WIDTH = 1920; // hero/large banners
const GALLERY_MAX_WIDTH = 1400; // tattoos/airbrush/photoshop
const THUMB_MAX_WIDTH = 800; // optional if you ever want thumbs

// folders that should be treated as "hero" images
const HERO_FOLDERS = new Set(["hero-images"]);

// --------------------------------

const exts = ["jpg", "jpeg", "png"];
const patterns = exts.map((e) => `${SRC_DIR}/**/*.${e}`);

function isHero(relativePath) {
    // relativePath like: hero-images/foo.jpg
    const firstFolder = relativePath.split(/[\\/]/)[0];
    return HERO_FOLDERS.has(firstFolder);
}

function pickMaxWidth(relativePath) {
    // tweak rules here if you want finer control later
    if (isHero(relativePath)) return HERO_MAX_WIDTH;

    // if you later add thumbs folder:
    // if (relativePath.includes("thumb")) return THUMB_MAX_WIDTH;

    return GALLERY_MAX_WIDTH;
}

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p) {
    try {
        await fs.stat(p);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    console.log(`🔎 Scanning: ${SRC_DIR}`);
    const files = await fg(patterns, { dot: false });

    if (!files.length) {
        console.log("No images found. Check SRC_DIR path.");
        process.exit(0);
    }

    await ensureDir(OUT_DIR);

    let converted = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
        const relFromSrc = path.relative(SRC_DIR, file); // e.g. tattoos/abc.jpg
        const relNoExt = relFromSrc.replace(/\.[^.]+$/, ""); // tattoos/abc
        const outPath = path.join(OUT_DIR, `${relNoExt}.webp`);

        // skip if output exists and is newer than input
        const outExists = await fileExists(outPath);
        if (outExists) {
            try {
                const [inStat, outStat] = await Promise.all([
                    fs.stat(file),
                    fs.stat(outPath),
                ]);
                if (outStat.mtimeMs >= inStat.mtimeMs) {
                    skipped++;
                    continue;
                }
            } catch {
                // continue to process if stat fails
            }
        }

        const maxWidth = pickMaxWidth(relFromSrc);
        const outDir = path.dirname(outPath);
        await ensureDir(outDir);

        try {
            const img = sharp(file, { failOn: "none" });
            const meta = await img.metadata();

            // If image is already smaller than maxWidth, don't upscale.
            const width = meta.width ?? maxWidth;
            const targetWidth = Math.min(width, maxWidth);

            await img
                .rotate() // respects EXIF orientation
                .resize({ width: targetWidth, withoutEnlargement: true })
                .webp({
                    quality: QUALITY,
                    effort: 5, // good speed/size tradeoff
                })
                .toFile(outPath);

            converted++;
        } catch (err) {
            failed++;
            console.error(`❌ Failed: ${file}`);
            console.error(err?.message || err);
        }
    }

    console.log("\n✅ Done");
    console.log(`Converted: ${converted}`);
    console.log(`Skipped:   ${skipped}`);
    console.log(`Failed:    ${failed}`);
    console.log(`\nOutput folder: ${OUT_DIR}`);
    console.log("Next: update imports to use /images-webp/ paths.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
