import { Link, useParams } from "react-router-dom";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { realCompanyIds, realSpeakerIds } from "@/data/seed/catalogScope";
import { DEMO_NOW } from "@/data/repositories/local";
import { AppearanceRow, Rail, SectionHeader, SpeakerCard, StandoutMomentCard, TopicPillLink, UpcomingRow } from "@/components/media/cards";
import { FollowButton } from "@/components/media/actions";
import { EmptyState } from "@/components/ui/primitives";
import { EntityImage } from "@/components/ui/EntityImage";
import { companyName, companySlug } from "@/data/lookup";

export default function TopicPage() {
  const { slug } = useParams<{ slug: string }>();
  const db = getSeedDb();
  const topic = db.topics.find((row) => row.slug === slug || row.id === slug);
  if (!topic) return <main className="mx-auto max-w-6xl px-4 pt-10"><EmptyState title="Topic not found" /></main>;
  const appearances = db.appearances.filter((row) => topic.appearanceIds.includes(row.id));
  const upcoming = appearances.filter((row) => new Date(row.scheduledStart) > DEMO_NOW).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const recent = appearances.filter((row) => new Date(row.scheduledStart) <= DEMO_NOW).sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
  const speakers = db.speakers.filter((row) => realSpeakerIds.has(row.id) && topic.speakerIds.includes(row.id)).sort((a, b) => b.prominenceScore - a.prominenceScore).slice(0, 8);
  const moments = db.standoutMoments.filter((row) => row.topicIds.includes(topic.id)).sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 8);
  const related = db.topics.filter((row) => topic.relatedTopicIds.includes(row.id));

  return <main>
    <section className="ts-paper border-b border-line px-4 py-10"><div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1fr_18rem]"><div><p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">Topic index</p><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="font-serif text-5xl sm:text-6xl">{topic.name}</h1><FollowButton kind="topic" id={topic.id} /></div><p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">{topic.description}</p></div><EntityImage entityType="topic" entitySlug={topic.slug} name={topic.name} src={topic.imageUrl} focalX={topic.imageAttribution?.focalX} focalY={topic.imageAttribution?.focalY} eager className="w-full border border-ink/20" /></div></section>
    <div className="mx-auto max-w-6xl px-4">
      <div className="grid gap-10 pt-10 lg:grid-cols-2"><section><SectionHeader title="Key speakers" to="/speakers" /><div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">{speakers.slice(0, 4).map((speaker) => <SpeakerCard key={speaker.id} s={speaker} className="w-full min-w-0" />)}</div></section><section><SectionHeader title="Companies in this topic" /><div className="dot-grid mt-4 grid gap-px border border-dotted border-ink/35">{topic.companyIds.filter((id) => realCompanyIds.has(id)).map((id) => <Link key={id} to={`/companies/${companySlug(id)}`} className="flex items-center justify-between bg-paper/90 px-4 py-4 hover:bg-[var(--ts-acc-15)]"><span className="font-serif text-xl">{companyName(id)}</span><span className="text-[var(--ts-acc-deep)]">↗</span></Link>)}</div></section></div>
      {upcoming.length > 0 && <section className="pt-10"><SectionHeader title="Upcoming" /><div className="mt-4 grid gap-3 lg:grid-cols-2">{upcoming.map((appearance) => <UpcomingRow key={appearance.id} a={appearance} />)}</div></section>}
      <section className="pt-10"><SectionHeader title="Standout Moments" annotate /><Rail className="mt-4 gap-3">{moments.map((moment) => <StandoutMomentCard key={moment.id} moment={moment} />)}</Rail></section>
      <section className="pt-10"><SectionHeader title="Recent appearances" count={recent.length} /><div className="mt-4 grid gap-3 lg:grid-cols-2">{recent.map((appearance) => <AppearanceRow key={appearance.id} a={appearance} />)}</div></section>
      {related.length > 0 && <section className="pt-12"><SectionHeader title="Topics you may also like" /><div className="mt-4 flex flex-wrap gap-2">{related.map((row) => <TopicPillLink key={row.id} topicId={row.id} />)}</div></section>}
    </div>
  </main>;
}
