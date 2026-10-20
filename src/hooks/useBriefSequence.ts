import { useEffect, useMemo, useState } from "react";

export const BRIEF_STEPS = [
  "Load transcript",
  "Read transcript",
  "Extract takeaways",
  "Scan premium signals",
  "Compose brief",
  "Done · saved to this talk",
] as const;

/* Rotating "the agent is thinking" cues shown under the running step —
   the QuantPad-style tells that work is really happening. */
export const BRIEF_THINKING: string[][] = [
  ["opening the verified captions…", "checking segment integrity…"],
  ["reading line by line…", "following the speakers…", "marking claims worth keeping…"],
  ["deciphering the strongest claims…", "weighing evidence against timestamps…", "keeping only what was actually said…"],
  ["delegating to signal scanners…", "testing each premium angle…", "cross-checking companies mentioned…"],
  ["composing the dossier…", "ordering sections by usefulness…", "attaching timestamps…"],
  ["saving to this talk…"],
];

/* Stage windows across the run. "Read transcript" owns the largest
   share so the ride-along is legible, and "Compose brief" gets
   enough room for the stream to be readable. */
const thresholds = [0, 0.06, 0.4, 0.58, 0.74, 0.96];

export function useBriefSequence(active: boolean, segmentCount: number, replayKey = 0, duration = 20000) {
  const [progress, setProgress] = useState(0);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    if (!active) return;
    if (reducedMotion) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.min(1, (performance.now() - started) / duration);
      setProgress(next);
      if (next >= 1) window.clearInterval(timer);
    }, 70);
    return () => window.clearInterval(timer);
  }, [active, replayKey, duration, reducedMotion]);

  const stageIndex = thresholds.reduce((last, threshold, index) => progress >= threshold ? index : last, 0);
  const transcriptProgress = Math.max(0, Math.min(1, (progress - thresholds[1]) / (thresholds[2] - thresholds[1])));
  const elapsedMs = progress * duration;
  const thinkingPool = BRIEF_THINKING[stageIndex] ?? [];
  return {
    progress,
    stageIndex,
    done: progress >= 1,
    transcriptIndex: Math.min(Math.max(0, segmentCount - 1), Math.floor(transcriptProgress * segmentCount)),
    takeawayCount: Math.max(0, Math.min(3, Math.floor((progress - thresholds[2]) * 18))),
    signalIndex: Math.max(0, Math.min(5, Math.floor((progress - thresholds[3]) * 30))),
    streamProgress: Math.max(0, Math.min(1, (progress - thresholds[4]) / (thresholds[5] - thresholds[4]))),
    thinking: thinkingPool.length ? thinkingPool[Math.floor(elapsedMs / 1600) % thinkingPool.length] : "",
  };
}

export function useStreamingText(text: string, progress: number) {
  return text.slice(0, Math.floor(text.length * Math.max(0, Math.min(1, progress))));
}
