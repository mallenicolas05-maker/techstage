# TECHSTAGE — Codex Handoff

This document hands the TECHSTAGE product shell to the next development phase. It describes what
was built, how it is structured, what is real versus mocked, and a concrete, ordered plan to turn
the shell into a production MVP. You should be able to continue from here without reverse-engineering
anything.

> **Working name.** "TECHSTAGE" is a temporary brand. The wordmark lives only in
> `src/components/shell/AppShell.tsx` (`<Wordmark>`); nothing else depends on the name.

> **Design system.** The visual language is **Polaris**, ported from the read-only reference project
> `Design_system_fable` and adapted from SaaS dashboards into an editorial media experience. The
> original project was **not modified** — see §10.

---

## 1. What was built

### Routes / pages (all clickable, all in `src/pages/`)

| Route | Page | Notes |
| --- | --- | --- |
| `/` | `Home` | Feed-first. Distinct composition for signed-out / free / pro. Feature card, rails, continue-watching, upcoming ticker, followed-speaker shortcuts, suggestions. |
| `/discover` | `Discover` | Universal search (URL `?q=`), persistent desktop filter column + mobile filter sheet, sort, result tabs (All/Talks/Clips/Transcripts), entity shortcut chips, transcript-phrase hits. Loading / zero-result / **error** (`?q=crash`) / suggested-query states. |
| `/upcoming` | `Upcoming` | Chronological month-grouped feed **and** a month-grid calendar view. |
| `/speakers` | `Speakers` | Directory; sort by prominence / recently-active / A–Z / following; expertise + company filters. |
| `/speakers/:slug` | `SpeakerProfile` | Structured media profile: identity + stats, upcoming, best clips, appearances, topic distribution, role-history timeline, related speakers. |
| `/a/:slug` | `AppearanceDetail` | **The central screen.** Rights-aware media placeholder, mock scrubber + sticky mini-controls, overview, chapters, searchable transcript with seek + highlight, key clips, source metadata, related graph, premium insight brief with locked/unlocked states. |
| `/events/:slug` | `EventPage` | Organizer, schedule of sessions, recordings, upcoming sessions, clips, speakers, reminders. |
| `/topics` | `Topics` | Trending-ranked topic grid. |
| `/topics/:slug` | `TopicPage` | Description, upcoming/recent appearances, trending clips, key speakers, companies, related topics. |
| `/companies/:slug` | `CompanyPage` | Info, upcoming, product launches, recent appearances, speakers, topic distribution, related companies. |
| `/library` | `Library` | Saved talks, saved clips, collections (create + add), following, reminders (cancel), viewing history. |
| `/notifications` | `Notifications` | Read-state feed with per-type icons; mark-all-read; deep links. |
| `/subscription` | `Subscription` | Free vs Pro comparison, seed-driven pricing, monthly/annual toggle, comparison table. |
| `/profile` | `Profile` | Account, plan usage, preferences + notification settings (read-only in shell), sign-out (demo). |
| `/admin` | `Admin` | Internal ingestion & editorial workflow (see below). |
| `*` | `NotFound` | 404. |

### Desktop vs mobile

Responsive from one React app (Polaris is responsive by construction). The **app shell**
(`src/components/shell/AppShell.tsx`) provides:

- **Desktop:** top bar with primary nav (Home / Discover / Upcoming / Speakers / Topics / Library),
  search trigger, notifications with unread badge, profile/sign-in.
- **Mobile:** collapsed top bar + a **bottom tab bar** (Home / Discover / Upcoming / Library /
  Profile) with safe-area padding; filters become a bottom sheet in Discover; rails scroll-snap
  horizontally; sticky media mini-controls. Mobile compositions are intentional (stacked identity
  blocks, wrapped pill groups, date-block upcoming rows), not shrunk desktop layouts.

> **Native mobile:** the spec calls for React Native/Expo. This shell delivers the responsive-web
> surface and the **shared domain + validation + tokens** intended to back a native app. A native
> Expo app is **not** included — see §7 and §4.

### Reusable components / Polaris patterns ported or recreated

- **Tokens & textures** (`src/index.css`): paper/ink palette, azure + fuchsia accents, drafting-paper
  background (`.ts-paper`), dot grid, dashed seams, highlighter marks (`.mark-a/.mark-b`), sweep
  underlines, hard offset-shadow hover, plus media extensions (generative `.thumb`, watch-progress
  bars, `.locked-veil`, skeleton pulse, scroll-snap `.rail`, transcript `.segment-active`, safe-area).
- **Motion primitives** (`src/components/motion.tsx`): `Reveal`, `Disclosure`, `Marquee` (ported).
- **UI primitives** (`src/components/ui/primitives.tsx`): `Button`, `Pill`, `Badge`, `Input`,
  `TabRow`, `Skeleton`/`CardSkeleton`/`RowSkeleton`, `EmptyState`, `ErrorState`, `Modal`.
- **Generative imagery** (`src/components/ui/Thumb.tsx`): `Thumb` + `Avatar` — deterministic
  hash-keyed compositions so the shell needs **no external images** (CSP-safe, offline).
- **Media card family** (`src/components/media/cards.tsx`): feature card, standard card, compact
  row, clip card, speaker card + chip, upcoming row (date block + actions), topic pill, section
  header, rail. Deliberately several card shapes.
- **Insight modules** (`src/components/media/insights.tsx`): threshold filtering, locked veil +
  teasers, honest pipeline-state messaging, evidence with provenance labels.
- **Interaction buttons** (`src/components/media/actions.tsx`): follow, save, reminder, add-to-collection.
- **Toast** (`src/components/ui/toast.tsx`): restrained plan-limit nudges.
- **Search overlay** (`src/components/shell/SearchOverlay.tsx`): grouped results, recent searches.

### Implemented interactions

Search (overlay + Discover), filters, sorting, follow/unfollow, save/unsave, collection create +
add-to, reminder create/cancel, **free ↔ pro persona toggle**, locked→unlocked insight transition,
tabs, transcript search + segment seek, chapter/clip/timestamp navigation, sticky playback with mock
progress persisted to viewing history, responsive nav, notification read-state, loading/empty/error
states, admin status changes and brief approval on local data, continue-watching.

### Free vs Pro demonstration states

Persona switch (demo bar) changes: homepage composition, follow/collection/reminder **limits** (free
is capped, with a quiet upgrade toast), and insight briefs (free sees the **locked veil** with
count-based teasers; pro sees the full brief with evidence). Signed-out gates Library / Notifications
/ Profile behind sign-in prompts.

### Admin / ingestion workflow (`/admin`)

19-stage pipeline legend; candidates filtered by status (All / needs-review / processing / failed /
published); a detail panel with source URL, entity-match results, stage-progress dots, a processing
log, and **insight-brief review** (approve `needs-review` → published). Status transitions and brief
approval **mutate the in-memory seed for the session** (reset on reload).

### Seed-data coverage

25 speakers, 12 companies, 10 events, 40 appearances, 62 clips, 15 topics, 8 upcoming appearances,
11 transcripts (10 complete + 1 mid-processing), 12 insight briefs, 2 users (free + pro), 4
collections, 10 notifications, 3 reminders, viewing progress for both users, 10 ingestion candidates.
Demonstrated edge states: multi-speaker panels; one speaker across many events; a product launch
(Loom) linked to older talks; missing / expected / processing / removed recordings; a transcript
still transcribing; talks with only 2 applicable insight categories; a brief with **no applicable
insights** (nothing fabricated); a stored insight **below the display threshold** (filtered out);
cancelled and rescheduled appearances; unverified sources; the full spread of rights statuses;
related-signal cross-links.

---

## 2. Project structure

```
sv-tech-CEO-panel-discovery/
  index.html                    # entry HTML (Google Fonts: Inter, Newsreader, IBM Plex Mono)
  vite.config.ts                # Vite + React + Tailwind v4; "@/" -> ./src
  tsconfig*.json                # strict TS, project references
  package.json                  # deps + scripts
  .claude/launch.json           # dev-server config for the preview tool (autoPort)
  README.md
  CODEX_HANDOFF.md              # this file
  src/
    main.tsx                    # React root
    App.tsx                     # providers + <BrowserRouter> route table  ← ENTRY POINT
    index.css                   # Polaris tokens + textures (design-token location)
    vite-env.d.ts
    domain/
      types.ts                  # all entity types (framework-free, shareable)
      validation.ts             # zod schemas mirroring types.ts
      insightCategories.ts      # 17-category registry + ENRICHMENT_CONFIG thresholds
    data/
      seed/                     # authored seed data (one file per entity group)
        index.ts                # assembles + derives graph edges + zod-validates → getSeedDb()
        topics/companies/speakers/events/appearances/clips/transcripts/insights/users/ingestion.ts
      repositories/
        contracts.ts            # ALL repository + adapter interfaces (the seam)
        local.ts                # local seed implementation (catalogRepo, userRepo, ingestion, enrichment)
      adapters/
        search.ts               # in-memory inverted index incl. transcript segments
        services.ts             # auth / subscription / media / transcript / notification / analytics (mocked)
      lookup.ts                 # synchronous display-name lookups for card rendering
    state/
      AppState.tsx              # session context: persona, follows, saves, collections, reminders,
                                #   notifications read-state, viewing progress; localStorage-persisted
    lib/
      utils.ts                  # cn()
      format.ts                 # date/time/duration/relative/initials helpers
      useAsync.ts               # loading→data|error fetch hook with stale-guard + reload
    components/
      motion.tsx                # Reveal / Disclosure / Marquee (ported Polaris)
      ui/                       # primitives.tsx, toast.tsx, Thumb.tsx
      media/                    # cards.tsx, actions.tsx, insights.tsx
      shell/                    # AppShell.tsx, SearchOverlay.tsx
    pages/                      # one file per route (see §1)
```

- **Application entry:** `src/main.tsx` → `src/App.tsx` (providers + routes).
- **State management:** React Context (`AppState`) + local component state + the `useAsync` hook.
  No Redux/Zustand; deliberately light so Codex can swap in server state (e.g. TanStack Query)
  behind the repositories.
- **Styling:** Tailwind v4 (`@tailwindcss/vite`), tokens in `src/index.css` `@theme`. Hard corners
  throughout; accents driven by `--ts-acc` / `--ts-acc2` CSS variables.
- **Admin-specific:** `src/pages/Admin.tsx` + `src/data/seed/ingestion.ts` (+ `ingestionAdapter` /
  `enrichmentAdapter` in `local.ts`).

---

## 3. Domain & data architecture

### Core entities (`src/domain/types.ts`)

`User`, `Speaker`, `Company`, `Event`, **`Appearance`** (the central object), `MediaSource`,
`Transcript` (+ `TranscriptSegment`), `Chapter`, `Clip`, `Topic`, `InsightBrief`, `Insight`
(+ `InsightEvidence`), `Collection`, `Reminder`, `AppNotification`, `ViewingProgress`, plus
ingestion types (`IngestionCandidate`, `StageState`, `IngestionLogEntry`) and `PlanConfig`.

An **Appearance** connects speakers + event + companies + date + sources/recording + transcript +
chapters + clips + topics + related appearances + an optional insight brief. It is the hub of a
connected graph (people ↔ companies ↔ events ↔ topics ↔ appearances ↔ clips).

### Relationships & derivation

Appearances are the **authored source of truth for edges**. `src/data/seed/index.ts`:

1. attaches clips / chapters / transcripts / briefs to appearances by `appearanceId`;
2. derives all reverse links (speaker→appearances/upcoming, event→speakers, topic→companies, etc.);
3. makes related-appearance links symmetric;
4. **validates the whole graph with zod** and caches it (`getSeedDb()`).

This guarantees the graph can't drift out of sync, and validation catches seed typos at boot.

### Validation

`src/domain/validation.ts` holds zod schemas mirroring the types. Used at seed-boot today; reuse
them at the API/adapter boundary in production to validate responses.

### Local repository behavior

`src/data/repositories/local.ts` implements the contracts over `getSeedDb()`, adds a small
simulated latency (so skeletons are real), and resolves ids **or** slugs. `DEMO_NOW` is exported as
the fixed demo clock (`2026-07-10`) — replace with `new Date()` in production. Admin adapters mutate
the in-memory graph for the session.

### Interfaces designed for production replacement

Everything in `src/data/repositories/contracts.ts`: `CatalogRepository`, `UserRepository`,
`SearchAdapter`, `IngestionAdapter`, `EnrichmentAdapter`, `AuthAdapter`, `SubscriptionAdapter`,
`MediaAdapter`, `TranscriptAdapter`, `NotificationAdapter`, `AnalyticsAdapter`. UI imports the
concrete instances from `local.ts` / `adapters/*` today; point those exports at HTTP/Supabase
implementations and the UI is unchanged.

---

## 4. Production work remaining (checklist)

- [ ] **Database** — Postgres schema from `domain/types.ts`; junction tables for the many-to-many
      edges currently derived in seed (`appearance_speakers`, `appearance_topics`, …).
- [ ] **Migrations** — author + run (Supabase migrations or Drizzle/Prisma).
- [ ] **Auth** — replace `AuthAdapter`; wire real sessions; gate Library/Notifications/Profile.
- [ ] **User persistence** — move `AppState` mutations (follows, saves, collections, reminders,
      viewing progress, notification read-state) from localStorage to the DB via a write API.
- [ ] **Subscriptions / Stripe** — replace `SubscriptionAdapter` with entitlement checks; retire the
      persona toggle as the entitlement source (keep it as an internal QA affordance if useful).
- [ ] **YouTube ingestion** — YouTube Data API adapter feeding `IngestionCandidate`s.
- [ ] **External-source ingestion** — RSS, podcast feeds, conference/company/university pages,
      event platforms, livestream announcements, manual submissions (contracts exist; sources don't).
- [ ] **Transcript acquisition + transcription** — official captions first, ASR fallback
      (`TranscriptAdapter.requestTranscription`).
- [ ] **Speaker diarization** — populate `TranscriptSegment.speakerId`.
- [ ] **AI enrichment** — run the 17-category applicability pass **once at ingestion**, store
      results, publish only those that clear `ENRICHMENT_CONFIG` (applicable + confidence ≥ 0.65 +
      has evidence). Never regenerate per viewer.
- [ ] **Background jobs / queue** — the 19-stage pipeline as durable workers with retry.
- [ ] **Search indexing** — replace `SearchAdapter` with Typesense/Meilisearch/Algolia +
      pgvector for transcript semantics.
- [ ] **Notifications / reminders / email / push** — replace `NotificationAdapter`; scheduled
      delivery; email provider; mobile push.
- [ ] **Analytics** — replace `AnalyticsAdapter` with a real provider.
- [ ] **Media-rights handling** — enforce `rightsStatus`/`embedAllowed` server-side; takedown +
      correction workflows.
- [ ] **Admin permissions** — real roles behind `/admin`.
- [ ] **Native mobile** — Expo app consuming the shared `domain` + `validation` + tokens.
- [ ] **Deployment / testing / monitoring / logging** — CI, e2e + unit tests, observability.

---

## 5. External integration map

| Integration | Purpose | Provider | Interface in shell | Source file | Env vars | MVP? |
| --- | --- | --- | --- | --- | --- | --- |
| Auth | Sessions, identity | Supabase Auth | `AuthAdapter` | `data/adapters/services.ts` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Yes |
| Database | Persistence | Supabase Postgres | `CatalogRepository`, `UserRepository` | `data/repositories/contracts.ts` | `DATABASE_URL` | Yes |
| Subscriptions | Entitlements | Stripe | `SubscriptionAdapter` | `data/adapters/services.ts` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Yes |
| Search | Discovery | Typesense / Meilisearch / Algolia (+ pgvector) | `SearchAdapter` | `data/adapters/search.ts` | `SEARCH_URL`, `SEARCH_API_KEY` | Yes |
| YouTube ingest | Source discovery + metadata | YouTube Data API | `IngestionAdapter` | `data/repositories/contracts.ts` | `YOUTUBE_API_KEY` | Yes |
| Transcription | ASR fallback | Deepgram / AssemblyAI / Whisper | `TranscriptAdapter` | `data/adapters/services.ts` | `ASR_API_KEY` | Yes |
| Enrichment | Insight briefs | Anthropic Claude | `EnrichmentAdapter` | `data/repositories/contracts.ts` | `ANTHROPIC_API_KEY` | Yes |
| Media embeds | Rights-aware playback | YouTube/Vimeo embeds | `MediaAdapter` | `data/adapters/services.ts` | — | Yes |
| Notifications | Alerts | email (Resend/Postmark) + push (Expo/FCM/APNs) | `NotificationAdapter` | `data/adapters/services.ts` | `EMAIL_API_KEY`, push creds | Defer |
| Analytics | Product metrics | PostHog / Segment | `AnalyticsAdapter` | `data/adapters/services.ts` | `ANALYTICS_KEY` | Defer |
| Other ingest | RSS/podcast/conf/uni/social | various | `IngestionAdapter` | `data/repositories/contracts.ts` | per-source | Defer |

**Expected shapes:** request/response shapes mirror the entities in `domain/types.ts`. Repository
methods already define the exact return types Codex must satisfy; validate incoming payloads with
`domain/validation.ts`.

---

## 6. Mock → production replacement guide

| Simulated system | Where | Replace with |
| --- | --- | --- |
| Local seed repository | `data/repositories/local.ts` | Postgres/Supabase-backed `CatalogRepository` + `UserRepository` (same contracts) |
| Mock authentication | `AuthAdapter` in `adapters/services.ts` | Supabase Auth session |
| Paid-user persona toggle | `state/AppState.tsx` + demo bar | Stripe-backed entitlement via `SubscriptionAdapter` |
| Local in-memory search | `data/adapters/search.ts` | Production search service + vector index |
| Seed notifications, in-app reminders | seed + `NotificationAdapter` | Scheduled email/push delivery |
| Static transcripts | `data/seed/transcripts.ts` | Ingestion + transcription pipeline |
| Mock insight briefs | `data/seed/insights.ts` | Stored LLM enrichment jobs (once at ingestion) |
| Local reminders | `AppState` (localStorage) | Persistent scheduled-notification system |
| Static viewing history / progress | `AppState` (localStorage) | Persisted user-activity events |
| In-memory admin mutations | `ingestionAdapter`/`enrichmentAdapter` in `local.ts` | Pipeline service endpoints + editorial DB writes |
| Generative thumbnails | `components/ui/Thumb.tsx` | Real thumbnails from `MediaSource.thumbnailUrl` |
| `DEMO_NOW` fixed clock | `data/repositories/local.ts` | `new Date()` |
| Mock media embed resolver | `MediaAdapter` | Rights-checked embed resolution server-side |

---

## 7. Known limitations & unfinished work

- **Everything behind the adapters is mocked.** No network calls; no persistence beyond
  `localStorage`. Nothing here is production-ready.
- **No native mobile app.** The responsive web surface + shared domain stand in for it; an Expo app
  is future work. Native concerns (push, deep links, native share, safe areas beyond CSS) are not
  implemented.
- **Mock player.** The media box is a placeholder with a simulated scrubber/progress; no real video.
- **Auth is a persona switch**, not real identity; route gating is cosmetic.
- **Admin mutations are per-session** (in-memory) and reset on reload.
- **Preferences & notification settings on Profile are read-only.**
- **Pricing** is seed config (`data/seed/users.ts` → `seedPlans`), intentionally not a business
  decision.
- **Bundle size**: single ~594 KB JS chunk (no route code-splitting yet) — add `React.lazy` per route.
- **Accessibility**: keyboard/ARIA covered on primitives, modals, and the search overlay, but not
  audited end-to-end (focus traps, transcript virtualization, color-contrast on faint mono text
  should be reviewed).
- **Performance**: long transcripts render all segments (no virtualization); seed graph is derived
  eagerly at boot.
- **Design decisions to validate later**: generative thumbnails vs real imagery; the exact insight
  category set; locked-veil aggressiveness.

No feature here should be described as production-ready; all integrations are simulated.

---

## 8. Setup instructions

```bash
# install
npm install

# run the web app (dev)
npm run dev            # http://localhost:5173 (auto-picks a free port; this repo used 5174)

# type-check only
npm run typecheck

# production build (type-check + bundle) and preview
npm run build
npm run preview
```

- **Inspect seed data:** `src/data/seed/*.ts` (authored) → assembled + validated in
  `src/data/seed/index.ts` (`getSeedDb()`).
- **Switch free ↔ pro:** the floating **demo bar** (bottom center) — Signed out / Free / Pro.
- **Admin workflow:** demo bar → **Admin**, or visit `/admin`.
- **Future env vars:** see §5. Add a `.env` and read via `import.meta.env` in the new adapters
  (keep secrets server-side; the browser only gets public keys).
- **Run the mobile app:** not present yet — scaffold an Expo app that imports the shared `domain`.
- **Run tests:** none yet — see §9 step 14.
- **Key files to start from:** `domain/types.ts`, `data/repositories/contracts.ts`,
  `data/repositories/local.ts`, `data/seed/index.ts`.

---

## 9. Recommended Codex execution order

1. **Validate & stabilize the shell** — `npm run build`, click every route, both personas, admin.
2. **Review architecture / trim abstractions** — confirm the adapter seam fits your backend.
3. **DB schemas & migrations** — from `domain/types.ts`; add junction tables.
4. **Replace local repositories** with persistent adapters (same contracts).
5. **Auth + user persistence** — real sessions; move `AppState` writes to the API.
6. **Source ingestion** — YouTube first, then the rest.
7. **Transcript acquisition & processing** — captions → ASR → diarization → segmentation.
8. **Stored AI enrichment** — once-at-ingestion; honor thresholds; store, don't regenerate.
9. **Production search** — swap `SearchAdapter`; add vector search for transcripts.
10. **Subscriptions & entitlement enforcement** — Stripe; retire the persona-as-entitlement.
11. **Reminders, alerts, notifications** — scheduled email/push.
12. **Native mobile integrations** — Expo app on the shared domain.
13. **Admin permissions & review controls** — real roles.
14. **Automated tests** — unit (repos/adapters/enrichment thresholds) + e2e (the vertical slices).
15. **Observability & deployment** — logging, monitoring, CI/CD.

---

## 10. File-change report

### Files created (all under `/sv-tech-CEO-panel-discovery`)

**Config / root:** `package.json`, `package-lock.json` (via `npm install`), `vite.config.ts`,
`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `.claude/launch.json`,
`README.md`, `CODEX_HANDOFF.md`.

**Domain:** `src/domain/types.ts`, `src/domain/validation.ts`, `src/domain/insightCategories.ts`.

**Seed data:** `src/data/seed/{index,topics,companies,speakers,events,appearances,clips,transcripts,insights,users,ingestion}.ts`.

**Data layer:** `src/data/repositories/{contracts,local}.ts`, `src/data/adapters/{search,services}.ts`,
`src/data/lookup.ts`.

**State / lib:** `src/state/AppState.tsx`, `src/lib/{utils,format,useAsync}.ts`.

**Components:** `src/components/motion.tsx`, `src/components/ui/{primitives,toast,Thumb}.tsx`,
`src/components/media/{cards,actions,insights}.tsx`,
`src/components/shell/{AppShell,SearchOverlay}.tsx`.

**Pages:** `src/pages/{Home,Discover,Upcoming,Speakers,SpeakerProfile,AppearanceDetail,EventPage,Topics,TopicPage,CompanyPage,Library,Notifications,Subscription,Profile,Admin,NotFound}.tsx`.

**App bootstrap:** `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`.

### Files modified

None outside `/sv-tech-CEO-panel-discovery` — this is a brand-new project directory.

### Dependencies added

`react`, `react-dom`, `react-router-dom`, `clsx`, `tailwind-merge`, `lucide-react`, `zod`;
dev: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `typescript`,
`@types/node`, `@types/react`, `@types/react-dom`. (Mirrors the Polaris reference stack + `zod`
for validation.)

### Major implementation decisions

- **Adapter seam** (`repositories/contracts.ts`) is the single boundary between UI and data; the UI
  never imports seed or providers directly.
- **Appearances own the graph edges**; all reverse links are derived + zod-validated at seed boot.
- **Insights are precomputed and threshold-filtered** in the data, not per render; the UI honors
  `ENRICHMENT_CONFIG` and never fabricates categories.
- **No external images/assets** — generative `Thumb`/`Avatar` keep the shell offline + CSP-safe.
- **Persona-driven demo state** in `AppState`, persisted per-persona to `localStorage`.
- **Fixed demo clock** (`DEMO_NOW = 2026-07-10`) so upcoming/past logic is stable.

### Significant mocks / placeholders

Local seed repository; mock auth; persona-as-entitlement; in-memory search; mock media player +
embed resolver; generative thumbnails; in-memory admin mutations; localStorage persistence; no
network calls. See §6 for the replacement map.

### Design-system safety confirmation

**No files outside `/sv-tech-CEO-panel-discovery` were created or modified.** The
`Design_system_fable` project was used **read-only** as a Polaris reference; its typography, spacing,
color tokens, radii (hard corners), shadows, cards, nav patterns, motion primitives, buttons,
inputs, tabs, pills, modals, and loading/empty states were **re-implemented/ported** into this
project (`src/index.css`, `src/components/*`). Nothing in it was edited, and no runtime dependency
on it exists.
