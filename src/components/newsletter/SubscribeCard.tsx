import { useEffect, useState } from "react";
import { Check, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import {
  getLocalSubscriber,
  setLocalSubscriberStatus,
  subscribeLocally,
  type LocalSubscriber,
} from "@/data/newsletter";
import { cn } from "@/lib/utils";

export function SubscribeCard({
  source,
  compact = false,
  className,
}: {
  source: string;
  compact?: boolean;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [subscriber, setSubscriber] = useState<LocalSubscriber | null>(null);

  useEffect(() => setSubscriber(getLocalSubscriber()), []);

  if (subscriber?.status === "confirmed") {
    return (
      <div className={cn("dot-grid border border-dotted border-[var(--ts-acc)] bg-paper p-4", className)}>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Check className="size-4 text-[var(--ts-acc-deep)]" /> Subscribed to Stage Notes
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">Issues will go to {subscriber.email}.</p>
        <Link to={`/stage-notes/preferences?token=${subscriber.token}`} className="mt-3 inline-block text-xs font-semibold text-[var(--ts-acc-deep)] underline decoration-[1.5px] underline-offset-4">
          Manage subscription
        </Link>
      </div>
    );
  }

  if (subscriber?.status === "pending") {
    return (
      <div className={cn("border border-ink/20 bg-paper p-4", className)}>
        <p className="font-semibold text-ink">Check your inbox.</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Production uses double opt-in. This local preview keeps the confirmation step on-screen.
        </p>
        <button
          type="button"
          onClick={() => setSubscriber(setLocalSubscriberStatus("confirmed"))}
          className="mt-3 cursor-pointer bg-ink px-4 py-2 text-xs font-semibold text-paper transition-colors hover:bg-[var(--ts-acc-deep)]"
        >
          Confirm local subscription
        </button>
      </div>
    );
  }

  return (
    <form
      className={cn(compact ? "max-w-sm" : "border border-ink/20 bg-paper p-5 sm:p-6", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!email.trim() || !consent) return;
        setSubscriber(subscribeLocally(email, source));
        setEmail("");
      }}
    >
      {!compact && (
        <>
          <p className="digest-meta text-[var(--ts-acc-deep)]">STAGE NOTES — FREE</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-ink">What the stage is telling us.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            One source-grounded report whenever four important new panels land—or sooner when the week should not wait.
          </p>
        </>
      )}
      <div className={cn("flex border border-ink/25 bg-paper", compact ? "mt-4" : "mt-5")}>
        <Mail className="ml-3 mt-2.5 size-4 shrink-0 text-ink-faint" aria-hidden />
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          placeholder="you@example.com"
          aria-label="Email for Stage Notes"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={!consent}
          className="cursor-pointer border-l border-ink/25 px-4 text-xs font-semibold text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          Subscribe
        </button>
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-ink-faint">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 accent-[var(--ts-acc)]"
        />
        <span>
          I agree to receive Stage Notes and accept the <Link to="/privacy" className="text-ink underline underline-offset-2">privacy policy</Link>. Unsubscribe anytime.
        </span>
      </label>
    </form>
  );
}
