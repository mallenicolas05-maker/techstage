import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StageNotesMasthead } from "@/components/newsletter/StageNotesMasthead";
import { getLocalSubscriber, setLocalSubscriberStatus, type LocalSubscriber } from "@/data/newsletter";

export default function NotePreferences() {
  const [params] = useSearchParams();
  const [subscriber, setSubscriber] = useState<LocalSubscriber | null>(null);
  useEffect(() => setSubscriber(getLocalSubscriber()), []);
  const valid = subscriber && params.get("token") === subscriber.token;

  return (
    <main className="digest-surface min-h-[70vh] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-[696px]">
        <StageNotesMasthead />
        <section className="mt-12 border-t border-line pt-8">
          <p className="digest-meta text-[var(--ts-acc-deep)]">SUBSCRIPTION PREFERENCES</p>
          {!valid ? (
            <>
              <h1 className="mt-4 text-[length:var(--digest-issue-title)] font-bold leading-[var(--digest-issue-title-lh)]">This preference link is not available.</h1>
              <p className="mt-4 text-base leading-relaxed text-ink-soft">Use the link generated after confirming a local Stage Notes subscription.</p>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-[length:var(--digest-issue-title)] font-bold leading-[var(--digest-issue-title-lh)]">Manage Stage Notes</h1>
              <p className="mt-3 text-base text-ink-soft">{subscriber.email} · {subscriber.status}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {subscriber.status !== "confirmed" && <button onClick={() => setSubscriber(setLocalSubscriberStatus("confirmed"))} className="cursor-pointer bg-ink px-4 py-2 text-sm font-semibold text-paper">Resume</button>}
                {subscriber.status === "confirmed" && <button onClick={() => setSubscriber(setLocalSubscriberStatus("paused"))} className="cursor-pointer border border-ink px-4 py-2 text-sm font-semibold">Pause</button>}
                {subscriber.status !== "unsubscribed" && <button onClick={() => setSubscriber(setLocalSubscriberStatus("unsubscribed"))} className="cursor-pointer border border-ink/25 px-4 py-2 text-sm text-ink-soft">Unsubscribe</button>}
              </div>
            </>
          )}
          <Link to="/stage-notes" className="mt-10 inline-block text-sm font-semibold text-[var(--ts-acc-deep)] underline underline-offset-4">Back to Stage Notes</Link>
        </section>
      </div>
    </main>
  );
}
