import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  FileText,
  Film,
  Radio,
  Sparkles,
  Video,
  Waypoints,
  RefreshCw,
  Settings,
} from "lucide-react";
import { userRepo } from "@/data/repositories/local";
import { useAsync } from "@/lib/useAsync";
import { useAppState } from "@/state/AppState";
import { Button, EmptyState, Modal, RowSkeleton } from "@/components/ui/primitives";
import { appearanceSlug, speakerSlug } from "@/data/lookup";
import { formatRelative } from "@/lib/format";
import { DEMO_NOW } from "@/data/repositories/local";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/domain/types";

/* Notifications — grouped feed with read state, linking into the
   entities that triggered them. Delivery beyond in-app is a
   production integration. */

const ICONS: Record<NotificationType, typeof Bell> = {
  "new-appearance": Video,
  "recording-available": Film,
  "event-starting": CalendarClock,
  "new-clip": Film,
  "transcript-ready": FileText,
  "insight-brief-ready": Sparkles,
  "related-signal": Waypoints,
  "schedule-change": CalendarClock,
  "livestream-available": Radio,
};

function targetFor(n: AppNotification): string {
  if (!n.linkedEntityId) return "/";
  switch (n.linkedEntityType) {
    case "appearance":
      return `/a/${appearanceSlug(n.linkedEntityId)}`;
    case "speaker":
      return `/speakers/${speakerSlug(n.linkedEntityId)}`;
    case "clip":
      return "/library";
    case "event":
      return "/upcoming";
    default:
      return "/";
  }
}

export default function Notifications() {
  const { user, persona, readNotificationIds, markNotificationRead, markAllNotificationsRead } =
    useAppState();
  const notifications = useAsync(
    () => (user ? userRepo.listNotifications(user.id) : Promise.resolve([])),
    [user?.id]
  );
  const [lastUpdated, setLastUpdated] = useState("just now");
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (persona === "signed-out") {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-10">
        <EmptyState
          title="Notifications need a signed-in account"
          hint="Switch personas in the demo bar to see the notification feed."
        />
      </main>
    );
  }

  const rows = notifications.data ?? [];
  const unread = rows.filter((n) => !readNotificationIds.includes(n.id));

  return (
    <main className="mx-auto max-w-3xl px-4">
      <section className="ts-paper -mx-4 border-b border-line px-4 py-7">
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-faint">
              ✦ {unread.length} unread
            </p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Notifications</h1>
          </div>
          {unread.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllNotificationsRead(rows.map((n) => n.id))}
            >
              Mark all read
            </Button>
          )}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border border-ink/20 bg-paper-gray px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">Updated {lastUpdated}</span>
        <div className="flex gap-2"><Button size="sm" onClick={() => { notifications.reload(); setLastUpdated("just now"); }}><RefreshCw className="size-3" /> Refresh</Button><Button size="sm" onClick={() => setSettingsOpen(true)}><Settings className="size-3" /> Settings</Button></div>
      </div>

      <div className="mt-3 space-y-2">
        {notifications.loading &&
          Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}

        {!notifications.loading && rows.length === 0 && (
          <EmptyState
            title="All quiet"
            hint="Follow speakers, topics, and companies to get updates here."
          />
        )}

        {rows.map((n) => {
          const isRead = readNotificationIds.includes(n.id);
          const Icon = ICONS[n.type];
          return (
            <Link
              key={n.id}
              to={targetFor(n)}
              onClick={() => markNotificationRead(n.id)}
              className={cn(
                "group flex items-start gap-3.5 border px-4 py-3.5 transition-colors",
                isRead
                  ? "border-line bg-paper hover:border-ink/40"
                  : "border-[var(--ts-acc-45)] bg-[var(--ts-acc-15)]/40 hover:border-[var(--ts-acc)]"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center border",
                  isRead ? "border-line bg-paper-gray text-ink-faint" : "border-[var(--ts-acc-45)] bg-paper text-ink-soft"
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !isRead && "font-semibold")}>{n.title}</span>
                <span className="mt-0.5 block font-mono text-[11px] leading-relaxed text-ink-soft">
                  {n.body}
                </span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                  {n.type.replace(/-/g, " ")} · {formatRelative(n.createdAt, DEMO_NOW)}
                </span>
              </span>
              {!isRead && <span className="mt-1 shrink-0 font-mono text-[9px] uppercase tracking-widest text-[var(--ts-acc2-deep)]" aria-label="unread">New</span>}
            </Link>
          );
        })}
      </div>

      <p className="mt-6 font-mono text-[10px] leading-relaxed text-ink-faint">
        In-app only in this shell. Email digests and mobile push are wired through the
        notification adapter when production delivery lands.
      </p>
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Notification settings" className="sm:max-w-xl">
        <p className="text-sm text-ink-soft">Updates are stored locally. Email and scheduled browser delivery remain simulated.</p>
        <div className="mt-4 grid gap-px border border-ink/20 bg-ink/20 sm:grid-cols-2">
          {["New recordings", "New clips", "New appearances", "Starts soon", "Schedule changes"].map((label) => <label key={label} className="flex items-center justify-between bg-paper p-4 text-sm"><span>{label}</span><input type="checkbox" defaultChecked className="accent-[var(--ts-acc)]" /></label>)}
        </div>
        <div className="mt-3 border border-line p-4"><p className="text-sm font-semibold">{user?.email}</p><p className="mt-1 text-[10px] text-ink-faint">Email address for the future delivery service.</p></div>
      </Modal>
    </main>
  );
}
