export type SubscriberStatus = "pending" | "confirmed" | "paused" | "unsubscribed";

export interface LocalSubscriber {
  email: string;
  status: SubscriberStatus;
  consentAt: string;
  confirmedAt: string | null;
  source: string;
  token: string;
}

const STORAGE_KEY = "techstage-stage-notes-subscriber";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getLocalSubscriber(): LocalSubscriber | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalSubscriber;
  } catch {
    return null;
  }
}

export function subscribeLocally(email: string, source: string): LocalSubscriber {
  const normalized = email.trim().toLowerCase();
  const subscriber: LocalSubscriber = {
    email: normalized,
    status: "pending",
    consentAt: new Date().toISOString(),
    confirmedAt: null,
    source,
    token: `local-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
  };
  if (canUseStorage()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriber));
  return subscriber;
}

export function setLocalSubscriberStatus(status: SubscriberStatus): LocalSubscriber | null {
  const current = getLocalSubscriber();
  if (!current) return null;
  const next: LocalSubscriber = {
    ...current,
    status,
    confirmedAt: status === "confirmed" ? current.confirmedAt ?? new Date().toISOString() : current.confirmedAt,
  };
  if (canUseStorage()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
