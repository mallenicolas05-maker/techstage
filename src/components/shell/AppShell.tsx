import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, FlaskConical, Search, UserRound } from "lucide-react";
import { useAppState, type Persona } from "@/state/AppState";
import { userRepo } from "@/data/repositories/local";
import { toggleAdminUnlocked, useAdminUnlocked } from "@/lib/adminGate";
import { useToast } from "@/components/ui/toast";
import { SearchOverlay } from "./SearchOverlay";
import { cn } from "@/lib/utils";
import { SubscribeCard } from "@/components/newsletter/SubscribeCard";

/* Application shell.
   Desktop: top bar with primary nav (Home, Discover, Upcoming,
   Speakers, Topics, Library) + search + notifications + profile.
   Mobile: compact top bar with a hamburger menu that opens a
   dotted-paper dropdown of every page (no bottom tab bar).
   The floating demo bar (persona switcher) is the Polaris
   colorway-bar pattern, repurposed. Admin is gated behind Cmd+A. */

const primaryNav = [
  { to: "/", label: "Home" },
  { to: "/discover", label: "Discover" },
  { to: "/upcoming", label: "Upcoming" },
  { to: "/speakers", label: "Speakers" },
  { to: "/companies", label: "Companies" },
  { to: "/events", label: "Events" },
  { to: "/topics", label: "Topics" },
  { to: "/stage-notes", label: "Stagenotes" },
  { to: "/library", label: "Library" },
];

const menuPages = [
  { to: "/", label: "Home" },
  { to: "/discover", label: "Discover" },
  { to: "/upcoming", label: "Upcoming" },
  { to: "/speakers", label: "Speakers" },
  { to: "/companies", label: "Companies" },
  { to: "/events", label: "Events" },
  { to: "/topics", label: "Topics" },
  { to: "/stage-notes", label: "Stagenotes" },
  { to: "/library", label: "Library" },
  { to: "/notifications", label: "Notifications" },
  { to: "/subscription", label: "Premium" },
  { to: "/about", label: "About" },
  { to: "/dashboard", label: "Dashboard" },
];

function Wordmark() {
  return (
    <Link to="/" className="flex items-baseline" aria-label="TECHSTAGE home">
      <span className="font-mono text-[15px] font-medium tracking-[0.28em] text-ink">
        TECH<span className="text-[var(--ts-acc)]">STAGE</span>
      </span>
    </Link>
  );
}

function useUnreadCount(): number {
  const { user, readNotificationIds } = useAppState();
  const [total, setTotal] = useState<string[]>([]);
  useEffect(() => {
    if (!user) {
      setTotal([]);
      return;
    }
    userRepo.listNotifications(user.id).then((rows) => setTotal(rows.map((n) => n.id)));
  }, [user]);
  return total.filter((id) => !readNotificationIds.includes(id)).length;
}

export function AppShell() {
  const { persona, setPersona, user } = useAppState();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const adminUnlocked = useAdminUnlocked();
  const toast = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  /* "/" opens search anywhere; Cmd+A toggles the admin gate */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (e.key === "/" && !searchOpen && !typing) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "a" && !typing) {
        e.preventDefault();
        const unlocked = toggleAdminUnlocked();
        if (unlocked) navigate("/admin");
        toast({ message: unlocked ? "Opening Admin" : "Admin shortcut hidden" });
      }
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, toast, navigate]);

  /* Scroll on route change: honor #hash targets, else go to top */
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      /* wait a tick so the target page has rendered */
      const handle = setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return () => clearTimeout(handle);
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  /* Close the mobile menu on navigation and outside clicks */
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const personas: { id: Persona; label: string }[] = useMemo(
    () => [
      { id: "signed-out", label: "Signed out" },
      { id: "free", label: "Free" },
      { id: "pro", label: "Premium" },
    ],
    []
  );

  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* ——— Top bar ——— */}
      <header className="sticky top-0 z-40 border-b border-ink/15 bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:h-16 sm:gap-6">
          <Wordmark />

          <nav className="ml-2 hidden items-center gap-3.5 md:flex lg:gap-5">
            {primaryNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "link-sweep font-mono text-xs uppercase tracking-widest transition-colors",
                    isActive ? "text-ink" : "text-ink-faint hover:text-ink"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="cursor-pointer border border-transparent p-2 text-ink-soft transition-colors hover:text-ink md:hidden"
              aria-label="Search"
            >
              <Search className="size-4" />
            </button>

            <Link
              to="/notifications"
              className="relative cursor-pointer border border-transparent p-2 text-[var(--ts-acc-deep)] transition-colors hover:text-[var(--ts-acc)]"
              aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute -right-1 top-0 flex h-4 min-w-5 items-center justify-center rounded-full bg-[var(--ts-acc)] px-1 font-sans text-[9px] font-semibold leading-none text-white ring-2 ring-paper">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {/* Desktop: profile link */}
            <Link
              to="/dashboard"
              className="hidden cursor-pointer items-center border border-transparent p-2 text-ink-soft transition-colors hover:text-ink md:flex"
              aria-label={user ? `${user.name} dashboard` : "Sign in"}
            >
              <UserRound className="size-4" />
            </Link>

            {/* Mobile: hamburger — three minimal stacked lines */}
            <div className="relative md:hidden" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label="Menu"
                className="flex cursor-pointer flex-col items-center justify-center gap-[5px] border border-transparent p-2"
              >
                <span className={cn("block h-px w-4 bg-ink transition-transform", menuOpen && "translate-y-[6px] rotate-45")} />
                <span className={cn("block h-px w-4 bg-ink transition-opacity", menuOpen && "opacity-0")} />
                <span className={cn("block h-px w-4 bg-ink transition-transform", menuOpen && "-translate-y-[6px] -rotate-45")} />
              </button>

              {menuOpen && (
                <div className="mobile-menu-enter dot-grid absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-2rem))] border border-ink bg-paper p-2 shadow-[6px_6px_0_0_rgba(23,24,28,0.15)]">
                  <p className="border-b border-ink/10 px-4 pb-2 pt-3 font-mono text-[9px] uppercase tracking-[0.25em] text-ink-faint">
                    <span className="text-backer">Navigate</span>
                  </p>
                  <nav className="space-y-1 py-1">
                    {menuPages.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "tech-frame tech-frame-compact block border border-transparent px-3 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors",
                            isActive
                              ? "tech-frame-always bg-paper font-semibold text-ink"
                              : "bg-paper/90 text-ink-soft hover:text-ink"
                          )
                        }
                      >
                        <span className="text-backer">{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ——— Routed page ——— */}
      <Outlet />

      {/* ——— Floating demo bar (persona switcher + gated admin) ——— */}
      <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <div className="flex items-center gap-1 border border-ink bg-paper px-1.5 py-1 shadow-[5px_5px_0_0_rgba(23,24,28,0.15)] sm:px-2 sm:py-1.5">
          <span className="hidden px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint sm:inline">
            Demo /
          </span>
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              aria-pressed={persona === p.id}
              className={cn(
                "cursor-pointer px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors sm:px-2.5 sm:py-1.5 sm:text-[11px]",
                persona === p.id ? "bg-[var(--ts-acc-15)] text-[var(--ts-acc-deep)] outline-1 outline-[var(--ts-acc)]" : "text-ink-soft hover:bg-paper-gray"
              )}
            >
              {p.label}
            </button>
          ))}
          {adminUnlocked && (
            <>
              <span className="mx-1 h-4 w-px bg-ink/20" aria-hidden />
              <Link
                to="/admin"
                className={cn(
                  "flex cursor-pointer items-center gap-1 px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors sm:py-1.5",
                  isAdmin ? "bg-[var(--ts-acc)] text-white" : "text-ink-soft hover:bg-paper-gray"
                )}
              >
                <FlaskConical className="size-3" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            </>
          )}
        </div>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ——— Footer ——— */}
      <footer className="mt-20 border-t border-ink/20 bg-paper-gray">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Wordmark />
            <p className="mt-4 max-w-sm font-serif text-2xl leading-snug">
              The public record of technology, organized around the people who shape it.
            </p>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-ink-faint">
              Panels, keynotes, firesides, launches, and lectures — indexed with speakers,
              transcripts, and sources. Recordings always remain with their rights holders.
            </p>
            <NewsletterField />
          </div>
          <FooterColumn
            title="Explore"
            links={[["Discover", "/discover"], ["Upcoming", "/upcoming"], ["Stage Notes", "/stage-notes"], ["Topics", "/topics"], ["Speakers", "/speakers"]]}
          />
          <FooterColumn
            title="Account"
            links={[["Library", "/library"], ["Notifications", "/notifications"], ["Dashboard", "/dashboard"], ["Premium", "/subscription"]]}
          />
          <FooterColumn
            title="Company"
            links={[["About", "/about"], ["FAQ", "/#faq"]]}
          />
          <FooterColumn
            title="Legal"
            links={[["Terms of Service", "/terms"], ["Privacy Policy", "/privacy"]]}
          />
        </div>
        <div className="border-t border-ink/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-4 sm:flex-row sm:items-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
              © 2026 TechStage ·{" "}
              <Link to="/terms" className="hover:text-ink">Terms</Link> ·{" "}
              <Link to="/privacy" className="hover:text-ink">Privacy</Link>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
              Source-linked public metadata · recordings remain with their rights holders
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NewsletterField() {
  return <SubscribeCard source="footer" compact className="mt-6" />;
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">{title}</p>
      <div className="mt-4 space-y-2.5">
        {links.map(([label, to]) =>
          to.startsWith("mailto:") ? (
            <a key={to} href={to} className="link-sweep block w-fit text-sm text-ink-soft hover:text-ink">
              {label}
            </a>
          ) : (
            <Link key={to} to={to} className="link-sweep block w-fit text-sm text-ink-soft hover:text-ink">
              {label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
