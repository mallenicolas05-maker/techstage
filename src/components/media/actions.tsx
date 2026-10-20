import { useState } from "react";
import { Bell, BellRing, Bookmark, BookmarkCheck, FolderPlus, Plus } from "lucide-react";
import { useAppState } from "@/state/AppState";
import { useToast } from "@/components/ui/toast";
import { Button, Input, Modal } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* Interaction buttons shared across cards and detail pages.
   All of them surface plan-limit nudges through the toast. */

export function FollowButton({
  kind,
  id,
  size = "md",
  className,
}: {
  kind: "speaker" | "topic" | "company";
  id: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { isFollowing, toggleFollow } = useAppState();
  const toast = useToast();
  const following = isFollowing(kind, id);
  return (
    <Button
      variant={following ? "ink" : "outline"}
      size={size}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const res = toggleFollow(kind, id);
        if (!res.ok && res.limitMessage) toast({ message: res.limitMessage, upgrade: true });
      }}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}

export function SaveButton({
  kind,
  id,
  className,
  iconOnly = false,
}: {
  kind: "appearance" | "clip" | "moment";
  id: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const { isSaved, toggleSave } = useAppState();
  const toast = useToast();
  const saved = isSaved(kind, id);
  const Icon = saved ? BookmarkCheck : Bookmark;
  if (iconOnly) {
    return (
      <button
        aria-label={saved ? "Unsave" : "Save"}
        className={cn(
          "cursor-pointer p-1.5 transition-colors",
          saved ? "text-ink" : "text-ink-faint hover:text-ink",
          className
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const res = toggleSave(kind, id);
          if (!res.ok && res.limitMessage) toast({ message: res.limitMessage, upgrade: true });
        }}
      >
        <Icon className="size-4" />
      </button>
    );
  }
  return (
    <Button
      variant={saved ? "ink" : "outline"}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const res = toggleSave(kind, id);
        if (!res.ok && res.limitMessage) toast({ message: res.limitMessage, upgrade: true });
      }}
    >
      <Icon className="size-3.5" /> {saved ? "Saved" : "Save"}
    </Button>
  );
}

export function ReminderButton({
  appearanceId,
  eventId,
  at,
  className,
  size = "md",
}: {
  appearanceId?: string | null;
  eventId?: string | null;
  at: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { hasReminder, toggleReminder } = useAppState();
  const toast = useToast();
  const active = hasReminder(appearanceId ?? null, eventId ?? null);
  const Icon = active ? BellRing : Bell;
  return (
    <Button
      variant={active ? "ink" : "outline"}
      size={size}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const res = toggleReminder({ appearanceId, eventId, at });
        if (!res.ok && res.limitMessage) toast({ message: res.limitMessage, upgrade: true });
        else if (res.ok && !active) toast({ message: "Reminder set (in-app · mock delivery)" });
      }}
    >
      <Icon className="size-3.5" /> {active ? "Reminder set" : "Remind me"}
    </Button>
  );
}

export function AddToCollectionButton({
  kind,
  id,
  className,
  size = "md",
}: {
  kind: "appearance" | "clip" | "moment";
  id: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { collections, addToCollection, createCollection, user } = useAppState();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!user) {
            toast({ message: "Sign in to use albums." });
            return;
          }
          setOpen(true);
        }}
      >
        <FolderPlus className="size-3.5" /> Library
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add to album">
        <div className="space-y-2">
          {collections.length === 0 && (
            <p className="font-mono text-xs text-ink-faint">No albums yet. Create one below.</p>
          )}
          {collections.map((c) => {
            const included = kind === "appearance"
              ? c.appearanceIds.includes(id)
              : kind === "clip"
                ? c.clipIds.includes(id)
                : (c.momentIds ?? []).includes(id);
            return (
              <button
                key={c.id}
                disabled={included}
                onClick={() => {
                  addToCollection(c.id, kind, id);
                  toast({ message: `Added to “${c.name}”` });
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between border border-line px-3 py-2.5 text-left transition-colors",
                  included ? "opacity-50" : "hover:border-[var(--ts-acc)]"
                )}
              >
                <span>
                  <span className="block text-sm font-medium">{c.name}</span>
                  <span className="block font-mono text-[10px] text-ink-faint">
                    {c.appearanceIds.length + c.clipIds.length} items
                  </span>
                </span>
                {included ? (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    added
                  </span>
                ) : (
                  <Plus className="size-4 text-ink-faint" />
                )}
              </button>
            );
          })}
          <div className="flex gap-2 border-t border-ink/15 pt-4">
            <Input
              placeholder="New album name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              variant="ink"
              disabled={!name.trim()}
              onClick={() => {
                const res = createCollection(name.trim());
                if (!res.ok && res.limitMessage) {
                  toast({ message: res.limitMessage, upgrade: true });
                  return;
                }
                if (res.id) {
                  addToCollection(res.id, kind, id);
                  toast({ message: `Created “${name.trim()}”` });
                }
                setName("");
                setOpen(false);
              }}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
