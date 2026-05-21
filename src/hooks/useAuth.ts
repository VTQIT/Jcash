import { useCallback } from "react";
import { trpc } from "@/providers/trpc";

export interface AuthUser {
  id: number;
  phoneNumber: string;
  fullName: string | null;
  email: string | null;
  kycLevel: number;
  kycStatus: string;
  role: string;
  status: string;
  walletNumber: string | null;
}

export function useAuth() {
  const utils = trpc.useUtils();
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(() => {
    localStorage.removeItem("paylite_token");
    utils.auth.me.invalidate();
    window.location.href = "/login";
  }, [utils]);

  const isAdmin = user?.role === "admin";
  const isPending = user?.status === "PENDING";
  const isActive = user?.status === "ACTIVE";

  return {
    user: user as AuthUser | undefined,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    isPending,
    isActive,
    logout,
  };
}
