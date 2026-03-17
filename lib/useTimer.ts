import { useState, useEffect } from "react";

export function useTimer(initialSeconds: number, onTimeUp?: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive || secondsLeft <= 0) {
      if (secondsLeft === 0 && onTimeUp) {
        onTimeUp();
      }
      setIsActive(false);
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsActive(false);
          if (onTimeUp) onTimeUp();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, secondsLeft, onTimeUp]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const isLowTime = secondsLeft <= 60; // Red warning at 1 min

  return { secondsLeft, formattedTime, isLowTime, isActive };
}
