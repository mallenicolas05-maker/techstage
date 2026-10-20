import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/* Restrained toast — used mainly for plan-limit nudges. One at a
   time, bottom of the viewport, auto-dismissing. The upgrade link
   is quiet by design (no aggressive upsell). */

interface Toast {
  message: string;
  upgrade?: boolean;
}

const ToastCtx = createContext<(t: Toast) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  const show = useCallback((t: Toast) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-4 transition-all duration-300",
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
        aria-live="polite"
      >
        {toast && (
          <div className="pointer-events-auto flex items-center gap-3 border border-ink bg-ink px-4 py-2.5 text-paper shadow-[5px_5px_0_0_rgba(23,24,28,0.15)]">
            <span className="font-mono text-xs">{toast.message}</span>
            {toast.upgrade && (
              <Link
                to="/subscription"
                onClick={() => setToast(null)}
                className="link-sweep font-mono text-xs uppercase tracking-widest text-azure-soft"
              >
                See Premium →
              </Link>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
