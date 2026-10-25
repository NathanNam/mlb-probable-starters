import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
  retry: () => void;
}

/** Runs `fn` whenever `key` changes (null = idle). Results for stale keys are dropped. */
export function useAsync<T>(key: string | null, fn: () => Promise<T>): AsyncState<T> {
  const fnRef = useRef(fn);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string | null; data?: T; error?: unknown }>({ key: null });
  const fullKey = key === null ? null : `${key}#${attempt}`;

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (fullKey === null) return;
    let alive = true;
    fnRef.current().then(
      (data) => alive && setState({ key: fullKey, data }),
      (error) => alive && setState({ key: fullKey, error })
    );
    return () => {
      alive = false;
    };
  }, [fullKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = state.key === fullKey && fullKey !== null;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: fullKey !== null && !current,
    retry,
  };
}
