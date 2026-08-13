"use client";

interface Props {
  value: number; // 0-5
  onChange?: (v: number) => void;
  max?: number;
  readonly?: boolean;
}

export default function DotRating({
  value,
  onChange,
  max = 5,
  readonly = false,
}: Props) {
  return (
    <div className="dot-rating">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`dot ${i < value ? "active" : ""}`}
          onClick={() => {
            if (!readonly && onChange) {
              onChange(i + 1 === value ? i : i + 1);
            }
          }}
        />
      ))}
    </div>
  );
}
