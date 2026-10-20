import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-faint">
        ∅ off the charted sky
      </p>
      <h1 className="mt-3 font-serif text-5xl">404</h1>
      <p className="mt-2 max-w-sm font-mono text-sm text-ink-soft">
        Nothing is indexed at this route. It may have moved, or never existed.
      </p>
      <Link
        to="/"
        className="mt-6 border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase tracking-widest text-paper transition-colors hover:border-[var(--ts-acc)] hover:bg-[var(--ts-acc)]"
      >
        Back to Home
      </Link>
    </main>
  );
}
