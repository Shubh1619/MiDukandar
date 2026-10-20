"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Wall-clock countdown. Stores the target deadline rather than a decrementing
 * counter so browser timer throttling (backgrounded tabs) can't make the
 * displayed time drift behind real time and let a resend fire early.
 */
export function useCountdown(initial: number) {
  const [secondsLeft, setSecondsLeft] = useState(initial);
  const [deadline, setDeadline] = useState<number | null>(() =>
    initial > 0 ? Date.now() + initial * 1000 : null,
  );

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setDeadline(null);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const reset = useCallback((seconds: number) => {
    if (seconds > 0) {
      setDeadline(Date.now() + seconds * 1000);
      setSecondsLeft(seconds);
    } else {
      setDeadline(null);
      setSecondsLeft(0);
    }
  }, []);

  return { secondsLeft, reset };
}
