"use client";

import { useState } from "react";
import { GalleryImage } from "@/lib/types";
import SectionHeader from "./SectionHeader";

interface Props {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  editable?: boolean;
}

export default function Gallery({ images, onChange, editable = true }: Props) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const addImage = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onChange([
      ...images,
      {
        id: crypto.randomUUID(),
        url: trimmed,
        caption: caption.trim() || undefined,
      },
    ]);
    setUrl("");
    setCaption("");
    setShowForm(false);
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
            <input
              type="url"
              placeholder="https://cdn.discordapp.com/..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addImage()}
            />
            <input
              type="text"
              placeholder="Caption (optional)"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addImage()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1 text-sm text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={addImage}
                className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 rounded text-white"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {images.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-6">
            No images yet. Click + and paste a Discord CDN URL.
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

      {/* Simple lightbox */}
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
