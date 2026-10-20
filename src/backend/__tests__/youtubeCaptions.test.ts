import { describe, expect, it } from "vitest";
import {
  isSafeTimedtextUrl,
  json3ToTranscript,
  playerResponseFromPage,
  selectCaptionTrack,
  youTubeVideoIdFrom,
} from "../../../supabase/functions/_shared/youtube-captions.ts";

describe("YouTube caption helpers", () => {
  it("prefers English manual captions", () => {
    const selected = selectCaptionTrack([
      { languageCode: "fr", kind: "asr" },
      { languageCode: "en", kind: "asr" },
      { languageCode: "en-GB" },
    ]);
    expect(selected?.languageCode).toBe("en-GB");
  });

  it("converts json3 captions into compact timestamped text", () => {
    expect(
      json3ToTranscript({
        events: [
          { tStartMs: 0, segs: [{ utf8: "Hello " }, { utf8: "world" }] },
          { tStartMs: 31_000, segs: [{ utf8: "Next section" }] },
          { tStartMs: 32_000, aAppend: 1, segs: [{ utf8: "duplicate" }] },
        ],
      }),
    ).toBe("[0:00:00] Hello world [0:00:31] Next section");
  });

  it("accepts only safe YouTube timedtext URLs and valid video ids", () => {
    expect(
      isSafeTimedtextUrl("https://www.youtube.com/api/timedtext?v=abc"),
    ).toBe(true);
    expect(
      isSafeTimedtextUrl("http://www.youtube.com/api/timedtext?v=abc"),
    ).toBe(false);
    expect(isSafeTimedtextUrl("https://example.com/api/timedtext")).toBe(false);
    expect(youTubeVideoIdFrom("https://youtu.be/abcDEF12345")).toBe(
      "abcDEF12345",
    );
    expect(
      youTubeVideoIdFrom("https://example.com/watch?v=abcDEF12345"),
    ).toBeNull();
  });

  it("reads a complete player response when nested objects contain braces", () => {
    const page = `<script>var ytInitialPlayerResponse = {"videoDetails":{"title":"A {real} title"},"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=abc","languageCode":"en"}]}}};</script>`;
    const response = playerResponseFromPage(page);
    expect((response?.videoDetails as { title?: string }).title).toBe(
      "A {real} title",
    );
  });
});
