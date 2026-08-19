"use client";

import { useRef, useState } from "react";
import { GalleryImage } from "@/lib/types";
import { uploadImage } from "@/lib/apiClient";
import SectionHeader from "./SectionHeader";

interface Props {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  editable?: boolean;
}

/** Scale so longest side ≤ maxSide, encode webp (keeps aspect ratio) */
async function compressGalleryWebp(
  file: File,
  maxSide = 1280,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width >= height) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
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
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("WebP encode failed"));
            return;
          }
          resolve(new File([blob], "gallery.webp", { type: "image/webp" }));
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export default function Gallery({ images, onChange, editable = true }: Props) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pushImage = (imageUrl: string) => {
    onChange([
      ...images,
      {
        id: crypto.randomUUID(),
        url: imageUrl,
        caption: caption.trim() || undefined,
      },
    ]);
    setUrl("");
    setCaption("");
    setShowForm(false);
  };

  const addImageFromUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    pushImage(trimmed);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const webp = await compressGalleryWebp(file);
      try {
        const cdnUrl = await uploadImage(webp);
        pushImage(cdnUrl);
      } catch (uploadErr) {
        console.warn("CDN upload failed, using data URL", uploadErr);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(webp);
        });
        pushImage(dataUrl);
      }
    } catch (err) {
      console.error(err);
      alert("图片处理失败，请换一张或改用 URL。");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (id: string) => {
    onChange(images.filter((img) => img.id !== id));
  };

  return (
    <div>
      <SectionHeader
        title="画廊 / Gallery"
        onAdd={editable ? () => setShowForm(true) : undefined}
      />
      <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3">
        {showForm && (
          <div className="mb-3 p-3 bg-[#0a0a0a] border border-purple-800/50 rounded-lg space-y-2">
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              本地上传会压缩为 webp 并保存到 CDN；CDN 链接会写入角色资料（服务器），分享世界后其他人也能看到。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 text-sm rounded-lg border border-sky-800 text-sky-300 hover:bg-sky-950/40 disabled:opacity-40"
              >
                {uploading ? "上传中…" : "上传文件 → CDN"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-neutral-600">
              <span className="flex-1 h-px bg-neutral-800" />
              或粘贴公开图片链接
              <span className="flex-1 h-px bg-neutral-800" />
            </div>
            <input
              type="url"
              placeholder="https://cdn.discordapp.com/..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addImageFromUrl()}
              disabled={uploading}
            />
            <input
              type="text"
              placeholder="Caption (optional)"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addImageFromUrl()}
              disabled={uploading}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1 text-sm text-neutral-400 hover:text-white"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addImageFromUrl}
                disabled={uploading || !url.trim()}
                className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 rounded text-white disabled:opacity-40"
              >
                Add URL
              </button>
            </div>
          </div>
        )}

        {images.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-6">
            暂无图片。点 + 可上传到 CDN，或粘贴公开图片链接。
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative group aspect-square rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption || ""}
                  className="w-full h-full object-cover cursor-pointer"
                  referrerPolicy="no-referrer"
                  onClick={() => setLightbox(img.url)}
                />
                {img.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] text-neutral-300 px-1.5 py-1 truncate">
                    {img.caption}
                  </div>
                )}
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-rose-400 opacity-0 group-hover:opacity-100 transition text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
