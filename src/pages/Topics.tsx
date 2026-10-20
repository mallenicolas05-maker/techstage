import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { catalogRepo } from "@/data/repositories/local";
import { useAsync } from "@/lib/useAsync";
import { FollowButton } from "@/components/media/actions";
import { Skeleton } from "@/components/ui/primitives";
import { EntityImage } from "@/components/ui/EntityImage";

const EXAMPLES = ["robotics", "AI agents", "energy", "open models"];

export default function Topics() {
  const topics = useAsync(() => catalogRepo.listTopics(), []);
  const [query, setQuery] = useState("");
  const [example, setExample] = useState(0);
  useEffect(() => { const handle = window.setInterval(() => setExample((value) => (value + 1) % EXAMPLES.length), 2200); return () => window.clearInterval(handle); }, []);
  const rows = useMemo(() => (topics.data ?? []).filter((topic) => topic.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.trendingScore - a.trendingScore), [topics.data, query]);
  return <main className="mx-auto max-w-6xl px-4">
    <section className="ts-paper -mx-4 border-b border-line px-4 py-10"><div className="mx-auto max-w-6xl"><p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">Ideas in motion</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Topics</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">Start with a field, then follow the people, companies, and conversations shaping it.</p><label className="mt-7 flex max-w-3xl items-center border border-ink bg-paper shadow-[5px_5px_0_0_var(--ts-acc-soft)]"><Search className="ml-4 size-4 text-ink-faint" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${EXAMPLES[example]}…`} className="min-w-0 flex-1 bg-transparent px-3 py-3.5 font-mono text-sm outline-none" /></label></div></section>
    <div className="mt-7 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">{topics.loading && Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-56 sm:h-80" />)}{rows.map((topic) => <article key={topic.id} className="dot-grid group flex min-w-0 flex-col border border-dotted border-ink/40 bg-paper p-2.5 transition-colors hover:border-[var(--ts-acc)] sm:p-4"><Link className="min-w-0" to={`/topics/${topic.slug}`}><EntityImage entityType="topic" entitySlug={topic.slug} name={topic.name} src={topic.imageUrl} focalX={topic.imageAttribution?.focalX} focalY={topic.imageAttribution?.focalY} className="w-full" /><h2 className="mt-3 break-words font-serif text-lg leading-tight sm:mt-5 sm:text-3xl">{topic.name}</h2><p className="mt-2 hidden line-clamp-3 text-sm leading-relaxed text-ink-soft sm:block">{topic.description}</p></Link><div className="mt-auto flex items-center justify-between gap-2 pt-3 sm:pt-5"><span className="font-mono text-[7px] uppercase tracking-wider text-ink-faint sm:text-[9px] sm:tracking-widest">{topic.appearanceIds.length} talks</span><FollowButton kind="topic" id={topic.id} size="sm" /></div></article>)}</div>
  </main>;
}
