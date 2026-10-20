import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderPlus, Play, Plus } from "lucide-react";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { useAppState } from "@/state/AppState";
import { useToast } from "@/components/ui/toast";
import { AppearanceRow, ClipCard, Rail, SectionHeader, SpeakerCard, StandoutMomentCard, TopicPillLink } from "@/components/media/cards";
import { Button, EmptyState, Input, Modal, TabRow } from "@/components/ui/primitives";
import { Thumb } from "@/components/ui/Thumb";
import { appearanceSlug, appearanceTitle, companyName, companySlug, speakerHeadline } from "@/data/lookup";
import { formatDate, formatTimestamp } from "@/lib/format";

const SAVED_TABS = ["Recordings", "Clips", "Standout Moments"] as const;
type SavedTab = (typeof SAVED_TABS)[number];

export default function Library() {
  const db = getSeedDb();
  const state = useAppState();
  const toast = useToast();
  const [savedTab, setSavedTab] = useState<SavedTab>("Recordings");
  const [albumOpen, setAlbumOpen] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");

  if (state.persona === "signed-out") return <main className="mx-auto max-w-6xl px-4 pt-10"><EmptyState title="Your library needs a sign-in" hint="Use the demo control to enter as Jordan or Alex." /></main>;

  const recordings = db.appearances.filter((row) => state.isSaved("appearance", row.id));
  const clips = db.clips.filter((row) => state.isSaved("clip", row.id));
  const moments = db.standoutMoments.filter((row) => state.isSaved("moment", row.id));
  const speakers = db.speakers.filter((row) => state.isFollowing("speaker", row.id));
  const topics = db.topics.filter((row) => state.isFollowing("topic", row.id));
  const companies = db.companies.filter((row) => state.isFollowing("company", row.id));
  const activeReminders = state.reminders.filter((row) => row.status === "scheduled");

  const createAlbum = () => {
    const result = state.createAlbum(albumName.trim(), albumDescription.trim());
    if (!result.ok && result.limitMessage) toast({ message: result.limitMessage, upgrade: true });
    else toast({ message: `Created “${albumName.trim()}”` });
    setAlbumName(""); setAlbumDescription(""); setAlbumOpen(false);
  };

  return <main className="mx-auto max-w-6xl px-4">
    <section className="ts-paper -mx-4 border-b border-line px-4 py-10"><div className="mx-auto max-w-6xl"><p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">{state.user?.name}'s shelf</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Library</h1><p className="mt-3 font-mono text-[10px] text-ink-faint">{state.followCount}/{state.plan?.followLimit ?? "unlimited"} follows · {activeReminders.length}/{state.plan?.reminderLimit ?? "unlimited"} reminders · {state.albums.length}/{state.plan?.collectionLimit ?? "unlimited"} albums</p></div></section>

    <section className="pt-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Organize</p><h2 className="mt-1 font-serif text-3xl">Albums</h2></div><Button onClick={() => setAlbumOpen(true)}><FolderPlus className="size-3.5" /> New album</Button></div>{state.albums.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{state.albums.map((album) => <article key={album.id} className="border border-line bg-paper"><div className="border-b border-ink/10 p-5"><h3 className="font-serif text-2xl">{album.name}</h3><p className="mt-1 text-xs text-ink-faint">{album.description || "A private TechStage album."}</p><p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-ink-faint">{album.appearanceIds.length + album.clipIds.length + (album.momentIds?.length ?? 0)} items · {album.visibility}</p></div><div className="space-y-1 p-3">{album.appearanceIds.slice(0, 3).map((id) => <Link key={id} to={`/a/${appearanceSlug(id)}`} className="flex items-center gap-3 p-2 hover:bg-[var(--ts-acc-15)]"><Thumb seed={id} label={appearanceTitle(id)[0]} className="h-9 w-14" glyphClassName="text-base" /><span className="truncate text-sm">{appearanceTitle(id)}</span></Link>)}{!album.appearanceIds.length && !album.clipIds.length && !(album.momentIds?.length) && <p className="p-3 font-mono text-xs text-ink-faint">This album is ready for its first item.</p>}</div></article>)}</div> : <button onClick={() => setAlbumOpen(true)} className="mt-4 flex min-h-36 w-full cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--ts-acc)] bg-[var(--ts-acc-15)] text-[var(--ts-acc-deep)]"><Plus className="size-5" /><span className="mt-2 font-mono text-[10px] uppercase tracking-widest">Start your first album</span></button>}</section>

    <section className="pt-12"><SectionHeader title="Saved" /><TabRow tabs={SAVED_TABS} active={savedTab} onSelect={setSavedTab} className="mt-4" />
      <div className="mt-4 min-w-0">{savedTab === "Recordings" && (recordings.length ? <div className="grid min-w-0 gap-3 lg:grid-cols-2">{recordings.map((row) => <AppearanceRow key={row.id} a={row} />)}</div> : <EmptyState title="No saved recordings" />)}{savedTab === "Clips" && (clips.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{clips.map((clip) => <ClipCard key={clip.id} clip={clip} className="w-full" />)}</div> : <EmptyState title="No saved clips" />)}{savedTab === "Standout Moments" && (moments.length ? <div className="grid gap-3 lg:grid-cols-2">{moments.map((moment) => <StandoutMomentCard key={moment.id} moment={moment} className="w-full" />)}</div> : <EmptyState title="No saved standout moments" />)}</div>
    </section>

    <section className="pt-12"><SectionHeader title="Following" /><div className="mt-5 space-y-7"><div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Speakers</p><Rail className="mt-3 gap-3">{speakers.map((speaker) => <SpeakerCard key={speaker.id} s={speaker} />)}</Rail></div><div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Topics</p><div className="mt-3 flex flex-wrap gap-2">{topics.map((topic) => <TopicPillLink key={topic.id} topicId={topic.id} />)}</div></div><div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Companies</p><div className="mt-3 flex flex-wrap gap-2">{companies.map((company) => <Link key={company.id} to={`/companies/${companySlug(company.id)}`} className="border border-ink/25 px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:border-[var(--ts-acc)]">{companyName(company.id)}</Link>)}</div></div></div></section>

    <section className="pt-12"><SectionHeader title="Reminders" /><div className="mt-4 grid gap-3 lg:grid-cols-2">{activeReminders.map((reminder) => <div key={reminder.id} className="flex items-center gap-4 border border-line p-4"><span className="min-w-0 flex-1"><Link to={reminder.appearanceId ? `/a/${appearanceSlug(reminder.appearanceId)}` : "/upcoming"} className="block truncate text-sm font-semibold">{reminder.appearanceId ? appearanceTitle(reminder.appearanceId) : "Event reminder"}</Link><span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">{formatDate(reminder.reminderTime)} · {reminder.deliveryChannels.join(" + ")}</span></span><Button size="sm" variant="ghost" onClick={() => state.toggleReminder({ appearanceId: reminder.appearanceId, eventId: reminder.eventId, at: reminder.reminderTime })}>Cancel</Button></div>)}</div></section>

    <section className="pt-12"><SectionHeader title="History" /><div className="mt-4 grid gap-3 lg:grid-cols-2">{state.progress.map((progress) => { const appearance = db.appearances.find((row) => row.id === progress.appearanceId); const speaker = appearance ? db.speakers.find((row) => appearance.speakerIds.includes(row.id)) : null; if (!appearance) return null; return <Link key={progress.appearanceId} to={`/a/${appearance.slug}?t=${progress.positionSeconds}`} className="group grid border border-[var(--ts-acc)] sm:grid-cols-[9rem_1fr]"><Thumb seed={appearance.id} label={appearance.title[0]} className="min-h-32" glyphClassName="text-4xl"><Play className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2" /></Thumb><span className="flex min-w-0 flex-col p-4"><span className="font-serif text-xl">{appearance.title}</span><span className="mt-1 text-xs text-ink-faint">{speaker?.name} · {speaker ? speakerHeadline(speaker.id) : "TechStage recording"}</span><span className="mt-auto pt-4"><span className="flex justify-between font-mono text-[9px] text-ink-faint"><span>{formatTimestamp(progress.positionSeconds)} of {formatTimestamp(progress.durationSeconds)}</span><span>Resume</span></span><span className="progress-track mt-2 block"><span className="progress-fill block" style={{ width: `${progress.positionSeconds / progress.durationSeconds * 100}%` }} /></span></span></span></Link>; })}</div></section>

    <Modal open={albumOpen} onClose={() => setAlbumOpen(false)} title="New album" className="sm:max-w-xl"><p className="text-sm text-ink-soft">Start with a purpose, then mix recordings, clips, and standout moments.</p><div className="mt-4 flex flex-wrap gap-2">{["Research file", "Watch next", "Team briefing", "Favorite ideas"].map((name) => <button key={name} onClick={() => setAlbumName(name)} className="border border-[var(--ts-acc)] bg-[var(--ts-acc-15)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">{name}</button>)}</div><div className="mt-4 space-y-3"><Input value={albumName} onChange={(event) => setAlbumName(event.target.value)} placeholder="Album name" /><Input value={albumDescription} onChange={(event) => setAlbumDescription(event.target.value)} placeholder="Optional note" /></div><div className="mt-5 grid grid-cols-3 gap-px border border-ink/20 bg-ink/20">{SAVED_TABS.map((label) => <div key={label} className="bg-paper p-3 text-center font-mono text-[9px] uppercase tracking-widest text-ink-faint">{label}</div>)}</div><Button className="mt-5 w-full" variant="accent" disabled={!albumName.trim()} onClick={createAlbum}>Create album</Button></Modal>
  </main>;
}
