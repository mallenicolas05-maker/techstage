import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { useAppState } from "@/state/AppState";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const COMPARISON: { label: string; free: string | boolean; premium: string | boolean }[] = [
  { label: "Browse the full discovery index", free: true, premium: true },
  { label: "Recordings, clips, and standout moments", free: true, premium: true },
  { label: "Follows", free: "Up to 5", premium: "Unlimited" },
  { label: "Albums", free: "1", premium: "Unlimited" },
  { label: "Active reminders", free: "1", premium: "Unlimited" },
  { label: "What you can take away", free: false, premium: true },
  { label: "Copyable AI summary prompts", free: false, premium: true },
  { label: "Advanced transcript tools", free: false, premium: true },
];

export default function Subscription() {
  const { persona, setPersona, isPro } = useAppState();
  const [annual, setAnnual] = useState(true);
  return <main className="mx-auto max-w-6xl px-4">
    <section className="ts-paper -mx-4 border-b border-line px-4 py-12 text-center"><p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">Membership</p><h1 className="mt-3 font-serif text-5xl">Choose how deep you go.</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">Discovery stays useful for everyone. Premium adds transcript-linked intelligence and unlimited organization.</p><div className="mt-7 inline-flex border border-[var(--ts-acc2)] bg-paper">{[[false, "Monthly"], [true, "Annual"]].map(([value, label]) => <button key={String(label)} onClick={() => setAnnual(Boolean(value))} className={cn("px-5 py-2 font-mono text-[10px] uppercase tracking-widest", annual === value ? "bg-[var(--ts-mark-b)] text-[var(--ts-acc2-deep)] outline-1 outline-[var(--ts-acc2)]" : "text-ink-faint")}>{label}</button>)}</div>{annual && <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc2-deep)]">Save 40% with annual billing</p>}</section>

    <div className="mt-8 grid gap-px border border-ink/20 bg-ink/20 lg:grid-cols-2"><article className="flex min-h-[27rem] flex-col bg-paper p-8"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Free</p><p className="mt-4 font-serif text-6xl">$0</p><p className="mt-3 text-sm text-ink-soft">The complete public discovery index.</p><ul className="mt-8 space-y-3 text-sm text-ink-soft"><li>Recordings, clips, and standout moments</li><li>Five follows</li><li>One album and one active reminder</li><li>Searchable transcripts</li></ul><div className="mt-auto pt-8">{persona === "free" ? <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">Current plan</span> : <Button onClick={() => setPersona("free")}>{persona === "signed-out" ? "Start free" : "Switch to Free"}</Button>}</div></article><article className="relative flex min-h-[27rem] flex-col bg-[var(--ts-acc)] p-8 text-white"><span className="absolute right-6 top-6 border border-white/50 bg-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-white">Premium</span><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/70">Go deeper</p><p className="mt-4 font-serif text-6xl">${annual ? 12 : 20}<span className="font-sans text-sm"> / month</span></p>{annual && <p className="mt-2 text-xs text-white/70">$144 billed annually</p>}<p className="mt-3 text-sm text-white/85">The complete intelligence and organization layer.</p><ul className="mt-8 space-y-3 text-sm text-white/90"><li>Unlimited follows, albums, and reminders</li><li>Full TechStage insight briefs</li><li>Copyable transcript summary prompts</li><li>Advanced transcript and relation tools</li></ul><div className="mt-auto pt-8">{isPro ? <span className="font-mono text-[10px] uppercase tracking-widest text-white/70">Current plan ✓</span> : <button onClick={() => setPersona("pro")} className="border border-white bg-white px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)]">Upgrade to Premium</button>}</div></article></div>

    <section className="mx-auto mt-14 max-w-5xl"><h2 className="text-center font-serif text-4xl">Side by side</h2><div className="mt-6 overflow-x-auto border border-ink/20"><table className="w-full min-w-[38rem] border-collapse"><thead><tr className="border-b border-ink/20 bg-paper-gray font-mono text-[10px] uppercase tracking-widest text-ink-faint"><th className="p-4 text-left">Capability</th><th className="p-4 text-left">Free</th><th className="bg-[var(--ts-acc-15)] p-4 text-left text-[var(--ts-acc-deep)]">Premium</th></tr></thead><tbody>{COMPARISON.map((row) => <tr key={row.label} className="border-b border-ink/10"><td className="p-4 text-sm">{row.label}</td><td className="p-4 font-mono text-xs"><Cell value={row.free} /></td><td className="bg-[var(--ts-acc-15)] p-4 font-mono text-xs"><Cell value={row.premium} premium /></td></tr>)}</tbody></table></div><p className="mt-4 text-center font-mono text-[9px] text-ink-faint">Payments are not connected in this local demo. Switching plans changes the demo persona only.</p></section>
  </main>;
}

function Cell({ value }: { value: string | boolean; premium?: boolean }) { if (value === true) return <Check className={cn("size-4", "text-ink-soft")} />; if (value === false) return <Minus className="size-4 text-ink-faint" />; return <>{value}</>; }
