"use client";

export default function ChatMsgBar({
  onEdit,
  onDelete,
  onRegen,
  disabled,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onRegen?: () => void;
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
    </div>
  );
}