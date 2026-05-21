import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

// Detect if the response is HTML (static fallback) instead of JSON
function isHtmlResponse(text: string): boolean {
  return text.trim().startsWith("<") || text.trim().startsWith("<!DOCTYPE");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry if API is unreachable (static deployment without backend)
        if (error?.message?.includes("API unavailable")) return false;
        return failureCount < 2;
      },
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const token = localStorage.getItem("paylite_token");
        return {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
      },
      fetch: async (url, options) => {
        try {
          const res = await globalThis.fetch(url, {
            ...(options ?? {}),
            credentials: "include",
          });
          // Clone so we can inspect the body
          const clone = res.clone();
          const text = await clone.text();
          if (isHtmlResponse(text)) {
            throw new Error("API unavailable. This is a static frontend preview. Deploy to Vercel for full backend support.");
          }
          return res;
        } catch (err: any) {
          if (err.message?.includes("API unavailable")) {
            throw err;
          }
          // Network errors (fetch failed)
          throw new Error("API unavailable. This is a static frontend preview. Deploy to Vercel for full backend support.");
        }
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
