# TechStage Autonomy and Media Flow — Fable Handoff

## Product goal

TechStage is a curated media library for prominent technology companies, speakers, and events. The backend is optimized to discover a high volume of relevant long-form recordings, attach the correct entities and labels, create evidence-backed analysis, and publish complete playable pages. The public UI is deliberately unchanged by this work.

## Main flow

```text
Prominent entity staged
  → discovery target created immediately
  → YouTube official/trusted source search
  → public + playable + relevant recording check
  → transcript available?
      → yes: GPT-5 Nano text analysis
      → OpenAI unavailable: Gemini Flash-Lite text fallback
      → no: Gemini Flash-Lite low-resolution video analysis
  → strict result validation
  → entity image check
      → approved image reused
      → otherwise the entity stays in Preparing, awaiting the owner's real image
  → chapters, highlights, evidence, labels, and entity links materialized
  → public-readiness check
  → media page published
```

An existing valid analysis is reused before any new paid request. Canonical YouTube video ID plus entity linkage prevents duplicate analysis and publication.

## Daily campaign controls

The active `entity-backfill-v1` campaign uses two minimums and hard ceilings:

| Control | Value |
|---|---:|
| Completed analyses minimum | 50/day |
| Public-ready media minimum | 50/day |
| Transcript analyses maximum | 100/day |
| Gemini video analyses maximum | 50/day |
| Combined analyses maximum | 150/day |
| YouTube searches | 100/day |
| Transcript spend | $0.50/day, $5 campaign total |
| Gemini video spend | $5/day, $50 campaign total |
| Combined campaign spend | $55 |

The throughput controller runs at 8:00 AM, noon, and 4:00 PM Chicago time. It checks actual completed work, fills missing discovery capacity, and continues beyond 50 toward 150 while qualifying media and allowance remain. Work that reaches a daily cap is scheduled for the next allowance rather than treated as broken.

Only two media jobs run concurrently. Work left in a running state for more than 15 minutes is automatically reclaimed without consuming an extra attempt.

## YouTube discovery

Search top-ups run at 8:00 AM, noon, and 3:30 PM Chicago time. The planner measures the Pacific-time YouTube quota day and creates enough unique entity/query reservations to fill the unused portion of the 100-search allowance. Completed searches plus still-outstanding plans can never exceed 100, so repeated top-ups cannot over-plan the day.

Each search can request up to 50 results. Video details are checked in batches of up to 50 IDs using the separate ordinary YouTube request pool. Every planned search records its purpose, results checked, recordings accepted, and media eventually published.

Priority order:

1. Prominent entities with known trusted sources.
2. Official-source discovery for staged entities.
3. Alternate versions for recordings that could not be played or trusted.
4. Keynote, interview, panel, and event coverage gaps.

Verified and trusted recurring YouTube publishers remain in the daily upload reconciliation and WebSub renewal paths.

## Source trust

Private source records contain `trust_tier`, `publisher_type`, `auto_publish_allowed`, and `verification_confidence`.

| Source | Treatment |
|---|---|
| Verified company, speaker, or event channel | Automatic when relevant and playable |
| Trusted conference, publisher, interviewer, or media channel | Automatic at confidence 0.82+ when long-form and entity-matched |
| Unknown short clip, reaction, compilation, or mismatch | Kept private while a stronger source is sought |

Deterministic checks come first: public status, embedding permission, matching entity name, sensible duration, and reaction/reupload wording. A model decision is only needed for genuine ambiguity.

## Entity expansion and images

`entity-expansion-v1` is a ten-day campaign. The existing 50 companies, 50 speakers, and 50 events are tranche 1. The 7:00 AM automation fills tranches 2–10, deduplicating and refilling each tranche until it contains 50 unique additions per type. The final target is 500 per type and 1,500 total candidates.

Discovery targets are created at staging time, not activation time. A missing image cannot stop media discovery.

When a qualifying media page needs an entity that lacks an image, `ensureEntityPublishable` uses a valid imported asset when one exists. Otherwise, the entity remains in the Preparing area with an awaiting-image status until the owner supplies the real image. TechStage does not create placeholder cards, substitute images, or generated speaker likenesses.

## Providers and cost routing

| Provider | Role | Guard |
|---|---|---|
| YouTube Data API | Search, video validation, upload playlists | 100 search calls/day; ordinary calls separately reserved |
| YouTube WebSub | New-upload notifications | Verified/trusted recurring sources only |
| OpenAI GPT-5 Nano | Transcript analysis | Transcript campaign limits |
| Gemini Flash-Lite | Transcript fallback, video analysis, Stage Notes | Strict per-route reservations and hard dollar caps |
| Parallel | Weekly official event/source checks | 1,000/month |
| Tavily | Weekly gap fallback | 900 credits/month including manual reserve |
| xAI | Small official-X source pilot | $5/month |

Every paid or quota-bound call reserves allowance transactionally before execution, reconciles actual use afterward, and releases failed reservations. Gemini receives a provider-compatible response schema; the returned JSON is still validated against TechStage's full strict rules before persistence.

## Schedules

| Chicago time | Workflow |
|---|---|
| 2:30 AM | YouTube source coverage |
| 3:00 AM | WebSub renewal |
| 4:00 AM | Upload playlist reconciliation |
| 7:00 AM | Ten-day entity expansion |
| 8:00 AM | Throughput controller + YouTube search top-up |
| 9:30 AM | TechStage Daily Automation Report |
| 9:35 AM | TechStage Daily Automation Repair |
| 12:00 PM | Throughput controller + YouTube search top-up |
| 3:30 PM | Final YouTube search top-up |
| 4:00 PM | Final throughput controller |
| Weekly | Event and broader source-gap discovery |

The database dispatcher wakes every five minutes but calls providers only when a due schedule creates a job with available allowance.

## Morning report and repair

The report uses short `/summy` language and leads with public-ready media published. It shows the previous completed day before today's partial progress, including search use, analysis routes, campaign day, costs, imported-image completions, entities awaiting images, and automatic recovery. Owner action is omitted when none is needed.

Five minutes later, GPT-5.6 Sol with medium reasoning checks the report and live backend. It may fix backend code, migrations, Edge Functions, schedules, operational records, analysis flow, images, and publication flow. It cannot change UI, public API shape, newsletter behavior, billing, secrets, hard caps, or data destructively.

The repair task specifically:

- resumes a recording after the owner supplies a corrected link, transcript, or missing input;
- chooses the cheapest transcript-first analysis and publishes once complete;
- completes valid imported images automatically and leaves missing-image entities in Preparing for the owner;
- tops up daily minimums through existing controllers;
- repairs stale work, missed schedules, WebSub, provider-format, campaign-counter, and missed-tranche issues;
- verifies tests, database security, live results, and spending after a fix;
- reverts only its own repair if verification fails, leaving the last working version active.

Every repair writes both `reports/automation-repair/latest.json` and a private `automation_repair_runs` audit record. The private record includes the reporting window, cause, exact repair, changed resources, verification, spending before and after, final status, and any genuine owner action.

## Private data and security

Campaign counters, source trust, search plans, outcome records, and repair audit records are service-only. Row-level protection is enabled, public/authenticated access is revoked, and operational functions are granted only to `service_role`. Secrets remain in Supabase-managed server environments and Vault; none are exposed to the browser.

## Deliberate limits

- A media page still must be relevant, playable, evidence-backed, and completely connected before it is public.
- Unknown short clips and reaction/reupload material are not auto-published.
- Daily minimums trigger more discovery but cannot manufacture 50 qualifying sources when fewer genuinely exist.
- Hard provider and dollar caps always override throughput goals.
- Entities without a valid image intentionally remain in Preparing until the owner supplies one.

## Live verification snapshot

At 2:20 AM Chicago time on July 17, 2026:

- the new Pacific quota day had exactly 100 unique YouTube searches planned, with consumption already in progress;
- 23 public-ready pages had been counted for the still-in-progress Chicago day, including eight publications completed by reusing saved analysis at no additional analysis charge;
- analysis spending was about $0.99, below the $5.50 combined daily ceiling;
- Day 1 contained exactly 50 companies, 50 speakers, and 50 events;
- the worker limit was at or below two and no worker had been stale for 15 minutes;
- no TechStage-generated image asset remained in the live database or storage;
- typecheck and all 41 offline tests passed after the final backend changes.

The first full campaign day is not considered complete until the Chicago day closes. The 9:30 AM report and 9:35 AM repair task continue the live readback automatically; they do not treat a partial morning as a failed daily result.
