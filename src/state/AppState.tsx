import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Collection,
  PlanConfig,
  Reminder,
  User,
  ViewingProgress,
} from "@/domain/types";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { analyticsAdapter, notificationAdapter } from "@/data/adapters/services";

/* ————————————————————————————————————————————————
   App session state.
   The demo bar switches personas: signed-out, free (Jordan),
   pro (Alex). Follows/saves/collections/reminders start from the
   seed user and are mutated locally (persisted to localStorage
   per persona). In production this module is backed by real auth
   + user persistence; the component API stays the same.
———————————————————————————————————————————————— */

export type Persona = "signed-out" | "free" | "pro";

type FollowKind = "speaker" | "topic" | "company";
type SaveKind = "appearance" | "clip" | "moment";

interface MutableUserState {
  followedSpeakerIds: string[];
  followedTopicIds: string[];
  followedCompanyIds: string[];
  savedAppearanceIds: string[];
  savedClipIds: string[];
  savedMomentIds: string[];
  collections: Collection[];
  reminders: Reminder[];
  readNotificationIds: string[];
  progress: ViewingProgress[];
}

export interface ActionResult {
  ok: boolean;
  /** Set when blocked by a plan limit — used for the upgrade nudge. */
  limitMessage?: string;
}

interface AppState {
  persona: Persona;
  setPersona: (p: Persona) => void;
  user: User | null;
  isPro: boolean;
  plan: PlanConfig | null;

  isFollowing: (kind: FollowKind, id: string) => boolean;
  toggleFollow: (kind: FollowKind, id: string) => ActionResult;
  followCount: number;

  isSaved: (kind: SaveKind, id: string) => boolean;
  toggleSave: (kind: SaveKind, id: string) => ActionResult;

  collections: Collection[];
  albums: Collection[];
  createCollection: (name: string, description?: string) => ActionResult & { id?: string };
  createAlbum: (name: string, description?: string) => ActionResult & { id?: string };
  addToCollection: (collectionId: string, kind: SaveKind, id: string) => ActionResult;
  addToAlbum: (albumId: string, kind: SaveKind, id: string) => ActionResult;

  reminders: Reminder[];
  hasReminder: (appearanceId: string | null, eventId?: string | null) => boolean;
  toggleReminder: (opts: { appearanceId?: string | null; eventId?: string | null; at: string }) => ActionResult;

  readNotificationIds: string[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (ids: string[]) => void;

  progress: ViewingProgress[];
  getProgress: (appearanceId: string) => ViewingProgress | null;
  setProgress: (appearanceId: string, positionSeconds: number, durationSeconds: number) => void;
}

const Ctx = createContext<AppState | null>(null);

const personaUserId: Record<Exclude<Persona, "signed-out">, string> = {
  free: "u-free",
  pro: "u-pro",
};

// v3 restores the full demo media/catalog state after the v2 image-backfill
// transition persisted empty follows, albums, notifications, and progress.
const storageKey = (persona: Persona) => `techstage.demo.v3.${persona}`;

function initialStateFor(persona: Persona): MutableUserState {
  const empty: MutableUserState = {
    followedSpeakerIds: [],
    followedTopicIds: [],
    followedCompanyIds: [],
    savedAppearanceIds: [],
    savedClipIds: [],
    savedMomentIds: [],
    collections: [],
    reminders: [],
    readNotificationIds: [],
    progress: [],
  };
  if (persona === "signed-out") return empty;

  const stored = localStorage.getItem(storageKey(persona));
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<MutableUserState>;
      return {
        ...empty,
        ...parsed,
        savedMomentIds: parsed.savedMomentIds ?? (parsed.savedClipIds ?? []).map((id) => `moment-${id}`),
        collections: (parsed.collections ?? []).map((album) => ({ ...album, momentIds: album.momentIds ?? [] })),
      };
    } catch {
      /* fall through to seed */
    }
  }
  const db = getSeedDb();
  const u = db.users.find((x) => x.id === personaUserId[persona]);
  if (!u) return empty;
  return {
    followedSpeakerIds: [...u.followedSpeakerIds],
    followedTopicIds: [...u.followedTopicIds],
    followedCompanyIds: [...u.followedCompanyIds],
    savedAppearanceIds: [...u.savedAppearanceIds],
    savedClipIds: [...u.savedClipIds],
    savedMomentIds: u.savedClipIds.map((id) => `moment-${id}`),
    collections: db.collections.filter((c) => c.userId === u.id).map((c) => ({ ...c })),
    reminders: db.reminders.filter((r) => r.userId === u.id).map((r) => ({ ...r })),
    readNotificationIds: db.notifications.filter((n) => n.userId === u.id && n.isRead).map((n) => n.id),
    progress: (db.viewingProgress[u.id] ?? []).map((p) => ({ ...p })),
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [persona, setPersonaRaw] = useState<Persona>(() => {
    const stored = localStorage.getItem("techstage.persona");
    return stored === "free" || stored === "pro" || stored === "signed-out" ? stored : "free";
  });
  const [state, setState] = useState<MutableUserState>(() => initialStateFor(persona));

  const setPersona = useCallback((p: Persona) => {
    setPersonaRaw(p);
    localStorage.setItem("techstage.persona", p);
    setState(initialStateFor(p));
    analyticsAdapter.track("persona_switched", { persona: p });
  }, []);

  useEffect(() => {
    if (persona !== "signed-out") {
      localStorage.setItem(storageKey(persona), JSON.stringify(state));
    }
  }, [persona, state]);

  const db = getSeedDb();
  const user = persona === "signed-out" ? null : (db.users.find((u) => u.id === personaUserId[persona]) ?? null);
  const isPro = persona === "pro";
  const plan = user ? (db.plans.find((p) => p.tier === user.subscriptionTier) ?? null) : null;

  const followKeys: Record<FollowKind, keyof MutableUserState> = useMemo(
    () => ({
      speaker: "followedSpeakerIds",
      topic: "followedTopicIds",
      company: "followedCompanyIds",
    }),
    []
  );

  const followCount =
    state.followedSpeakerIds.length +
    state.followedTopicIds.length +
    state.followedCompanyIds.length;

  const isFollowing = useCallback(
    (kind: FollowKind, id: string) => (state[followKeys[kind]] as string[]).includes(id),
    [state, followKeys]
  );

  const toggleFollow = useCallback(
    (kind: FollowKind, id: string): ActionResult => {
      if (!user) return { ok: false, limitMessage: "Sign in to follow." };
      const key = followKeys[kind];
      const current = state[key] as string[];
      const following = current.includes(id);
      if (!following && plan?.followLimit != null && followCount >= plan.followLimit) {
        return {
          ok: false,
          limitMessage: `Free plan follows up to ${plan.followLimit}. Upgrade for unlimited follows.`,
        };
      }
      setState((s) => ({
        ...s,
        [key]: following ? current.filter((x) => x !== id) : [...current, id],
      }));
      analyticsAdapter.track("follow_toggled", { kind, id, following: !following });
      return { ok: true };
    },
    [user, plan, state, followKeys, followCount]
  );

  const isSaved = useCallback(
    (kind: SaveKind, id: string) =>
      (kind === "appearance" ? state.savedAppearanceIds : kind === "clip" ? state.savedClipIds : state.savedMomentIds).includes(id),
    [state]
  );

  const toggleSave = useCallback(
    (kind: SaveKind, id: string): ActionResult => {
      if (!user) return { ok: false, limitMessage: "Sign in to save." };
      const key = kind === "appearance" ? "savedAppearanceIds" : kind === "clip" ? "savedClipIds" : "savedMomentIds";
      const current = state[key] as string[];
      const saved = current.includes(id);
      setState((s) => ({
        ...s,
        [key]: saved ? current.filter((x) => x !== id) : [...current, id],
      }));
      analyticsAdapter.track("save_toggled", { kind, id, saved: !saved });
      return { ok: true };
    },
    [user, state]
  );

  const createCollection = useCallback(
    (name: string, description = ""): ActionResult & { id?: string } => {
      if (!user) return { ok: false, limitMessage: "Sign in to create albums." };
      if (plan?.collectionLimit != null && state.collections.length >= plan.collectionLimit) {
        return {
          ok: false,
          limitMessage: `Free plan includes ${plan.collectionLimit} album. Upgrade for unlimited albums.`,
        };
      }
      const id = `col-local-${Date.now()}`;
      const now = new Date().toISOString();
      setState((s) => ({
        ...s,
        collections: [
          ...s.collections,
          {
            id,
            userId: user.id,
            name,
            description,
            appearanceIds: [],
            clipIds: [],
            speakerIds: [],
            topicIds: [],
            visibility: "private",
            createdAt: now,
            updatedAt: now,
          },
        ],
      }));
      return { ok: true, id };
    },
    [user, plan, state.collections.length]
  );

  const addToCollection = useCallback(
    (collectionId: string, kind: SaveKind, id: string): ActionResult => {
      setState((s) => ({
        ...s,
        collections: s.collections.map((c) => {
          if (c.id !== collectionId) return c;
          const key = kind === "appearance" ? "appearanceIds" : kind === "clip" ? "clipIds" : "momentIds";
          const existing = c[key] ?? [];
          if (existing.includes(id)) return c;
          return { ...c, [key]: [...existing, id], updatedAt: new Date().toISOString() };
        }),
      }));
      return { ok: true };
    },
    []
  );

  const hasReminder = useCallback(
    (appearanceId: string | null, eventId: string | null = null) =>
      state.reminders.some(
        (r) =>
          r.status === "scheduled" &&
          ((appearanceId && r.appearanceId === appearanceId) ||
            (eventId && r.eventId === eventId))
      ),
    [state.reminders]
  );

  const toggleReminder = useCallback(
    (opts: { appearanceId?: string | null; eventId?: string | null; at: string }): ActionResult => {
      if (!user) return { ok: false, limitMessage: "Sign in to set reminders." };
      const appearanceId = opts.appearanceId ?? null;
      const eventId = opts.eventId ?? null;
      const existing = state.reminders.find(
        (r) =>
          r.status === "scheduled" &&
          r.appearanceId === appearanceId &&
          r.eventId === eventId
      );
      if (existing) {
        setState((s) => ({
          ...s,
          reminders: s.reminders.map((r) =>
            r.id === existing.id ? { ...r, status: "cancelled" as const } : r
          ),
        }));
        return { ok: true };
      }
      const active = state.reminders.filter((r) => r.status === "scheduled").length;
      if (plan?.reminderLimit != null && active >= plan.reminderLimit) {
        return {
          ok: false,
          limitMessage: `Free plan includes ${plan.reminderLimit} active reminders. Upgrade for advanced reminders.`,
        };
      }
      setState((s) => ({
        ...s,
        reminders: [
          ...s.reminders,
          {
            id: `rem-local-${Date.now()}`,
            userId: user.id,
            eventId,
            appearanceId,
            reminderTime: opts.at,
            deliveryChannels: isPro ? ["in-app", "email"] : ["in-app"],
            status: "scheduled",
          },
        ],
      }));
      void notificationAdapter.scheduleReminder({ appearanceId, eventId, at: opts.at });
      return { ok: true };
    },
    [user, plan, state.reminders, isPro]
  );

  const markNotificationRead = useCallback((id: string) => {
    setState((s) =>
      s.readNotificationIds.includes(id)
        ? s
        : { ...s, readNotificationIds: [...s.readNotificationIds, id] }
    );
  }, []);

  const markAllNotificationsRead = useCallback((ids: string[]) => {
    setState((s) => ({
      ...s,
      readNotificationIds: Array.from(new Set([...s.readNotificationIds, ...ids])),
    }));
  }, []);

  const getProgress = useCallback(
    (appearanceId: string) => state.progress.find((p) => p.appearanceId === appearanceId) ?? null,
    [state.progress]
  );

  const setProgress = useCallback(
    (appearanceId: string, positionSeconds: number, durationSeconds: number) => {
      setState((s) => {
        const rest = s.progress.filter((p) => p.appearanceId !== appearanceId);
        return {
          ...s,
          progress: [
            { appearanceId, positionSeconds, durationSeconds, updatedAt: new Date().toISOString() },
            ...rest,
          ],
        };
      });
    },
    []
  );

  const value: AppState = {
    persona,
    setPersona,
    user,
    isPro,
    plan,
    isFollowing,
    toggleFollow,
    followCount,
    isSaved,
    toggleSave,
    collections: state.collections,
    albums: state.collections,
    createCollection,
    createAlbum: createCollection,
    addToCollection,
    addToAlbum: addToCollection,
    reminders: state.reminders,
    hasReminder,
    toggleReminder,
    readNotificationIds: state.readNotificationIds,
    markNotificationRead,
    markAllNotificationsRead,
    progress: state.progress,
    getProgress,
    setProgress,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
