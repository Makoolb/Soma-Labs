import { useState, useEffect } from "react";

export function useElapsedTime() {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return { secondsElapsed, formattedTime };
}
