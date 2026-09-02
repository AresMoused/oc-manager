"use client";

export default function ChatMsgBar({
  onEdit,
  onDelete,
  onRegen,
  onRegenImage,
  disabled,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onRegen?: () => void;
  onRegenImage?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex gap-1.5 mt-1 text-[10px] ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {onEdit && (
        <button type="button" className="text-neutral-500 hover:text-neutral-200" onClick={onEdit}>
          改
        </button>
      )}
      {onDelete && (
        <button type="button" className="text-neutral-500 hover:text-rose-300" onClick={onDelete}>
          删
        </button>
      )}
      {onRegen && (
        <button type="button" className="text-neutral-500 hover:text-fuchsia-300" onClick={onRegen}>
          重新生成
        </button>
      )}
      {onRegenImage && (
        <button type="button" className="text-neutral-500 hover:text-sky-300" onClick={onRegenImage}>
          重新生成图片
        </button>
      )}
    </div>
  );
}