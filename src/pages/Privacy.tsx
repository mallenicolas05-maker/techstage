import { Link } from "react-router-dom";
import { Reveal } from "@/components/motion";

/* Privacy Policy — demo-appropriate standard policy, styled to
   match About.tsx / Terms.tsx. */

const SECTIONS: [string, string[]][] = [
  [
    "What this policy covers",
    [
      "This policy explains what information TechStage collects, how it is used, and the choices you have. It applies to the web application and, in production, to email and push notifications you opt into.",
      "This deployment is a local demonstration: no account data leaves your browser and no analytics are transmitted.",
    ],
  ],
  [
    "Information we collect",
    [
      "Account information: name, email address, and subscription tier when you register (simulated personas in this demo).",
      "Activity: follows, saves, albums, reminders, viewing progress, and search queries — used to build your library and personalize your feed.",
      "Technical data in production: standard logs (IP address, browser type, pages viewed) used for security and reliability.",
    ],
  ],
  [
    "Local storage in this demo",
    [
      "The demo persists everything client-side in your browser's localStorage: the selected persona, theme, follows, saves, albums, reminders, notification read-state, viewing progress, recent searches, the admin flag, and a simulated Stage Notes subscription. Clearing site data removes all of it. Nothing is sent to a server.",
    ],
  ],
  [
    "Stage Notes email",
    [
      "Stage Notes requires explicit consent and a double opt-in confirmation. Production records the consent time and subscription source, honors pause and unsubscribe requests immediately, and retains suppression status so an unsubscribed or bounced address is not added back accidentally.",
      "Stage Notes launches without tracking pixels or individual open tracking. Only aggregate delivery, bounce, and complaint information supplied by the email provider is used to protect deliverability.",
    ],
  ],
  [
    "How information is used",
    [
      "To operate the service: your library, reminders, notifications, and continue-watching state.",
      "To improve discovery: aggregate, de-identified usage informs ranking and editorial curation.",
      "We do not sell personal information, and we do not use your private library for advertising.",
    ],
  ],
  [
    "Cookies",
    [
      "The production service uses a session cookie for sign-in and a preference cookie for theme and layout. No third-party advertising cookies are used. This demo uses localStorage only.",
    ],
  ],
  [
    "Third-party embeds and links",
    [
      "Recordings play at their original source or through permitted embeds (for example, a video platform's player). Those providers may collect data under their own privacy policies once you interact with the embed — the embed is clearly attributed so you know whose player you are using.",
    ],
  ],
  [
    "Retention",
    [
      "Account data is kept while your account is active and deleted within 30 days of a deletion request. Aggregate statistics that no longer identify you may be retained.",
    ],
  ],
  [
    "Your rights",
    [
      "You can access, correct, export, or delete your data, and object to or restrict certain processing. Requests go to the contact address below and are honored within the timelines required by applicable law (including GDPR and CCPA where they apply).",
    ],
  ],
  [
    "Changes to this policy",
    [
      "If this policy changes materially, we will notify you in-product before the new version takes effect.",
    ],
  ],
  [
    "Contact",
    [
      "Privacy contact details will be published before the public launch.",
    ],
  ],
];

export default function Privacy() {
  return (
    <main>
      <section className="ts-paper border-b border-line px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">
              <span className="text-backer">Legal</span>
            </p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.02] sm:text-6xl">
              <span className="text-backer">Privacy Policy</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft">
              <span className="text-backer">
                Effective July 1, 2026. Short version: your library is yours, we don't sell data,
                and this demo keeps everything in your browser.
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="space-y-10">
          {SECTIONS.map(([title, paragraphs], index) => (
            <Reveal key={title} delay={Math.min(index, 4) * 60}>
              <div className="grid gap-3 sm:grid-cols-[4rem_1fr]">
                <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                  {String(index + 1).padStart(2, "0")} /
                </span>
                <div>
                  <h2 className="font-serif text-2xl">{title}</h2>
                  {paragraphs.map((text) => (
                    <p key={text.slice(0, 24)} className="mt-3 text-sm leading-relaxed text-ink-soft">
                      {text}
                    </p>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 border border-dashed border-[var(--ts-acc-45)] bg-paper px-5 py-4">
          <p className="font-mono text-xs leading-relaxed text-ink-soft">
            See also the{" "}
            <Link to="/terms" className="link-sweep text-[var(--ts-acc-deep)]">
              Terms of Service
            </Link>
            . Public catalog metadata links to official sources; local subscription and account activity remain simulated until the production services are activated.
          </p>
        </div>
      </section>
    </main>
  );
}
