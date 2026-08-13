"use client";

import { useRef, useState } from "react";

interface Props {
  src: string;
  name: string;
  onChange?: (value: string) => void; // can be URL or compressed base64
  /** Portrait height in px; width is derived as 3:4 (w:h) */
  size?: number;
}

/** Compress an image file to a small JPEG data URL (max 400px, quality 0.7) */
async function compressImage(
  file: File,
  maxSize = 400,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export default function AvatarUpload({
  src,
  name,
  onChange,
  size = 200,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [compressing, setCompressing] = useState(false);
  // 3:4 portrait — size is height
  const height = size;
  const width = Math.round((size * 3) / 4);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onChange) return;
    setCompressing(true);
    try {
      const compressed = await compressImage(file, 400, 0.7);
      onChange(compressed);
    } catch (err) {
      console.error(err);
      alert("Failed to process image. Try a smaller file or use a URL instead.");
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  };

  const applyUrl = () => {
    if (!onChange) return;
    const trimmed = urlValue.trim();
    if (trimmed) {
      onChange(trimmed);
      setShowUrlInput(false);
      setUrlValue("");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative group rounded-lg overflow-hidden bg-[#1a1a1a] border border-neutral-800"
        style={{ width, height, aspectRatio: "3 / 4" }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-xs mt-2">No avatar</span>
          </div>
        )}

        {compressing && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-xs">
            Compressing…
          </div>
        )}
      </div>

      {onChange && (
        <div
          className="flex flex-col gap-1.5 w-full"
          style={{ maxWidth: Math.max(width, 180) }}
        >
          <div className="flex gap-1 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
              disabled={compressing}
            >
              Upload file
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput((v) => !v)}
              className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
            >
              Use URL
            </button>
            {src && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-rose-900/50 rounded text-neutral-400 hover:text-rose-300"
              >
                Clear
              </button>
            )}
          </div>

          {showUrlInput && (
            <div className="flex gap-1">
              <input
                type="url"
                placeholder="https://cdn.discordapp.com/..."
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[11px] outline-none focus:border-purple-500 text-neutral-200"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyUrl()}
              />
              <button
                type="button"
                onClick={applyUrl}
                className="px-2 py-1 text-[11px] bg-purple-600 hover:bg-purple-500 rounded text-white"
              >
                OK
              </button>
            </div>
          )}

          <p className="text-[10px] text-neutral-500 text-center leading-tight">
            Prefer URL (Discord / Imgur). Local files are auto-compressed.
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
