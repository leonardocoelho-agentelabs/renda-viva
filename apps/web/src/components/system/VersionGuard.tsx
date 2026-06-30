"use client";

import { useEffect } from "react";

const RELOAD_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutos

export function VersionGuard() {
  useEffect(() => {
    const KEY = "rv_last_active";

    const checkStaleSession = () => {
      const last = sessionStorage.getItem(KEY);
      const now = Date.now();

      if (last && now - Number(last) > RELOAD_THRESHOLD_MS) {
        sessionStorage.setItem(KEY, String(now));
        window.location.reload();
        return;
      }

      sessionStorage.setItem(KEY, String(now));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkStaleSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    checkStaleSession();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
