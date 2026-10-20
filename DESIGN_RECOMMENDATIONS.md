# TECHSTAGE — Design Upgrade Recommendations

Ten high-impact visual upgrades that would make the platform look absolutely stunning, written
as **implementation-ready instructions for another model**. Each entry specifies exactly which
files to touch, the code to add, and acceptance criteria so it renders as imagined.

**Ground rules for the implementing model (read first):**

- The design language is Polaris: **hard corners (no border-radius), paper/ink palette, mono
  metadata, serif display type**. Never add rounded corners, drop shadows with blur (offset
  hard shadows only, e.g. `shadow-[6px_6px_0_0_var(--ts-acc-soft)]`), or gradients outside what
  is specified below.
- All color must come from the CSS variables in `src/index.css` (`--ts-acc`, `--ts-acc2`,
  `--ts-acc-15`, `--ts-mark-a`, `--ts-grid`, `--color-ink*`, `--color-paper*`) so all 12 themes
  keep working. **Never hardcode a hue.**
- Icons stay neutral (`text-ink-soft` / `text-ink-faint`) per the platform rule.
- Respect `prefers-reduced-motion` — index.css already neutralizes animations globally; any new
  animation must degrade gracefully under it (no layout dependence on the animated state).
- After every change: `npx tsc -b --noEmit` must pass and the page must be checked at 375px and
  1280px widths.

---

## 1. Animated beam border on the Home feature card

**What:** The Polaris "beam border" — a slowly rotating conic-gradient border — on the single
large `AppearanceFeatureCard` at the top of "Latest talks". One card only; it reads as "tonight's
main stage".

**Files:** `src/index.css`, `src/pages/Home.tsx`.

**CSS to add (index.css, near `.hard-hover`):**

```css
@property --beam-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}
.beam-border {
  position: relative;
  background:
    linear-gradient(var(--color-paper), var(--color-paper)) padding-box,
    conic-gradient(
        from var(--beam-angle),
        var(--color-line) 0deg,
        var(--ts-acc) 80deg,
        var(--ts-acc2) 140deg,
        var(--color-line) 220deg,
        var(--color-line) 360deg
      )
      border-box;
  border: 1.5px solid transparent;
  animation: beam-spin 5s linear infinite;
}
@keyframes beam-spin {
  to { --beam-angle: 360deg; }
}
```

**JSX:** in `Home.tsx`, wrap the feature card: `<Reveal className="card-field mt-4 p-3"><div
className="beam-border"><AppearanceFeatureCard a={latest[0]} /></div></Reveal>` and remove the
card's own outer border by passing `className="border-0"`.

**Accept when:** a thin animated accent border slowly sweeps around only the feature card, in
every theme, and stops animating under reduced motion (static line border remains).

## 2. Route-level page transitions (View Transitions API)

**What:** A 250ms crossfade + 8px upward slide when navigating between pages — makes the whole
app feel native. Progressive enhancement; no library.

**Files:** `src/components/shell/AppShell.tsx`, `src/index.css`.

**Implementation:** wrap route changes with `document.startViewTransition` using React Router's
`useNavigate` interception is complex; instead use the simple CSS-only approach:

```css
@view-transition { navigation: auto; }
::view-transition-old(root) { animation: vt-out 200ms ease both; }
::view-transition-new(root) { animation: vt-in 250ms ease both; }
@keyframes vt-out { to { opacity: 0; } }
@keyframes vt-in { from { opacity: 0; transform: translateY(8px); } }
```

Because this is an SPA, additionally call `document.startViewTransition(() => flushSync(update))`
inside a tiny wrapper around navigation: in `AppShell`, intercept `NavLink` clicks is invasive —
prefer adding a `useViewTransitionNavigate()` hook (in `src/lib/`) that wraps `useNavigate` and
is used by the hamburger menu + primary nav only. Feature-detect: `if
(!document.startViewTransition) navigate(to); else document.startViewTransition(() =>
flushSync(() => navigate(to)))` (import `flushSync` from `react-dom`).

**Accept when:** clicking between Home/Discover/Upcoming crossfades smoothly in Chrome; Safari
and Firefox fall back to instant navigation with zero errors.

## 3. Grain texture on hero surfaces

**What:** Polaris's film-grain overlay on `.ts-paper` heroes — makes the drafting paper feel
printed rather than rendered.

**Files:** `src/index.css` only.

```css
.grain { position: relative; }
.grain::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.4;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
}
```

Add `grain` next to every `ts-paper` class on hero `<section>`s (Home, Discover, Upcoming,
Library, Profile, About, Terms, Privacy). The hero sections must also get `relative` if not
already positioned, and interactive children must sit above via existing stacking (the overlay is
`pointer-events-none`, so no z-index work is needed).

**Accept when:** heroes show a subtle paper grain at 100% zoom; text remains perfectly crisp
(the overlay never covers `.text-backer` legibility); no scroll jank.

## 4. Command-palette search (arrow keys + sections)

**What:** Upgrade `src/components/shell/SearchOverlay.tsx` into a true command palette:
ArrowUp/ArrowDown moves an active row (accent left-border, `bg-paper-gray`), Enter opens it,
Tab cycles result groups, and typing `>` filters to actions ("Go to Library", "Switch theme…",
"Set persona: Premium").

**Implementation:** keep the existing search logic; add `const [activeIndex, setActiveIndex]`
over a flattened `results` array; `onKeyDown` on the input handles ArrowUp/Down/Enter. Action
items are a static array `{ label, run: () => void }` matched when query starts with `>`. Style
the active row exactly like the hover state plus `border-l-2 border-[var(--ts-acc)]`.

**Accept when:** search is fully keyboard-drivable end to end (open with `/`, navigate, Enter,
Esc), and `>theme` lists the 12 themes and applies one on Enter.

## 5. Sticky chapter rail with scroll-spy on the appearance page

**What:** On desktop, the Chapters card column (`src/pages/AppearanceDetail.tsx`, side column)
becomes `lg:sticky lg:top-20 lg:max-h-[70vh] lg:overflow-y-auto ide-scroll`, and the active
chapter gets a thin vertical accent bar that *slides* between chapters using a single absolutely
positioned `<span>` whose `top` is derived from the active chapter index (`transition: top 300ms
ease`). This is the "table of contents that follows you" pattern.

**Accept when:** playing the mock recording moves the accent bar smoothly from chapter 01 to 02
at the chapter boundary without re-render jumps; on mobile nothing changes.

## 6. Speaker topic-constellation (SVG, no library)

**What:** On `src/pages/SpeakerProfile.tsx`, a small generative SVG: the speaker's avatar
square in the center, their topics as labeled nodes on a ring, hairline lines connecting them —
Polaris-style "charted sky". Deterministic from data; no physics, no d3.

**Implementation:** new component `TopicConstellation` in `src/components/media/` taking
`{ speaker, topics }`. SVG `viewBox="0 0 320 320"`; nodes at
`angle = (index / topics.length) * 2π`, `cx = 160 + 110·cos(angle)`, `cy = 160 + 110·sin(angle)`.
Lines: `stroke="var(--ts-grid)" stroke-width="1"`. Nodes: 8px squares (`<rect>`, hard corners)
filled `var(--ts-acc-15-solid)` with `stroke="var(--ts-acc)"`; labels in
`font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; fill:
var(--color-ink-soft)`. Each node wrapped in `<a href={/topics/slug}>`. Center: `<foreignObject>`
with the existing `Avatar`.

**Accept when:** the constellation renders identically on reload (deterministic), every node
navigates to its topic page, and it collapses to a simple pill list below `sm` (hide SVG,
show existing `TopicPillLink`s).

## 7. Skeleton → content crossfade

**What:** Content currently pops in when loading finishes. Give every `useAsync` consumer a
150ms fade-up: add to `index.css`

```css
.fade-in-content { animation: fade-up 240ms ease both; }
@keyframes fade-up { from { opacity: 0; transform: translateY(4px); } }
```

and add `className="fade-in-content"` to the first wrapper rendered when `loading` flips false
in: Home sections, Discover results container, Upcoming feed, AppearanceDetail main column,
Library tabs. Do not wrap skeletons themselves.

**Accept when:** throttling the network (dev latency is already simulated) shows skeletons that
dissolve into content instead of swapping abruptly; no layout shift (the wrapper must not change
box dimensions).

## 8. Scroll-linked marquee + live "now on stage" state

**What:** The Home upcoming marquee (`Marquee` in `src/components/motion.tsx`) speeds up
slightly while the user scrolls (feels alive), and any appearance with `status === "live"` gets
a pulsing `live-dot` + "LIVE" prefix in the marquee and a `Badge tone="live"` in rails.

**Implementation:** in `Marquee`, add an optional `scrollBoost` prop: a `useEffect` window scroll
listener sets `animationDuration` to `duration * 0.6` while scrolling (clearTimeout-debounced
400ms back to normal) by writing `style.animationDuration` on the row ref — no re-render. The
live prefix is data-driven in `Home.tsx` (`appearance.status === "live"`).

**Accept when:** scrolling visibly quickens the ticker then relaxes; a seed appearance set to
`status: "live"` shows the pulsing dot in the marquee.

## 9. Dark "stage mode" theme

**What:** A 13th theme, `stage` — near-black paper, warm off-white ink — for watching. It is the
only dark theme, positioned as "lights down".

**Files:** `src/index.css`, `src/components/theme.tsx`.

**index.css:** dark themes must override the *paper/ink* tokens, not just accents:

```css
[data-theme="stage"] {
  --color-paper: #131417;
  --color-paper-gray: #1b1c21;
  --color-paper-warm: #17181c;
  --color-ink: #f3f1ec;
  --color-ink-soft: #b8b6af;
  --color-ink-faint: #7d7c76;
  --color-line: #2a2b31;
  --ts-acc: #7a9bff;  --ts-acc-deep: #a8bfff;  --ts-acc-soft: #22304f;
  --ts-acc2: #ff6ea9; --ts-acc2-deep: #ff9cc3;
}
```

Note `--ts-acc-deep` must be *lighter* than `--ts-acc` here (it is used as text on paper).
Audit hardcoded `rgba(23,24,28,…)` values in index.css (`.dot-grid`, `.thumb::after`,
`.skeleton`, `.progress-track`, shadows): convert them to `color-mix(in srgb, var(--color-ink)
X%, transparent)` first so the texture system inverts automatically.
**theme.tsx:** add `{ id: "stage", label: "Stage mode", note: "Lights down.", Icon: MoonStar,
swatches: ["#131417", "#7a9bff", "#f3f1ec"] }`.

**Accept when:** every page is legible in stage mode (spot-check hero, cards, transcript,
admin, footer), images/thumbs don't glow, and switching back restores light instantly.

## 10. Micro-interaction pass on save / follow / remind

**What:** State changes currently swap instantly. Add a 200ms "stamp" effect: on activation the
button scales 0.92 → 1 with the icon doing a small pop, like a rubber stamp hitting paper —
tactile, but Polaris-dry (no confetti, no springs library).

**Files:** `src/index.css`, `src/components/media/actions.tsx`.

```css
.stamp { animation: stamp 200ms cubic-bezier(.2,.9,.3,1.4); }
@keyframes stamp {
  0% { transform: scale(1); }
  40% { transform: scale(0.92); }
  100% { transform: scale(1); }
}
```

In `SaveButton`/`FollowButton`/`ReminderButton`, keep a `justActivated` state set for 220ms after
a successful *activating* toggle (not deactivating), and append `stamp` to the button class while
set. Never animate on mount.

**Accept when:** saving/following visibly "stamps" once, unfollowing does not animate, and rapid
double-clicks don't queue animations (reset the timer).

---

### Suggested order

3 → 7 → 10 (pure polish, zero risk) → 1 → 8 → 5 → 4 → 6 → 2 → 9 (largest audit surface last).
Each item is independently shippable; verify themes + mobile after each.
