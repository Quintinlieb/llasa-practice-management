import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const HEARTBEAT_INTERVAL_MS = 30_000;

export function useUserPresence(user: User | null | undefined) {
  const updateErrorLoggedRef = useRef(false);

  const writePresence = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.functions.invoke("update-user-presence-manual", { body: {} });
      if (error) throw error;
      updateErrorLoggedRef.current = false;
    } catch (error) {
      if (!updateErrorLoggedRef.current) {
        updateErrorLoggedRef.current = true;
        console.error("Failed to update user presence", error);
      }
      // Presence should never interrupt normal app usage.
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    void writePresence();
    const timer = window.setInterval(() => {
      void writePresence();
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisible = () => {
      if (document.visibilityState !== "hidden") void writePresence();
    };
    window.addEventListener("focus", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [user?.id, writePresence]);
}
