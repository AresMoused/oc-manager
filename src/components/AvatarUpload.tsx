"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/apiClient";

interface Props {
  src: string;
  name: string;
  onChange?: (value: string) => void;
  /** Portrait height in px; width is derived as 3:4 (w:h) */
  size?: number;
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
  const [uploading, setUploading] = useState(false);
  const height = size;
  const width = Math.round((size * 3) / 4);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onChange) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const applyUrl = () => {
    if (!onChange) return;
    const v = urlValue.trim();
    if (v) onChange(v);
    setUrlValue("");
    setShowUrlInput(false);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0"
        style={{ width, height }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-xs mt-2">No avatar</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-xs">
            上传中…
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
              disabled={uploading}
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
            只接受图片，最大 10MB。原图直传，不压缩、不转 webp。也可粘贴链接。
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/avif,.png,.jpg,.jpeg,.gif,.webp,.bmp,.avif"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
