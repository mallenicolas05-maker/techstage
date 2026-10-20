import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight, Palette, Pause, Play, Search } from "lucide-react";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { realSpeakerIds } from "@/data/seed/catalogScope";
import { DEMO_NOW } from "@/data/repositories/local";
import { catalogRepo } from "@/data/repositories/local";
import { useAsync } from "@/lib/useAsync";
import { useAppState } from "@/state/AppState";
import { Disclosure, Marquee, Reveal } from "@/components/motion";
import {
  AppearanceCard,
  AppearanceFeatureCard,
  AppearanceSquare,
  Rail,
  SectionHeader,
  SpeakerCard,
  SpeakerChip,
  StandoutMomentCard,
  UpcomingRow,
} from "@/components/media/cards";
import { Modal } from "@/components/ui/primitives";
import { Thumb } from "@/components/ui/Thumb";
import { SaveButton } from "@/components/media/actions";
import { ThemePicker } from "@/components/theme";
import { SummaryShowcase } from "@/components/media/AIBrief";
import { SubscribeCard } from "@/components/newsletter/SubscribeCard";
import { appearanceSlug, appearanceTitle, speakerHeadline, speakerNames } from "@/data/lookup";
import { formatDate, formatRelative, formatTime, formatTimestamp } from "@/lib/format";
import type { Appearance, Clip, StandoutMoment } from "@/domain/types";

const FORMATS = [
  ["panel", "Panels", "Several voices in one audience-led conversation."],
  ["interview", "Interviews", "Focused one-to-one conversations."],
  ["podcast", "Podcasts", "Audio-first long-form conversations."],
  ["technical-talk", "Tech Talks", "Prepared talks, keynotes, lectures, and focused sessions."],
  ["product-launch", "Product Launches", "Public product reveals and release briefings."],
  ["livestream", "Livestreams", "Live online broadcasts and replays."],
] as const;

const FAQS: [string, string][] = [
  ["What does TechStage actually index?", "Public speaking appearances — panels, keynotes, firesides, interviews, launches, lectures, and livestreams — connected to their speakers, companies, events, topics, and searchable transcripts."],
  ["Where do the recordings live?", "With their rights holders. TechStage links out or uses permitted embeds with timestamps; nothing is rehosted, and every page names its original source."],
  ["What's the difference between Free and Premium?", "Free covers the complete discovery index: browsing, search, transcripts, and limited follows, albums, and reminders. Premium unlocks insight briefs, unlimited organization, and transcript tools like copyable AI summary prompts."],
  ["How do reminders work?", "Set a reminder on any upcoming appearance and it appears in your Library. In this demo delivery is in-app; email and push arrive with the production notification service."],
  ["How is content verified?", "Every source moves through an ingestion pipeline with duplicate detection, speaker matching, and a human review queue. Unverified sources are labeled until an editor confirms them."],
  ["Can I request a talk or speaker?", "Soon — a public submission form feeds the same review pipeline. For now, anything on an official channel or event page tends to get discovered automatically."],
];

export default function Home() {
  const db = getSeedDb();
  const { user, persona, progress } = useAppState();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [activeMoment, setActiveMoment] = useState<StandoutMoment | null>(null);
  const [activeUpcoming, setActiveUpcoming] = useState<Appearance | null>(null);

  const localLatest = useMemo(
    () => db.appearances.filter((a) => a.status === "recorded").sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 13),
    [db.appearances]
  );
  const liveLatest = useAsync(() => catalogRepo.latestAppearances(17), []);
  const livePopular = useAsync(() => catalogRepo.trendingAppearances(4), []);
  const liveFormats = useAsync(() => catalogRepo.latestAppearances(17), []);
  const latest = liveLatest.data?.length ? liveLatest.data : localLatest;
  const clips = useMemo(() => [...db.clips].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 10), [db.clips]);
  const moments = useMemo(() => [...db.standoutMoments].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 10), [db.standoutMoments]);
  const upcoming = useMemo(() => db.appearances.filter((a) => ["upcoming", "live", "rescheduled"].includes(a.status)).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)), [db.appearances]);
  const localPopular = useMemo(() => db.appearances.filter((a) => a.status === "recorded").sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 4), [db.appearances]);
  const popular = livePopular.data?.length ? livePopular.data : localPopular;
  const formatAppearances = liveFormats.data?.length ? liveFormats.data : db.appearances;
  const followed = user ? db.speakers.filter((s) => user.followedSpeakerIds.includes(s.id)) : [];
  const suggestions = db.speakers.filter((s) => realSpeakerIds.has(s.id) && !user?.followedSpeakerIds.includes(s.id)).sort((a, b) => b.prominenceScore - a.prominenceScore).slice(0, 8);
  const topics = [...db.topics].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/discover${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return (
    <main className="ts-rails overflow-hidden">
      <section className="ts-paper border-b border-line px-4 pb-8 pt-8 sm:pb-10 sm:pt-11">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-faint"><span className="text-backer">✦ Tech media index</span></p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[1.05] sm:text-6xl">
              <span className="text-backer">{persona === "signed-out" ? "Technology talks, in one charted place." : <>{greeting()}, {user?.name.split(" ")[0]}. <span className="text-[var(--ts-acc)]">See what moved.</span></>}</span>
            </h1>
            <form onSubmit={submitSearch} className="mt-7 flex max-w-3xl border border-ink bg-paper shadow-[6px_6px_0_0_var(--ts-acc-soft)]">
              <Search className="ml-4 mt-4 size-4 shrink-0 text-ink-faint" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, topics, companies, transcripts" className="min-w-0 flex-1 bg-transparent px-3 py-3.5 font-mono text-sm outline-none placeholder:text-ink-faint" />
              <button className="border-l border-ink bg-[var(--ts-acc)] px-5 font-mono text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-[var(--ts-acc-deep)]">Explore</button>
            </form>
            <p className="mt-2 font-mono text-[10px] text-ink-faint">
              <span className="text-backer">
                try:{" "}
                {["Elon Musk", "AI agents", "inference costs"].map((term, i) => (
                  <span key={term}>
                    {i > 0 && ", "}
                    <Link to={`/discover?q=${encodeURIComponent(term)}`} className="link-sweep hover:text-ink">“{term}”</Link>
                  </span>
                ))}
              </span>
            </p>
          </Reveal>

          <div className="mt-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint"><span className="text-backer">Topics</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topics.map((topic) => <Link key={topic.id} to={`/topics/${topic.slug}`} className="border border-[var(--ts-acc)] bg-[var(--ts-acc-15-solid)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">{topic.name}</Link>)}
            </div>
          </div>

          {user && (
            <div className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint"><span className="text-backer">Following</span></p>
              <div className="rail mt-2 gap-2">
                {followed.slice(0, 3).map((speaker) => <SpeakerChip key={speaker.id} s={speaker} />)}
                <Link to="/speakers" className="flex size-10 shrink-0 items-center justify-center border border-[var(--ts-acc)] bg-paper text-[var(--ts-acc-deep)]" aria-label="See all speakers"><ArrowUpRight className="size-4 text-ink-soft" /></Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="relative border-b border-line bg-paper-gray pl-28">
        <button onClick={() => setThemeOpen(true)} className="absolute inset-y-0 left-0 z-10 flex w-28 items-center justify-center gap-2 border-r border-ink/15 bg-paper font-mono text-[10px] uppercase tracking-widest text-ink-soft hover:text-[var(--ts-acc-deep)]"><Palette className="size-3.5 text-ink-soft" /> Theme ↑</button>
        <Marquee rowClassName="gap-10 pr-10 py-2" duration={30}>
          {upcoming.slice(0, 6).map((appearance, index) => <Link key={appearance.id} to={`/a/${appearance.slug}`} className="font-mono text-[11px] uppercase tracking-widest text-ink-soft hover:text-ink"><span className={index % 2 ? "text-[var(--ts-acc2-deep)]" : "text-[var(--ts-acc)]"}>▲</span> {formatRelative(appearance.scheduledStart, DEMO_NOW)} · {appearance.title} · {speakerNames(appearance.speakerIds, 1)}</Link>)}
        </Marquee>
      </div>

      <div className="editorial-column mx-auto max-w-6xl px-4">
        <section className="pt-10">
          <SectionHeader title="Clips" annotate />
          <p className="mt-1 text-sm text-ink-faint">Short video moments. Pick one to start watching.</p>
          <Rail className="card-field mt-4 gap-3 py-3">
            {clips.map((clip) => <button key={clip.id} onClick={() => setActiveClip(clip)} className="group relative w-48 shrink-0 cursor-pointer overflow-hidden border border-line bg-paper text-left hover:border-[var(--ts-acc)]"><Thumb seed={clip.id} label="▶" className="aspect-[9/14] w-full" glyphClassName="text-4xl"><span className="absolute inset-x-3 bottom-3 z-10 border border-ink/20 bg-paper/90 p-3"><span className="line-clamp-3 font-serif text-lg leading-snug">{clip.title}</span><span className="mt-2 block font-mono text-[9px] uppercase tracking-widest text-ink-faint">{speakerNames(clip.speakerIds, 1)} · {formatTimestamp(clip.startTime)}</span></span></Thumb></button>)}
          </Rail>
        </section>

        <section className="pt-12">
          <SectionHeader title="Latest talks" to="/discover" count={latest.length} />
          <div className="card-field mt-4 grid grid-cols-3 gap-2 p-2 sm:hidden">
            {latest.slice(0, 12).map((appearance) => <AppearanceSquare key={appearance.id} a={appearance} />)}
          </div>
          {latest[0] && <Reveal className="card-field mt-4 hidden p-3 sm:block"><AppearanceFeatureCard a={latest[0]} /></Reveal>}
          <div className="card-field mt-4 hidden gap-3 p-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {latest.slice(1).map((appearance) => <AppearanceCard key={appearance.id} a={appearance} className="w-full sm:w-full" />)}
          </div>
        </section>

        {user && progress.length > 0 && (
          <section className="pt-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--ts-acc2-deep)]">Continue watching</p>
            <SectionHeader title="Pick up where you left off" to="/library" />
            <div className="card-field mt-4 grid gap-3 p-3 lg:grid-cols-2">
              {progress.slice(0, 2).map((item) => {
                const appearance = db.appearances.find((row) => row.id === item.appearanceId);
                if (!appearance) return null;
                const speaker = db.speakers.find((row) => appearance.speakerIds.includes(row.id));
                return <Link key={item.appearanceId} to={`/a/${appearance.slug}?t=${item.positionSeconds}`} className="tech-frame group grid min-w-0 grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden border border-line bg-paper sm:grid-cols-[11rem_1fr]"><Thumb seed={appearance.id} label={appearance.title[0]} className="min-h-32 sm:min-h-36" glyphClassName="text-4xl sm:text-5xl"><Play className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2" /></Thumb><span className="flex min-w-0 flex-col p-3 sm:p-5"><span className="line-clamp-2 font-serif text-lg leading-tight sm:text-2xl">{appearance.title}</span><span className="mt-1 line-clamp-2 text-[11px] text-ink-soft sm:mt-2 sm:text-sm">{speaker?.name} · {speaker ? speakerHeadline(speaker.id) : "TechStage recording"}</span><span className="mt-auto pt-3 sm:pt-5"><span className="flex justify-between gap-2 font-mono text-[8px] text-ink-faint sm:text-[10px]"><span>{formatTimestamp(item.positionSeconds)} / {formatTimestamp(item.durationSeconds)}</span><span>{Math.round(item.positionSeconds / item.durationSeconds * 100)}%</span></span><span className="progress-track mt-2 block"><span className="progress-fill block" style={{ width: `${item.positionSeconds / item.durationSeconds * 100}%` }} /></span><span className="mt-2 inline-flex w-fit items-center gap-1 border border-ink/40 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-ink-soft sm:mt-3 sm:px-3 sm:py-1.5 sm:text-[10px]"><Play className="size-3" /> Resume</span></span></span></Link>;
              })}
            </div>
          </section>
        )}

        <section className="pt-12">
          <SectionHeader title="Standout Moments" annotate />
          <p className="mt-1 text-sm text-ink-faint">Words, announcements, and answers worth returning to.</p>
          <Rail className="card-field mt-4 gap-3 py-3">{moments.map((moment) => <StandoutMomentCard key={moment.id} moment={moment} onOpen={setActiveMoment} />)}</Rail>
        </section>

        <WeekCalendar appearances={upcoming} onPreview={setActiveUpcoming} />

        <section className="grid gap-10 pt-12 lg:grid-cols-5">
          <div className="lg:col-span-3"><SectionHeader title="Upcoming" to="/upcoming" /><div className="card-field mt-4 space-y-3 p-3">{upcoming.slice(0, 3).map((appearance) => <UpcomingRow key={appearance.id} a={appearance} />)}</div></div>
          <div className="lg:col-span-2"><SectionHeader title="Popular this week" to="/discover?sort=popularity" /><div className="card-field mt-4 grid gap-3 p-3">{popular.slice(0, 3).map((appearance) => <AppearanceCard key={appearance.id} a={appearance} className="w-full sm:w-full" />)}</div></div>
        </section>

        <section className="pt-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Browse by format</p>
          <h2 className="mt-2 font-serif text-3xl">Find the kind of conversation you want.</h2>
          <div className="mt-7 space-y-10">
            {FORMATS.map(([type, label, note]) => {
              const rows = formatAppearances.filter((appearance) => appearance.appearanceType === type).slice(0, 5);
              if (!rows.length) return null;
              return <div key={type}><div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink/15 pb-2"><div><h3 className="text-xl font-semibold">{label}</h3><p className="mt-1 text-xs text-ink-faint">{note}</p></div><Link to={`/discover?format=${type}`} className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">Explore →</Link></div><Rail className="card-field mt-3 gap-3 py-3">{rows.map((appearance) => <AppearanceCard key={appearance.id} a={appearance} />)}</Rail></div>;
            })}
          </div>
        </section>

        <section className="pt-14"><SectionHeader title={user ? "Because of who you follow" : "Speakers to follow"} to="/speakers" /><Rail className="card-field mt-4 gap-3 py-3">{suggestions.map((speaker) => <SpeakerCard key={speaker.id} s={speaker} />)}</Rail></section>

        <section className="ts-paper mt-16 grid overflow-hidden border border-ink/20 lg:grid-cols-[1.1fr_.9fr]">
          <div className="p-7 sm:p-10"><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ts-acc2-deep)]">About TechStage</p><h2 className="mt-3 max-w-xl font-serif text-4xl leading-tight">Technology’s public conversations should be easier to find.</h2><p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-soft">TechStage connects recordings, speakers, topics, events, and searchable transcripts in one clear index.</p><Link to="/about" className="mt-7 inline-flex items-center gap-2 border border-[var(--ts-acc)] bg-paper px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)]">How it works <ArrowUpRight className="size-3.5 text-ink-soft" /></Link></div>
          <div className="relative min-h-64 overflow-hidden border-t border-ink/15 lg:border-l lg:border-t-0"><img src="/media/techstage-stage.png" alt="Two speakers in conversation before a large audience at a TechStage event" className="absolute inset-0 size-full object-cover grayscale-[25%]" /><div className="absolute inset-0 bg-[var(--ts-acc)]/15 mix-blend-multiply" /></div>
        </section>

        <section className="digest-surface dot-grid mt-8 border-y border-line bg-paper-gray px-5 py-8 sm:px-8 sm:py-10">
          <div className="grid items-start gap-7 lg:grid-cols-[1fr_390px] lg:gap-12">
            <div>
              <p className="digest-meta text-[var(--ts-acc-deep)]">STAGE NOTES · FREE EDITORIAL DIGEST</p>
              <h2 className="mt-3 max-w-2xl font-serif text-3xl leading-tight sm:text-4xl">Four new stages. One clear read on what is changing.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">When four important new appearances arrive, TechStage turns their source material into one cohesive, editor-reviewed report—what was said, what it means, where it lands, and why it matters.</p>
              <Link to="/stage-notes" className="digest-link mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ts-acc-deep)]">Read Stage Notes <ArrowUpRight className="size-3.5" /></Link>
            </div>
            <SubscribeCard source="home-stage-notes" compact />
          </div>
        </section>

        <section className="pt-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ts-acc2-deep)]">The AI Brief</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-serif text-4xl">Watch a talk become a brief.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">Transcript evidence becomes a sourced, shareable dossier—while every step remains visible.</p></div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">No clicks · live product sequence</span>
          </div>
          <div className="mt-7"><SummaryShowcase /></div>
        </section>

        <section id="faq" className="scroll-mt-24 pt-14">
          <SectionHeader title="Frequently asked questions" />
          <div className="mt-4 space-y-3">
            {FAQS.map(([question, answer], index) => (
              <Reveal key={question} delay={index * 60}>
                <Disclosure
                  className="tech-frame tech-frame-always dot-grid border border-dotted border-ink/35 bg-paper px-5 transition-colors"
                  buttonClassName="py-4"
                  iconClassName="text-ink-soft"
                  title={<span className="font-serif text-lg">{question}</span>}
                  panelClassName="pb-5"
                >
                  <p className="font-mono text-sm leading-relaxed text-ink-soft">{answer}</p>
                </Disclosure>
              </Reveal>
            ))}
          </div>
        </section>
      </div>

      {themeOpen && <div className="fixed inset-x-0 bottom-0 top-14 z-50 flex items-end bg-ink/35 sm:top-16" onClick={() => setThemeOpen(false)}><div className="theme-sheet-enter max-h-[78vh] w-full overflow-y-auto border-t border-ink bg-paper p-5 sm:p-7" onClick={(event) => event.stopPropagation()}><div className="mx-auto max-w-6xl"><div className="mb-5 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Theme</p><h2 className="mt-1 font-serif text-3xl">Choose your colorway.</h2></div><button onClick={() => setThemeOpen(false)} className="font-mono text-xs uppercase tracking-widest text-ink-faint">Close ↓</button></div><ThemePicker /></div></div></div>}
      <ClipViewer clip={activeClip} clips={clips} onChange={setActiveClip} onClose={() => setActiveClip(null)} />
      <MomentPreview moment={activeMoment} onClose={() => setActiveMoment(null)} />
      <AppearancePreview appearance={activeUpcoming} onClose={() => setActiveUpcoming(null)} />
    </main>
  );
}

function WeekCalendar({ appearances, onPreview }: { appearances: ReturnType<typeof getSeedDb>["appearances"]; onPreview: (appearance: Appearance) => void }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(DEMO_NOW);
    date.setDate(date.getDate() + index);
    return date;
  });
  return (
    <section className="pt-12">
      <div className="flex items-end justify-between">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--ts-acc2-deep)]">Your local time</p><h2 className="mt-1 text-2xl font-semibold">This week</h2></div>
        <Link to="/upcoming#calendar" className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">Full calendar →</Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-px border border-ink/20 bg-ink/20 sm:grid-cols-7">
        {days.map((day) => {
          const rows = appearances.filter((appearance) => new Date(appearance.scheduledStart).toDateString() === day.toDateString());
          const content = <><span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">{day.toLocaleDateString(undefined, { weekday: "short" })}</span><span className="mt-1 block font-serif text-2xl text-[var(--ts-acc)]">{day.getDate()}</span>{rows[0] && <span className="mt-3 block line-clamp-2 border border-[var(--ts-acc-45)] bg-[var(--ts-acc-15-solid)] p-1.5 font-mono text-[9px] leading-snug text-[var(--ts-acc-deep)]">{rows[0].title}</span>}</>;
          return rows.length ? (
            <button key={day.toISOString()} onClick={() => onPreview(rows[0])} title={`Preview ${rows[0].title}`} className="min-h-28 cursor-pointer bg-paper p-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--ts-acc)]">{content}</button>
          ) : (
            <div key={day.toISOString()} className="min-h-28 bg-paper p-2">{content}</div>
          );
        })}
      </div>
    </section>
  );
}

function AppearancePreview({ appearance, onClose }: { appearance: Appearance | null; onClose: () => void }) {
  if (!appearance) return null;
  return <Modal open onClose={onClose} title="Appearance preview" className="sm:max-w-xl"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc2-deep)]">{formatDate(appearance.scheduledStart)} · {formatTime(appearance.scheduledStart)}</p><h2 className="mt-3 font-serif text-3xl leading-tight">{appearance.title}</h2><p className="mt-3 text-sm leading-relaxed text-ink-soft">{appearance.description}</p><p className="mt-4 font-mono text-[10px] text-ink-faint">{speakerNames(appearance.speakerIds, 3)}</p><Link to={`/a/${appearance.slug}`} className="mt-6 inline-flex items-center gap-2 border border-[var(--ts-acc)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)]">Open full appearance <ArrowUpRight className="size-3.5 text-ink-soft" /></Link></div></Modal>;
}

function ClipViewer({ clip, clips, onChange, onClose }: { clip: Clip | null; clips: Clip[]; onChange: (clip: Clip | null) => void; onClose: () => void }) {
  const [playing, setPlaying] = useState(true);
  useEffect(() => setPlaying(true), [clip?.id]);
  if (!clip) return null;
  const index = clips.findIndex((row) => row.id === clip.id);
  const move = (offset: number) => onChange(clips[(index + offset + clips.length) % clips.length]);
  return <Modal open onClose={onClose} title="Clip viewer" className="sm:max-w-lg"><div className="relative mx-auto max-w-sm border border-ink/20 bg-paper-gray"><Thumb seed={clip.id} label={playing ? "▶" : "Ⅱ"} className="aspect-[9/14] w-full scan-line" glyphClassName="text-6xl"><button onClick={() => setPlaying(!playing)} className="absolute left-1/2 top-1/2 z-20 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-ink bg-paper/90">{playing ? <Pause className="size-5" /> : <Play className="size-5" />}</button><div className="absolute inset-x-4 bottom-4 z-20 bg-paper/90 p-4"><h3 className="font-serif text-2xl leading-tight">{clip.title}</h3><p className="mt-2 font-mono text-[10px] text-ink-faint">{speakerNames(clip.speakerIds, 2)} · starts {formatTimestamp(clip.startTime)}</p><div className="progress-track mt-3"><div className="progress-fill w-2/3" /></div></div></Thumb></div><div className="mt-4 flex items-center justify-between"><button onClick={() => move(-1)} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest"><ChevronLeft className="size-3" /> Previous</button><span className="font-mono text-[10px] text-ink-faint">{index + 1} / {clips.length}</span><button onClick={() => move(1)} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest">Next <ChevronRight className="size-3" /></button></div></Modal>;
}

function MomentPreview({ moment, onClose }: { moment: StandoutMoment | null; onClose: () => void }) {
  if (!moment) return null;
  return <Modal open onClose={onClose} title="Standout moment" className="sm:max-w-2xl"><div className="dot-grid p-6 sm:p-9"><p className="font-serif text-3xl leading-snug">{moment.title}</p><p className="mt-5 text-sm leading-relaxed text-ink-soft">{moment.description}</p><p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-ink-faint">{speakerNames(moment.speakerIds, 2)} · {appearanceTitle(moment.appearanceId)} · {formatTimestamp(moment.startTime)}</p></div><div className="mt-4 flex flex-wrap gap-2"><SaveButton kind="moment" id={moment.id} /><Link to={`/a/${appearanceSlug(moment.appearanceId)}?t=${moment.startTime}`} className="inline-flex items-center gap-2 border border-[var(--ts-acc)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)]">Open recording <ArrowUpRight className="size-3.5 text-ink-soft" /></Link></div></Modal>;
}

function greeting() {
  return "Good evening";
}
