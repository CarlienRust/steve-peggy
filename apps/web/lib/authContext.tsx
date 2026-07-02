"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setAccessTokenProvider } from "@/lib/api";
import { saveActiveWorkspaceId } from "@/lib/userProfile";

type AuthContextValue = {
  ready: boolean;
  userId: string | null;
};

const AuthContext = createContext<AuthContextValue>({ ready: false, userId: null });

export function AuthSessionBridge({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthContextValue>({ ready: false, userId: null });

  useEffect(() => {
    const supabase = createClient();

    setAccessTokenProvider(async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });

    const syncUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      setState({ ready: true, userId: userData.user?.id ?? null });
    };

    void syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id ?? null;
      setState({ ready: true, userId });

      if (event === "SIGNED_OUT") {
        saveActiveWorkspaceId(null);
        queryClient.clear();
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void queryClient.invalidateQueries();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo(() => state, [state.ready, state.userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  return useContext(AuthContext);
}
