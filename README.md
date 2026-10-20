# TECHSTAGE

**Technology talks, charted.** A discovery platform for technology panels, keynotes,
fireside chats, interviews, product launches, and speaking events.

## Features

- Browse talks, speakers, companies, events, and topics.
- Explore appearance details, transcripts, clips, and insight briefs.
- Save talks, follow topics, and track upcoming appearances.
- Read Stage Notes and explore newsletter subscription flows.
- Review content through an administrative ingestion workflow.

## Project status

TECHSTAGE is a work-in-progress application with a runnable local demo and backend
integration code. The default local mode lets you explore the interface without
provider credentials. Live services require separate configuration; this repository
does not imply that authentication, billing, ingestion, or AI providers are deployed.
The catalog combines source-linked records with demonstration data.

## Stack

React 19, TypeScript, Vite, Tailwind CSS, React Router, and Zod, with Supabase
integration code and Vitest tests.

## Run locally

Use Node.js 22 or later.

```bash
npm ci
npm run dev
```

For optional configuration, copy `.env.example` to `.env.local` and populate only
the settings you need. Keep secrets out of source control and never place server
credentials in browser-exposed `VITE_*` variables.

## Validation

```bash
npm run typecheck
npm run test:offline
npm run build
```

## Structure

- `src/pages/` — application screens
- `src/components/` — reusable interface components
- `src/domain/` — typed models and validation
- `src/data/` — catalog data, repositories, and service adapters
- `src/state/` — application state
- `supabase/` — backend functions and migrations
- `scripts/` — catalog, asset, and backup utilities
- `public/` — bundled fonts and media

The handoff documents capture development notes from earlier stages and may describe
older behavior. This public repository starts with a clean snapshot of the current
source, excluding local credentials, installed dependencies, and generated builds.
