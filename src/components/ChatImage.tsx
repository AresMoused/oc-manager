"use client";

export default function ChatImage({
  url,
  canSave,
  onSave,
  onPreview,
}: {
  url: string;
  canSave?: boolean;
  onSave?: () => void;
  onPreview?: () => void;
}) {
  return (
    <div className="mb-1">
      <button type="button" className="block" onClick={onPreview} title="预览">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-h-40 rounded-lg object-cover" />
      </button>
      {canSave && onSave && (
        <button type="button" className="mt-1 text-[10px] text-purple-300" onClick={onSave}>
          加入画廊
        </button>
      )}
    </div>
  );
}

export function ImagePreview({
  url,
  canSave,
  onSave,
  onClose,
}: {
  url: string;
  canSave?: boolean;
  onSave?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/80 flex flex-col items-center justify-center p-4" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="max-h-[78vh] max-w-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        {canSave && onSave && (
          <button type="button" className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm" onClick={onSave}>
            加入画廊
          </button>
        )}
        <button type="button" className="px-3 py-1.5 rounded-lg border border-neutral-600 text-neutral-200 text-sm" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}