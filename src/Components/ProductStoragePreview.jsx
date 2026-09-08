import { useEffect, useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";

export default function ProductStoragePreview({ image, alt = "" }) {
  const [url, setUrl] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    const paths = [image?.thumbnailPath, image?.storagePath].filter(Boolean);
    setUrl("");
    setMissing(false);

    const resolve = async () => {
      for (const path of paths) {
        try {
          const nextUrl = await getDownloadURL(ref(storage, path));
          if (active) setUrl(nextUrl);
          return;
        } catch (error) {
          if (error?.code !== "storage/object-not-found") {
            if (active) setMissing(true);
            return;
          }
        }
      }
      if (active && paths.length) setMissing(true);
    };

    if (paths.length) resolve();
    return () => {
      active = false;
    };
  }, [image?.storagePath, image?.thumbnailPath]);

  if (url) {
    return (
      <img
        src={url}
        alt={alt || image?.alt || "Product artwork"}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#151515] px-3 text-center text-xs text-white/40">
      {missing ? "Preview unavailable" : image?.storagePath ? "Loading preview…" : "No image path"}
    </div>
  );
}
