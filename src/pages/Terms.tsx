import { Link } from "react-router-dom";
import { Reveal } from "@/components/motion";

/* Terms of Service — demo-appropriate standard terms, styled to
   match About.tsx (ts-paper hero, serif sections, mono numbering). */

const SECTIONS: [string, string[]][] = [
  [
    "Acceptance of these terms",
    [
      "By accessing TechStage you agree to these Terms of Service and to our Privacy Policy. If you do not agree, do not use the service.",
      "This deployment is a product demonstration populated with fictional content; the terms below describe how the production service is intended to operate.",
    ],
  ],
  [
    "The service",
    [
      "TechStage is a discovery index for public technology talks: panels, keynotes, firesides, interviews, product launches, lectures, and livestreams. We organize public information — titles, speakers, events, topics, timestamps, and transcripts — and link to original recordings.",
      "TechStage does not host recordings. Playback happens at the original source or through embeds explicitly permitted by the rights holder.",
    ],
  ],
  [
    "Accounts",
    [
      "You are responsible for activity under your account and for keeping your credentials secure. You must provide accurate information and be legally able to enter this agreement.",
      "In this demo, accounts are simulated personas stored locally in your browser; no real registration occurs.",
    ],
  ],
  [
    "Content and intellectual property",
    [
      "Recordings, trademarks, and event materials belong to their respective rights holders. Indexing metadata, transcripts prepared by TechStage, and the design of the service are our intellectual property or licensed to us.",
      "Rights holders may request corrections or removal of indexed material at any time through the contact address below; verified requests are honored promptly.",
    ],
  ],
  [
    "Acceptable use",
    [
      "You may not scrape the service at abusive rates, circumvent access controls, misrepresent your affiliation, upload unlawful material, or use the service to infringe the rights of speakers, events, or publishers.",
      "Automated access for personal, non-commercial research is permitted within published rate limits.",
    ],
  ],
  [
    "Subscriptions and billing",
    [
      "Premium features are offered as a paid subscription. Prices are shown before purchase; subscriptions renew automatically until cancelled and can be cancelled at any time, effective at the end of the current billing period.",
      "No payment is collected in this demonstration; the upgrade flow only switches a local demo persona.",
    ],
  ],
  [
    "Disclaimers",
    [
      "The service is provided “as is” without warranties of any kind. Summaries, insight briefs, and AI-prepared prompts are informational aids derived from transcripts — they may contain errors and are not professional, financial, or legal advice.",
      "We do not guarantee the availability, accuracy, or completeness of third-party recordings we link to.",
    ],
  ],
  [
    "Limitation of liability",
    [
      "To the maximum extent permitted by law, TechStage is not liable for indirect, incidental, or consequential damages arising from use of the service. Our aggregate liability is limited to the amounts you paid for the service in the twelve months preceding the claim.",
    ],
  ],
  [
    "Termination",
    [
      "You may stop using the service at any time. We may suspend or terminate access for violations of these terms, and rights holders' removal requests may make some content unavailable.",
    ],
  ],
  [
    "Changes to these terms",
    [
      "We may update these terms as the service evolves. Material changes are announced in-product with reasonable notice; continued use after the effective date constitutes acceptance.",
    ],
  ],
  [
    "Contact",
    [
      "Legal contact details will be published before the public launch.",
    ],
  ],
];

export default function Terms() {
  return (
    <main>
      <section className="ts-paper border-b border-line px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">
              <span className="text-backer">Legal</span>
            </p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.02] sm:text-6xl">
              <span className="text-backer">Terms of Service</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft">
              <span className="text-backer">
                Effective July 1, 2026. This deployment is a demonstration with fictional content;
                these terms describe the intended production service.
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
            <Link to="/privacy" className="link-sweep text-[var(--ts-acc-deep)]">
              Privacy Policy
            </Link>
            . All names, companies, events, and quotes on TechStage are fictional demonstration
            data.
          </p>
        </div>
      </section>
    </main>
  );
}
