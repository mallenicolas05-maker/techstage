# TechStage propagation handoff

Run `6266e9b9-990e-4769-aebf-2edcfc7cfd07` is deployed in `techstage-dev` with explicit blockers. The 40-item manifest has 40 unique HTTPS-backed source decisions: 28 appearances are published with evidence-backed artifacts, and 12 are blocked rather than fabricated. Seven four-panel Stage Notes issues are ready for editorial review. No email was sent.

## What is live

- A five-minute, `America/Chicago` dispatcher with at most two concurrently claimed jobs.
- Shared monthly hard caps of `$5` for Gemini and `$5` for xAI, enforced through atomic reservation, reconciliation, release, and monthly reset records.
- Transcript-first analysis using `gemini-3.1-flash-lite`; verified YouTube video is the fallback.
- An xAI/X Search video-understanding pilot, limited by the shared xAI cap and used at runtime only when X itself is authoritative.
- Parallel-first scheduled source-gap tasks, Tavily fallback/cross-check, and official-source/YouTube precedence.
- Twenty-two verified official YouTube channels, all with safe reconciliation cursors and active WebSub leases.
- Daily upload-playlist reconciliation, weekly gap discovery, daily missed-trigger scanning, and two-item rotating recovery for blocked media.
- Four-panel Stage Notes synthesis from validated artifacts only. Delivery remains disabled and the kill switch remains closed.

The frontend remains in local-data mode. No propagation change touched UI layout, styles, components, routes, cards, modals, ticker, navigation, or responsive behavior.

## Backfill result

| Result | Count |
|---|---:|
| Manifest source decisions | 40 |
| Published evidence-backed appearances | 28 |
| Explicit blockers | 12 |
| Successful transcript artifacts | 5 |
| Successful YouTube-video artifacts | 23 |
| Stage Notes issues / panels | 7 / 28 |

Eight manifest items were initially marked transcript-first; three transparently fell back to verified YouTube video because their official pages did not expose an approved transcript. The resulting artifact distribution is therefore 5 transcript and 23 video analyses.

The most effective recovery was official transcript discovery. Parallel-assisted verification recovered Stripe's official AMA transcript, Microsoft's Mumbai transcript PDF, both Microsoft Build transcript DOCX files, the official Stripe/Jony Ive upload, and the official Microsoft Madrid upload. Both Build DOCX files processed successfully after stale idempotent YouTube payloads were replaced.

## Measured cost

| Provider/operation | Successful calls | Actual cost |
|---|---:|---:|
| Gemini transcript analysis | 5 | `$0.027380` |
| Gemini low-resolution YouTube analysis | 23 | `$1.479284` |
| Gemini four-panel Stage Notes | 7 | `$0.012479` |
| xAI X Search/video pilot | 1 | `$0.050000` |
| YouTube / Parallel / Tavily / Resend / Supabase / Cloudflare | — | `$0.000000` |
| **Total** | | **`$1.569136`** |

The Gemini ledger is authoritative at `$1.519136003`; the xAI ledger is `$0.050000000`. Both have `$0` reserved now. The conservative projection for every remaining allowed recovery attempt is `$4.838908003` cumulative Gemini and `$4.888908003` including the completed xAI pilot—below both approved caps. Atomic reservations will stop work before either ledger can cross `$5`.

YouTube used 71 API requests: 34 searches, 35 video-detail validations, and two registry calls. That is approximately 3,437 quota units, below the normal 10,000-unit daily allocation. Tavily used 3 of the 900-credit application ceiling. Parallel plugin request count was not exposed, so the report records one implementation session rather than inventing a count.

Current official pricing references are [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding), and [xAI pricing](https://docs.x.ai/developers/pricing).

## Latency and quality

| Route | Samples | p50 | p95 | Maximum |
|---|---:|---:|---:|---:|
| Official transcript | 5 | 4.864s | 11.655s | 13.298s |
| YouTube video | 23 | 35.440s | 55.480s | 96.716s |

Transcript analysis was materially faster and cheaper, and it was the most reliable route when an official transcript existed. Low-resolution YouTube analysis produced usable timestamps and full-media evidence, but it had much higher latency and encountered provider media-input rejection after a substantial amount of video had already been processed. X was useful for discovery/coverage validation, but its first measured pilot was more expensive than the full set of seven Stage Notes syntheses; it should remain an authoritative-source fallback.

Recommended precedence:

1. Official/authorized transcript.
2. Verified official YouTube upload at low media resolution.
3. Official X post only when X is the original authoritative source.
4. Link-only, blocked record when none of those is legitimate.

## Blockers and remediation

Three items have no approved analyzable source: `wef-2025-how-close-is-powerful-ai`, `ibm-think-2025-enterprise-ai-value`, and `google-io-2026-dialogues-science`. They need an official transcript, official embeddable upload, or manual source approval.

Nine verified YouTube items were rejected by Gemini's media input: NVIDIA CES 2025, NVIDIA GTC 2025, NVIDIA Computex 2025, NVIDIA GTC Paris 2025, AMD Advancing AI 2025, Meta Connect 2025, NVIDIA GTC DC 2025, NVIDIA GTC 2026, and Microsoft AI Tour Sydney 2026. The rotating recovery job retries at most two per day and no more than three times per item, releasing reservations after rejected calls. If they remain blocked, recover an official transcript instead of repeatedly submitting video.

No blocked item has a generated summary, quote, timestamp, or invented replacement embed.

## Ongoing monthly scenarios

Using the observed 28-panel route mix and measured Stage Notes cost:

| Monthly volume | Gemini | Conservative xAI (4 pilot-sized calls) | Total |
|---|---:|---:|---:|
| 100 panels | `$5.425486` | `$0.200000` | `$5.625486` |
| 400 panels | `$21.701943` | `$0.200000` | `$21.901943` |

At the present mix, the existing `$5` Gemini cap will stop processing around 92 panels in a month. Keep that protective behavior until there is explicit approval to raise the cap. More official transcripts will lower cost and latency substantially. The xAI cap can remain `$5`; runtime X calls are now gated on X being authoritative.

## Safety and validation

- Cost-cap contention test passed: a reservation that would cross `$5` was rejected; the test reservation was released and the ledger returned to `$0` reserved.
- Failed Gemini media calls released their reservations and added no actual cost.
- 40/40 manifest slugs are unique; all 40 source URLs use HTTPS.
- 28/28 artifacts retain neither raw input nor raw provider response.
- Resend account inspection found no domain, template, or broadcast. There are zero delivery rows, zero send calls, `delivery_enabled=false`, and `delivery_kill_switch=true`.
- Supabase security advisor reports zero lints. All 44 missing foreign-key indexes reported by the performance advisor were added; remaining performance notices are policy-shape recommendations rather than security defects.
- Offline tests: 37/37 passed. Type checking and production build passed.
- Preserved exactly 19 companies, 28 speakers, 13 events, 15 topics, 75 image assets, 122 variants, and 197 Storage objects.

The machine-readable receipt is [`reports/propagation/6266e9b9-990e-4769-aebf-2edcfc7cfd07.json`](reports/propagation/6266e9b9-990e-4769-aebf-2edcfc7cfd07.json). No secrets are included.
