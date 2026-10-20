import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { SearchX, Inbox, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/* Polaris-derived primitives: hard corners, mono metadata voice,
   ink/paper surfaces, one steering accent. */

/* ——— Buttons ——— */

type ButtonVariant = "ink" | "accent" | "outline" | "ghost";

export function Button({
  variant = "outline",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 font-mono uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-2.5 py-1.5 text-[10px]" : "px-4 py-2 text-xs",
        variant === "ink" &&
          "border border-[var(--ts-acc)] bg-[var(--ts-acc-15)] text-[var(--ts-acc-deep)] hover:bg-[var(--ts-acc)] hover:text-white",
        variant === "accent" &&
          "border border-[var(--ts-acc)] bg-[var(--ts-acc)] text-white hover:border-[var(--ts-acc-deep)] hover:bg-[var(--ts-acc-deep)]",
        variant === "outline" &&
          "border border-ink/30 text-ink hover:border-[var(--ts-acc)] hover:bg-[var(--ts-acc-15)]",
        variant === "ghost" && "border border-transparent text-ink-soft hover:bg-paper-gray hover:text-ink",
        className
      )}
      {...props}
    />
  );
}

/* ——— Pills / badges ——— */

export function Pill({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "cursor-pointer border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors",
        active
          ? "border-[var(--ts-acc)] bg-[var(--ts-acc-15)] text-[var(--ts-acc-deep)] outline-1 outline-[var(--ts-acc)]"
          : "border-ink/25 text-ink-soft hover:border-ink hover:text-ink",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const badgeTones = {
  neutral: "border-ink/25 text-ink-soft",
  accent: "border-[var(--ts-acc)] text-[var(--ts-acc-deep)] bg-[var(--ts-acc-15)]",
  annotate: "border-fuchsia-hot/50 text-fuchsia-deep bg-fuchsia-wash",
  live: "border-live/50 text-live bg-live-soft",
  warn: "border-warn/50 text-warn bg-warn-soft",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof badgeTones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em]",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ——— Inputs ——— */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full border border-ink/25 bg-paper px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-[var(--ts-acc)]",
        className
      )}
      {...props}
    />
  );
}

/* ——— Tabs ——— */

export function TabRow<T extends string>({
  tabs,
  active,
  onSelect,
  counts,
  className,
}: {
  tabs: readonly T[];
  active: T;
  onSelect: (tab: T) => void;
  counts?: Partial<Record<T, number>>;
  className?: string;
}) {
  return (
    <div className={cn("flex w-fit max-w-full overflow-x-auto rail flex-nowrap gap-px border border-ink/20 bg-ink/20", className)}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onSelect(tab)}
          className={cn(
            "flex shrink-0 cursor-pointer items-baseline gap-2 bg-paper px-3.5 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors sm:px-4",
            active === tab ? "bg-[var(--ts-acc-15)] text-[var(--ts-acc-deep)] outline-1 -outline-offset-1 outline-[var(--ts-acc)]" : "text-ink-soft hover:bg-paper-gray"
          )}
        >
          {tab}
          {counts?.[tab] !== undefined && (
            <span className={active === tab ? "text-[var(--ts-acc-deep)]/70" : "text-ink-faint"}>
              {counts[tab]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ——— Skeletons ——— */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border border-line bg-paper", className)}>
      <Skeleton className="aspect-video w-full" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function RowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 border border-line bg-paper px-5 py-4", className)}>
      <Skeleton className="size-11 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}

/* ——— Empty / error states ——— */

export function EmptyState({
  icon = "inbox",
  title,
  hint,
  action,
  className,
}: {
  icon?: "inbox" | "search";
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = icon === "search" ? SearchX : Inbox;
  return (
    <div
      className={cn(
        "flex flex-col items-center border border-dashed border-ink/25 px-5 py-12 text-center",
        className
      )}
    >
      <Icon className="size-5 text-ink-faint" />
      <p className="mt-3 font-mono text-sm text-ink-soft">{title}</p>
      {hint && <p className="mt-1 font-mono text-xs text-ink-faint">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  detail,
  onRetry,
  className,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center border border-fuchsia-hot/40 bg-fuchsia-wash px-5 py-10 text-center",
        className
      )}
    >
      <TriangleAlert className="size-5 text-fuchsia-deep" />
      <p className="mt-3 font-mono text-sm text-ink">{title}</p>
      {detail && <p className="mt-1 font-mono text-xs text-ink-soft">{detail}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ——— Modal ——— */

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className={cn(
          "dot-grid max-h-[85vh] w-full overflow-y-auto border border-dotted border-ink bg-paper shadow-[7px_7px_0_0_rgba(23,24,28,0.2)] sm:max-w-md",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-dotted border-ink/35 bg-paper/90 px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-soft">
            {title}
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer font-mono text-sm text-ink-faint hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="bg-paper/85 p-5">{children}</div>
      </div>
    </div>
  );
}
