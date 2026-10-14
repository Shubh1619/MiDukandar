"use client";

import { useCallback, useEffect, useState } from "react";

export function useCountdown(initial: number) {
  const [secondsLeft, setSecondsLeft] = useState(initial);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const reset = useCallback((seconds: number) => setSecondsLeft(seconds), []);

  return { secondsLeft, reset };
}