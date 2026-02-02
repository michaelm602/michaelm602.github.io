/**
 * functions/index.js
 * - Gen 2 HTTPS: createStripeCheckoutSession
 * - Gen 2 Storage: generateImageVariants (full .webp + __thumb.webp)
 *
 * Requirements:
 * - functions/package.json engines.node = "20" (you already did)
 * - deps: firebase-admin, firebase-functions, stripe, sharp, cors (you already have)
 *
 * firebase.json:
 * - REMOVE runtime nodejs18
 * - REMOVE entryPoint (so both functions deploy)
 */

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");

const cors = require("cors");
const Stripe = require("stripe");

const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const sharp = require("sharp");

// ----- Init -----
if (!admin.apps.length) admin.initializeApp();

// Keep everything in one region
setGlobalOptions({ region: "us-central1" });

// ----- CORS -----
// Add any domains you want to allow.
const ALLOWED_ORIGINS = new Set([
    "https://www.likwitblvd.com",
    "http://localhost:5173",
    "http://localhost:4173",
]);

const corsHandler = cors({
    origin: (origin, cb) => {
        // Allow curl/postman/no-origin
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});

// ----- Stripe Secret -----
// Preferred: set via Firebase Functions config (legacy style):
//   firebase functions:config:set stripe.secret="sk_live_..."
// OR use env var in Cloud Functions (advanced):
//   STRIPE_SECRET_KEY
function getStripeSecret() {
    // Try legacy functions config if available
    try {
        // firebase-functions v7 still supports functions.config() via v1 compat,
        // but it’s not guaranteed in every setup.
        // We attempt it safely.
        // eslint-disable-next-line global-require
        const functionsV1 = require("firebase-functions");
        const cfg = functionsV1.config?.();
        const fromConfig = cfg?.stripe?.secret;
        if (fromConfig) return fromConfig;
    } catch (_) {
        // ignore
    }

    // Fallback to env var
    if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;

    return null;
}

const STRIPE_SECRET = getStripeSecret();
const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

// =============================
// 1) STRIPE CHECKOUT (Gen 2)
// =============================
exports.createStripeCheckoutSession = onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                return res.status(204).send("");
            }

            if (req.method !== "POST") {
                return res.status(405).json({ error: "Method not allowed. Use POST." });
            }

            if (!stripe) {
                return res.status(500).json({
                    error:
                        "Stripe is not configured. Set stripe.secret via functions config or STRIPE_SECRET_KEY env var.",
                });
            }

            // Expected payload:
            // {
            //   lineItems: [{ price: "price_...", quantity: 1 }, ...],
            //   successUrl: "https://www.likwitblvd.com/#/success?session_id={CHECKOUT_SESSION_ID}",
            //   cancelUrl: "https://www.likwitblvd.com/#/shop",
            //   mode: "payment" (optional, default payment)
            // }
            const body = req.body || {};
            const lineItems = body.lineItems;
            const successUrl = body.successUrl;
            const cancelUrl = body.cancelUrl;
            const mode = body.mode || "payment";

            if (!Array.isArray(lineItems) || lineItems.length === 0) {
                return res.status(400).json({ error: "Missing lineItems array." });
            }
            if (!successUrl || !cancelUrl) {
                return res.status(400).json({ error: "Missing successUrl/cancelUrl." });
            }

            // Create session
            const session = await stripe.checkout.sessions.create({
                mode,
                line_items: lineItems,
                success_url: successUrl,
                cancel_url: cancelUrl,
                // Optional helpers:
                // allow_promotion_codes: true,
                // automatic_tax: { enabled: true },
            });

            return res.status(200).json({ id: session.id, url: session.url });
        } catch (err) {
            logger.error("Stripe session error:", err);
            return res.status(500).json({
                error: err?.message || "Failed to create Stripe Checkout session",
            });
        }
    });
});

// ===========================================
// 2) AUTO IMAGE VARIANTS (Gen 2 / Storage)
// ===========================================
const FULL_MAX_WIDTH = 1600; // lightbox
const THUMB_MAX_WIDTH = 600; // grid
const WEBP_QUALITY = 78;

function isProcessableImage(contentType, filePath) {
    if (!contentType || !contentType.startsWith("image/")) return false;

    const ext = path.extname(filePath).toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(ext)) return false;

    const base = path.basename(filePath, ext);
    if (base.endsWith("__thumb")) return false;

    // Also skip if someone manually uploads webp
    if (ext === ".webp") return false;

    return true;
}

exports.generateImageVariants = onObjectFinalized(async (event) => {
    const object = event.data;
    const filePath = object.name;
    const contentType = object.contentType;

    if (!filePath) return;

    if (!isProcessableImage(contentType, filePath)) {
        logger.info("Skipping:", { filePath, contentType });
        return;
    }

    const bucket = admin.storage().bucket(object.bucket);

    const dir = path.posix.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);

    const fullWebpPath = path.posix.join(dir, `${baseName}.webp`);
    const thumbWebpPath = path.posix.join(dir, `${baseName}__thumb.webp`);

    // Skip if already exists
    const [fullExists] = await bucket.file(fullWebpPath).exists();
    const [thumbExists] = await bucket.file(thumbWebpPath).exists();
    if (fullExists && thumbExists) {
        logger.info("Variants exist, skipping:", { filePath });
        return;
    }

    const tempOriginal = path.join(os.tmpdir(), path.basename(filePath));
    const tempFull = path.join(os.tmpdir(), `${baseName}.webp`);
    const tempThumb = path.join(os.tmpdir(), `${baseName}__thumb.webp`);

    // Download original
    await bucket.file(filePath).download({ destination: tempOriginal });
    const inputBuffer = await fs.readFile(tempOriginal);

    // Full WebP
    if (!fullExists) {
        await sharp(inputBuffer, { failOn: "none" })
            .rotate()
            .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY, effort: 5 })
            .toFile(tempFull);

        await bucket.upload(tempFull, {
            destination: fullWebpPath,
            metadata: {
                contentType: "image/webp",
                cacheControl: "public,max-age=31536000,immutable",
            },
        });

        logger.info("Uploaded full webp:", { fullWebpPath });
    }

    // Thumb WebP
    if (!thumbExists) {
        await sharp(inputBuffer, { failOn: "none" })
            .rotate()
            .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY, effort: 5 })
            .toFile(tempThumb);

        await bucket.upload(tempThumb, {
            destination: thumbWebpPath,
            metadata: {
                contentType: "image/webp",
                cacheControl: "public,max-age=31536000,immutable",
            },
        });

        logger.info("Uploaded thumb webp:", { thumbWebpPath });
    }

    // Cleanup temp files
    await Promise.allSettled([
        fs.unlink(tempOriginal),
        fs.unlink(tempFull),
        fs.unlink(tempThumb),
    ]);

    logger.info("Done:", { filePath });
});
