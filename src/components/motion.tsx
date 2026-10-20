import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/* Motion primitives ported from the Polaris design language
   (Design_system_fable — read-only reference). */

/* Fade-up on scroll */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform",
        seen ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}

/* Expandable box whose plus icon rotates into an × */
export function Disclosure({
  title,
  children,
  className,
  buttonClassName,
  panelClassName,
  iconClassName,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  iconClassName?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-4 text-left",
          buttonClassName
        )}
      >
        {title}
        <Plus
          className={cn(
            "size-5 shrink-0 transition-transform duration-300 ease-out",
            open && "rotate-[135deg]",
            iconClassName
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className={panelClassName}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/* Infinite horizontal marquee (duplicated row) */
export function Marquee({
  children,
  className,
  rowClassName,
  duration = 26,
}: {
  children: ReactNode;
  className?: string;
  rowClassName?: string;
  duration?: number;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className="flex w-max animate-ticker"
        style={{ animationDuration: `${duration}s` } as CSSProperties}
      >
        <div className={cn("flex shrink-0 items-center", rowClassName)}>{children}</div>
        <div className={cn("flex shrink-0 items-center", rowClassName)} aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
