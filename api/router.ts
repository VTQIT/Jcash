import { authRouter } from "./routers/auth";
import { kycRouter } from "./routers/kyc";
import { walletRouter } from "./routers/wallet";
import { adminRouter } from "./routers/admin";
import { webhookRouter } from "./routers/webhook";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  kyc: kycRouter,
  wallet: walletRouter,
  admin: adminRouter,
  webhook: webhookRouter,
});

export type AppRouter = typeof appRouter;
