import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Search, Sparkles, Users } from "lucide-react";
import { Reveal } from "@/components/motion";
import { DemoReel } from "@/components/media/AIBrief";

const steps = [
  { Icon: Search, label: "Find the source", body: "TechStage connects public recordings from events, companies, universities, podcasts, and livestreams." },
  { Icon: Users, label: "Connect the people", body: "Every recording links back to its speakers, companies, events, and the topics they discuss." },
  { Icon: Sparkles, label: "Make it useful", body: "Search the transcript, save a moment, follow a speaker, or prepare a prompt for your preferred AI assistant." },
];

export default function About() {
  return (
    <main>
      <section className="ts-paper border-b border-line px-4 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">About TechStage</p>
            <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[1.02] sm:text-7xl">The stage is public. The index should be too.</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft">Technology leaders explain what they are building across thousands of scattered recordings. TechStage gives those conversations one searchable home.</p>
            <div className="mt-8 flex flex-wrap gap-2"><Link to="/discover" className="inline-flex items-center gap-2 border border-[var(--ts-acc)] bg-[var(--ts-acc)] px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-white">Explore the index <ArrowUpRight className="size-3.5" /></Link><Link to="/upcoming" className="inline-flex items-center gap-2 border border-ink/30 bg-paper px-4 py-2.5 font-mono text-xs uppercase tracking-widest"><CalendarDays className="size-3.5" /> See what is next</Link></div>
          </Reveal>
          <div className="relative min-h-[24rem] overflow-hidden border border-ink/20"><img src="/media/techstage-stage.png" alt="Two speakers in conversation before a large audience at a TechStage event" className="absolute inset-0 size-full object-cover grayscale-[20%]" /><div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" /><div className="absolute bottom-7 left-7 right-7 border border-white/40 bg-ink/55 p-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white backdrop-blur-sm">Speakers ↗ recordings ↗ transcripts ↗ ideas</div></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">How it works</p>
        <div className="mt-7 grid gap-px border border-ink/20 bg-ink/20 lg:grid-cols-3">
          {steps.map(({ Icon, label, body }, index) => <Reveal key={label} delay={index * 90} className="bg-paper p-7"><span className="flex size-10 items-center justify-center border border-[var(--ts-acc)] bg-[var(--ts-acc-15)] text-ink-soft"><Icon className="size-4" /></span><h2 className="mt-8 font-serif text-3xl">{label}</h2><p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p></Reveal>)}
        </div>
      </section>

      <section className="border-y border-ink/15 bg-paper-gray px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">Product demos</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-4xl">See the index at work.</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">Short, focused walkthroughs of the workflows that turn public talks into useful research.</p></div><span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">Recorded in product</span></div>
          <div className="dot-grid mt-7 grid gap-3 p-3 sm:grid-cols-2">
            <DemoReel title="The AI Brief" note="A transcript becomes a sourced, paged dossier." />
            <DemoReel title="Discover" note="Search people, claims, topics, and transcript moments together." />
            <DemoReel title="Calendar" note="Move from this week to the full event calendar." />
            <DemoReel title="Library" note="Save talks, clips, moments, and private research albums." />
          </div>
        </div>
      </section>

      <section className="border-y border-ink/15 bg-paper-gray px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ts-acc2-deep)]">What stays honest</p><h2 className="mt-3 font-serif text-4xl">The original source remains the source.</h2></div>
          <div className="space-y-5 text-sm leading-relaxed text-ink-soft"><p>TechStage indexes public information and links back to the original recording. Rights stay with their holders.</p><p>Transcript prompts and insight previews in this demo are local simulations. Nothing is presented as a live AI service or a production notification system.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center"><h2 className="font-serif text-4xl">Start with a person, a topic, or a question.</h2><Link to="/discover" className="mt-7 inline-flex items-center gap-2 border border-[var(--ts-acc)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)]">Open Discover <ArrowUpRight className="size-3.5 text-ink-soft" /></Link></section>
    </main>
  );
}
