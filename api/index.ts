import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";

// Vercel serverless entry point
const app = new Hono();

// CORS for Vercel deployment
app.use(
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    exposeHeaders: ["Set-Cookie"],
  })
);

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Health check
app.get("/api/ping", (c) => c.json({ ok: true, ts: Date.now(), env: "vercel" }));

// tRPC handler - catches all /api/trpc/* requests
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// API fallback
app.all("/api/*", (c) => c.json({ error: "API route not found" }, 404));

// Default export for Vercel serverless
export default app;
