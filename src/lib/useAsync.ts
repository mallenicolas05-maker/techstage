import { useEffect, useRef, useState, type DependencyList } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/** Small data-fetching hook for repository calls: loading → data | error,
    with stale-response protection and manual reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const callRef = useRef(0);

  useEffect(() => {
    const call = ++callRef.current;
    setLoading(true);
    setError(null);
    fn().then(
      (result) => {
        if (callRef.current !== call) return;
        setData(result);
        setLoading(false);
      },
      (err: unknown) => {
        if (callRef.current !== call) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}
