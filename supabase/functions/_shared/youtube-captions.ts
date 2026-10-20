type CaptionTrack = {
  baseUrl?: unknown;
  languageCode?: unknown;
  kind?: unknown;
  name?: { simpleText?: unknown };
};
type FetchLike = typeof fetch;
export type YouTubeCaptionSegment = {
  startSeconds: number;
  durationSeconds: number;
  text: string;
};

const MAX_TRANSCRIPT_CHARS = 750_000;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

export function youTubeVideoIdFrom(value: string): string | null {
  try {
    const url = new URL(value);
    if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : (url.searchParams.get("v") ??
          url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1]);
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function isSafeTimedtextUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "youtube.com" ||
        url.hostname.endsWith(".youtube.com")) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function selectCaptionTrack(
  tracks: CaptionTrack[],
): CaptionTrack | null {
  const english = (track: CaptionTrack) =>
    /^en(?:[-_]|$)/i.test(String(track.languageCode ?? ""));
  const manual = (track: CaptionTrack) => track.kind !== "asr";
  return (
    tracks.find((track) => english(track) && manual(track)) ??
    tracks.find((track) => english(track) && !manual(track)) ??
    tracks.find(manual) ??
    tracks[0] ??
    null
  );
}

export function json3ToTranscript(
  json: unknown,
  maxChars = MAX_TRANSCRIPT_CHARS,
): string {
  const events = (json as { events?: unknown })?.events;
  if (!Array.isArray(events)) return "";
  const output: string[] = [];
  let nextMarkerMs = 0;
  for (const event of events) {
    const value = event as {
      tStartMs?: unknown;
      aAppend?: unknown;
      segs?: unknown;
    };
    if (value.aAppend) continue;
    const text = Array.isArray(value.segs)
      ? value.segs
          .map((segment) => String((segment as { utf8?: unknown }).utf8 ?? ""))
          .join("")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    if (!text) continue;
    const startMs = Math.max(0, Number(value.tStartMs ?? 0));
    if (startMs >= nextMarkerMs) {
      const seconds = Math.floor(startMs / 1000);
      output.push(
        `[${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}]`,
      );
      nextMarkerMs = startMs + 30_000;
    }
    output.push(text);
    if (output.join(" ").length >= maxChars)
      return output.join(" ").slice(0, maxChars);
  }
  return output.join(" ").replace(/\s+/g, " ").trim();
}

export function json3ToSegments(json: unknown): YouTubeCaptionSegment[] {
  const events = (json as { events?: unknown })?.events;
  if (!Array.isArray(events)) return [];
  return events.flatMap((event) => {
    const value = event as {
      tStartMs?: unknown;
      dDurationMs?: unknown;
      aAppend?: unknown;
      segs?: unknown;
    };
    if (value.aAppend || !Array.isArray(value.segs)) return [];
    const text = value.segs
      .map((segment) => String((segment as { utf8?: unknown }).utf8 ?? ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return [];
    return [
      {
        startSeconds: Math.max(0, Number(value.tStartMs ?? 0) / 1000),
        durationSeconds: Math.max(
          0.1,
          Number(value.dDurationMs ?? 0) / 1000 || 2,
        ),
        text,
      },
    ];
  });
}

function extractJsonObject(source: string, start: number): string | null {
  const firstBrace = source.indexOf("{", start);
  if (firstBrace < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = firstBrace; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0)
      return source.slice(firstBrace, index + 1);
  }
  return null;
}

export function playerResponseFromPage(
  page: string,
): Record<string, unknown> | null {
  const marker = page.search(/ytInitialPlayerResponse\s*=/);
  const direct = marker >= 0 ? extractJsonObject(page, marker) : null;
  if (direct) {
    try {
      return JSON.parse(direct) as Record<string, unknown>;
    } catch {
      /* try the encoded form below */
    }
  }
  const encoded = page.match(/"playerResponse":"(\{(?:\\.|[^"\\])+\})"/s)?.[1];
  if (!encoded) return null;
  try {
    return JSON.parse(JSON.parse(`"${encoded}"`)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchText(
  url: string,
  fetchImpl: FetchLike,
  init?: RequestInit,
): Promise<string> {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return "";
  return await response.text();
}

export async function fetchYouTubeCaptionTranscript(
  videoId: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const page = await fetchText(watchUrl, fetchImpl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; TechStage/1.0)" },
    });
    const player = playerResponseFromPage(page);
    const tracks = ((
      (player?.captions as Record<string, unknown> | undefined)
        ?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined
    )?.captionTracks ?? []) as CaptionTrack[];
    const track = selectCaptionTrack(tracks);
    const baseUrl = typeof track?.baseUrl === "string" ? track.baseUrl : "";
    if (!baseUrl || !isSafeTimedtextUrl(baseUrl)) return "";
    const timedtext = await fetchText(
      `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}fmt=json3`,
      fetchImpl,
    );
    return timedtext ? json3ToTranscript(JSON.parse(timedtext)) : "";
  } catch {
    return "";
  }
}

export async function fetchYouTubeCaptionSegments(
  videoId: string,
  fetchImpl: FetchLike = fetch,
): Promise<YouTubeCaptionSegment[]> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const page = await fetchText(watchUrl, fetchImpl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; TechStage/1.0)" },
    });
    const player = playerResponseFromPage(page);
    const tracks = ((
      (player?.captions as Record<string, unknown> | undefined)
        ?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined
    )?.captionTracks ?? []) as CaptionTrack[];
    const track = selectCaptionTrack(tracks);
    const baseUrl = typeof track?.baseUrl === "string" ? track.baseUrl : "";
    if (!baseUrl || !isSafeTimedtextUrl(baseUrl)) return [];
    const timedtext = await fetchText(
      `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}fmt=json3`,
      fetchImpl,
    );
    return timedtext ? json3ToSegments(JSON.parse(timedtext)) : [];
  } catch {
    return [];
  }
}
