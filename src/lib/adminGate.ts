import { useEffect, useState } from "react";

/* Local admin gate for the demo shell. Toggled with Cmd+A (see
   AppShell); persisted per-browser. Production replaces this with
   real role-based permissions. */

const KEY = "techstage.admin";
const EVENT = "techstage-admin-changed";

export function isAdminUnlocked(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function toggleAdminUnlocked(): boolean {
  const next = !isAdminUnlocked();
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVENT));
  return next;
}

export function useAdminUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked);
  useEffect(() => {
    const sync = () => setUnlocked(isAdminUnlocked());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return unlocked;
}
