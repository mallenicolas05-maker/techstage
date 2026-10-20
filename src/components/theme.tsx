import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Cherry,
  Citrus,
  Coffee,
  Droplets,
  Grape,
  IceCreamBowl,
  Leaf,
  Moon,
  Sparkles,
  Trees,
  Waves,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeId =
  | "default"
  | "grape"
  | "lemon-lime"
  | "diet-cola"
  | "forest"
  | "deep-sea"
  | "monochrome"
  | "creamsicle"
  | "espresso"
  | "matcha"
  | "black-cherry"
  | "strawberries-cream";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  note: string;
  Icon: LucideIcon;
  swatches: [string, string, string];
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "default", label: "Default", note: "Azure and fuchsia", Icon: Sparkles, swatches: ["#2b5cff", "#ef2d7f", "#f5f5f6"] },
  { id: "grape", label: "Grape", note: "Violet and lilac", Icon: Grape, swatches: ["#6d3df5", "#bd5cff", "#f4efff"] },
  { id: "lemon-lime", label: "Lemon-Lime", note: "Green and citrus", Icon: Citrus, swatches: ["#168f5b", "#d2a900", "#f3f8e8"] },
  { id: "diet-cola", label: "Diet Cola", note: "Silver and graphite", Icon: Moon, swatches: ["#30343b", "#8e97a4", "#f0f1f3"] },
  { id: "forest", label: "Forest", note: "Pine and moss", Icon: Trees, swatches: ["#135c3d", "#7b8f3b", "#edf3ed"] },
  { id: "deep-sea", label: "Deep Sea", note: "Ocean and sky", Icon: Waves, swatches: ["#075c91", "#1d9ac4", "#edf7fa"] },
  { id: "monochrome", label: "Monochrome", note: "Ink and silver", Icon: Droplets, swatches: ["#17181c", "#72747c", "#f4f4f4"] },
  { id: "creamsicle", label: "Creamsicle", note: "Orange and cream", Icon: IceCreamBowl, swatches: ["#d95b18", "#ef9b47", "#fff3df"] },
  { id: "espresso", label: "Espresso", note: "Coffee and oat", Icon: Coffee, swatches: ["#6a4028", "#b77945", "#f5eee6"] },
  { id: "matcha", label: "Matcha", note: "Sage and cream", Icon: Leaf, swatches: ["#52734d", "#99a66d", "#f3f4e8"] },
  { id: "black-cherry", label: "Black Cherry", note: "Burgundy and charcoal", Icon: Cherry, swatches: ["#781f3b", "#382d35", "#f7edf1"] },
  { id: "strawberries-cream", label: "Strawberries & Cream", note: "Berry and soft pink", Icon: Wine, swatches: ["#cc365d", "#ef7e98", "#fff0f3"] },
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const stored = localStorage.getItem("techstage.theme");
    return THEME_OPTIONS.some((option) => option.id === stored) ? (stored as ThemeId) : "default";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("techstage.theme", theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={cn("grid gap-px border border-ink/20 bg-ink/20", compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {THEME_OPTIONS.map(({ id, label, note, Icon, swatches }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTheme(id)}
          aria-pressed={theme === id}
          className={cn(
            "group flex min-h-20 cursor-pointer items-center gap-3 bg-paper p-3 text-left transition-colors hover:bg-[var(--ts-acc-15)]",
            theme === id && "outline-2 -outline-offset-2 outline-[var(--ts-acc)]"
          )}
        >
          <Icon className="size-4 shrink-0 text-ink-soft" />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-widest">{label}</span>
            <span className="mt-0.5 block text-[10px] text-ink-faint">{note}</span>
            <span className="mt-2 flex gap-1" aria-hidden>
              {swatches.map((swatch) => <i key={swatch} className="size-3 border border-ink/10" style={{ background: swatch }} />)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
