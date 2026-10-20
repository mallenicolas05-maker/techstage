import { requireFreeAssetProvider, requireProvider, type ProviderAccess } from "./runtime.ts";
import { toGeminiResponseSchema } from "./prompts.ts";

const withTimeout = (milliseconds = 120_000) => AbortSignal.timeout(milliseconds);

async function checkedFetch(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, signal: init.signal ?? withTimeout() });
  if (!response.ok) {
    const detail = (await response.clone().text()).replace(/\s+/g, " ").slice(0, 500);
    throw new Error(`Provider request failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response;
}

export async function listYouTubeUploads(playlistId: string, pageToken?: string, access: ProviderAccess = "legacy") {
  const { YOUTUBE_API_KEY } = requireProvider("youtube", ["YOUTUBE_API_KEY"], access);
  const params = new URLSearchParams({ part: "snippet,contentDetails", playlistId, maxResults: "50", key: YOUTUBE_API_KEY });
  if (pageToken) params.set("pageToken", pageToken);
  return (await checkedFetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, { method: "GET" })).json();
}

export async function listYouTubeVideoDetails(videoIds: string[], access: ProviderAccess = "legacy") {
  const { YOUTUBE_API_KEY } = requireProvider("youtube", ["YOUTUBE_API_KEY"], access);
  const params = new URLSearchParams({ part: "snippet,contentDetails,liveStreamingDetails,status", id: videoIds.slice(0, 50).join(","), key: YOUTUBE_API_KEY });
  return (await checkedFetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, { method: "GET" })).json();
}

export async function listYouTubeChannels(channelIds: string[], access: ProviderAccess = "legacy") {
  const { YOUTUBE_API_KEY } = requireProvider("youtube", ["YOUTUBE_API_KEY"], access);
  const params = new URLSearchParams({ part: "snippet,contentDetails", id: channelIds.slice(0, 50).join(","), maxResults: "50", key: YOUTUBE_API_KEY });
  return (await checkedFetch(`https://www.googleapis.com/youtube/v3/channels?${params}`, { method: "GET" })).json();
}

export async function searchYouTubeVideos(
  query: string,
  publishedAt?: string | null,
  access: ProviderAccess = "legacy",
  pageToken?: string | null,
  maxResults = 50,
) {
  const { YOUTUBE_API_KEY } = requireProvider("youtube", ["YOUTUBE_API_KEY"], access);
  const params = new URLSearchParams({
    part: "snippet",
    q: query.slice(0, 300),
    type: "video",
    maxResults: String(Math.max(1, Math.min(50, maxResults))),
    order: "relevance",
    videoEmbeddable: "true",
    relevanceLanguage: "en",
    key: YOUTUBE_API_KEY,
  });
  if (publishedAt) {
    const center = new Date(publishedAt);
    const before = new Date(center.getTime() + 120 * 86_400_000);
    const after = new Date(center.getTime() - 120 * 86_400_000);
    params.set("publishedAfter", after.toISOString());
    params.set("publishedBefore", before.toISOString());
  }
  if (pageToken) params.set("pageToken", pageToken);
  return (await checkedFetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { method: "GET" })).json();
}

/** Channel search is deliberately separate from video search: it spends one of
 * the scarce daily search calls, but lets source coverage grow without
 * guessing a channel from a video title. */
export async function searchYouTubeChannels(query: string, access: ProviderAccess = "legacy") {
  const { YOUTUBE_API_KEY } = requireProvider("youtube", ["YOUTUBE_API_KEY"], access);
  const params = new URLSearchParams({
    part: "snippet", q: query.slice(0, 300), type: "channel", maxResults: "25",
    order: "relevance", relevanceLanguage: "en", key: YOUTUBE_API_KEY,
  });
  return (await checkedFetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { method: "GET" })).json();
}

export async function listYouTubeUpcoming(channelId: string, publishedBefore: string, access: ProviderAccess = "legacy") {
  const { YOUTUBE_API_KEY } = requireProvider("youtube", ["YOUTUBE_API_KEY"], access);
  const params = new URLSearchParams({ part: "snippet", channelId, eventType: "upcoming", type: "video", order: "date", maxResults: "50", publishedBefore, key: YOUTUBE_API_KEY });
  return (await checkedFetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { method: "GET" })).json();
}

export async function renewYouTubeWebSub(channelId: string, callbackUrl: string, callbackSecret: string, access: ProviderAccess = "legacy") {
  requireProvider("youtube", ["YOUTUBE_API_KEY"], access);
  const form = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.callback": callbackUrl,
    "hub.topic": `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
    "hub.verify": "async",
    "hub.secret": callbackSecret,
  });
  await checkedFetch("https://pubsubhubbub.appspot.com/subscribe", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
}

export async function searchTavily(query: string, access: ProviderAccess = "legacy") {
  const { TAVILY_API_KEY } = requireProvider("tavily", ["TAVILY_API_KEY"], access);
  return (await checkedFetch("https://api.tavily.com/search", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_API_KEY, query, search_depth: "basic", max_results: 10, include_raw_content: false }),
  })).json();
}

export async function runParallelTask(url: string, access: ProviderAccess = "legacy") {
  const { PARALLEL_API_KEY } = requireProvider("parallel", ["PARALLEL_API_KEY"], access);
  return (await checkedFetch("https://api.parallel.ai/v1/tasks/runs", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": PARALLEL_API_KEY },
    body: JSON.stringify({ input: `Extract only public event sessions from ${url}`, processor: "lite" }),
  })).json();
}

export async function analyzeWithGemini(model: string, contents: unknown, responseSchema: unknown, access: ProviderAccess = "legacy") {
  const { GEMINI_API_KEY } = requireProvider("gemini", ["GEMINI_API_KEY"], access);
  return (await checkedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiResponseSchema(responseSchema), mediaResolution: "MEDIA_RESOLUTION_LOW", maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "minimal" } } }),
  })).json();
}

export async function analyzeTranscriptWithOpenAI(prompt: string, transcript: string, responseSchema: unknown, access: ProviderAccess = "legacy") {
  const { OPENAI_API_KEY } = requireProvider("openai", ["OPENAI_API_KEY"], access);
  return (await checkedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-5-nano",
      input: [{
        role: "user",
        content: [{ type: "input_text", text: `${prompt}\n\nTRANSCRIPT:\n${transcript}` }],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "techstage_analysis",
          strict: true,
          schema: responseSchema,
        },
      },
      reasoning: { effort: "minimal" },
      max_output_tokens: 4096,
      store: false,
    }),
  })).json();
}

export async function searchXWithGrok(prompt: string, access: ProviderAccess = "legacy", enableVideoUnderstanding = false) {
  const { XAI_API_KEY } = requireProvider("xai", ["XAI_API_KEY"], access);
  return (await checkedFetch("https://api.x.ai/v1/responses", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${XAI_API_KEY}` },
    body: JSON.stringify({
      model: "grok-4.3",
      input: prompt,
      tools: [{ type: "x_search", enable_video_understanding: enableVideoUnderstanding }],
      max_turns: 3,
      max_output_tokens: 1800,
    }),
  })).json();
}

export async function searchPexels(query: string) {
  const { PEXELS_API_KEY } = requireFreeAssetProvider("pexels", ["PEXELS_API_KEY"]);
  const params = new URLSearchParams({ query, per_page: "15", orientation: "landscape" });
  return (await checkedFetch(`https://api.pexels.com/v1/search?${params}`, { method: "GET", headers: { authorization: PEXELS_API_KEY } })).json();
}

export async function searchPixabay(query: string) {
  const { PIXABAY_API_KEY } = requireFreeAssetProvider("pixabay", ["PIXABAY_API_KEY"]);
  const params = new URLSearchParams({ key: PIXABAY_API_KEY, q: query, per_page: "15", image_type: "photo", orientation: "horizontal", safesearch: "true" });
  return (await checkedFetch(`https://pixabay.com/api/?${params}`, { method: "GET" })).json();
}

export async function sendResendEmail(message: { to: string; subject: string; text: string }) {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = requireProvider("resend", ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]);
  return (await checkedFetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [message.to], subject: message.subject, text: message.text }),
  })).json();
}
