import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Generative thumbnail — the shell uses no external imagery.
   Each entity gets a deterministic composition on drafting paper:
   accent scan bars + a large serif glyph, keyed by id hash.
   Production replaces this with real thumbnails from MediaSource. */

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Thumb({
  seed,
  label,
  className,
  children,
  glyphClassName,
}: {
  seed: string;
  /** Big serif glyph(s), usually initials */
  label: string;
  className?: string;
  glyphClassName?: string;
  children?: ReactNode;
}) {
  const h = hash(seed);
  const useAccent2 = h % 5 === 0;
  const bar1 = 18 + (h % 38);
  const bar2 = 30 + ((h >> 3) % 44);
  const bar3 = 12 + ((h >> 6) % 30);
  const accent = useAccent2 ? "var(--ts-acc2)" : "var(--ts-acc)";

  return (
    <div className={cn("thumb", className)}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn("font-serif leading-none text-ink/80 select-none", glyphClassName ?? "text-5xl")}
        >
          {label}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-3" aria-hidden>
        <div className="h-1.5" style={{ width: `${bar1}%`, background: accent, opacity: 0.85 }} />
        <div className="h-1.5" style={{ width: `${bar2}%`, background: "var(--ts-acc-45)" }} />
        <div className="h-1.5 bg-ink/15" style={{ width: `${bar3}%` }} />
      </div>
      {children}
    </div>
  );
}

/* Square avatar for speakers — serif initial on paper-gray, hard corners. */
export function Avatar({
  name,
  seed,
  className,
  glyphClassName,
}: {
  name: string;
  seed: string;
  className?: string;
  glyphClassName?: string;
}) {
  const h = hash(seed);
  const accent = h % 4 === 0 ? "var(--ts-acc2-deep)" : "var(--ts-acc)";
  const initialsText = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-line bg-paper-gray font-serif",
        className ?? "size-11 text-lg"
      )}
      style={{ color: accent }}
    >
      <span className={glyphClassName}>{initialsText}</span>
    </span>
  );
}
