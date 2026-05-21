import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { transactions, walletBalancesCache } from "@db/schema";
import { eq } from "drizzle-orm";

export const webhookRouter = createRouter({
  cashInComplete: publicQuery
    .input(
      z.object({
        transactionRef: z.string(),
        providerRef: z.string(),
        status: z.enum(["success", "failed"]),
        amount: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.transactionRef, input.transactionRef),
      });

      if (!tx) {
        return { received: true, note: "Transaction not found" };
      }

      if (input.status === "success") {
        await db.transaction(async (txDb) => {
          await txDb
            .update(transactions)
            .set({ status: "SETTLED" })
            .where(eq(transactions.id, tx.id));

          if (tx.toWalletId) {
            const cache = await txDb.query.walletBalancesCache.findFirst({
              where: eq(walletBalancesCache.walletId, tx.toWalletId),
            });
            const available = parseFloat(cache?.availableBalance || "0");
            const newBalance = (available + parseFloat(input.amount)).toFixed(2);

            await txDb
              .update(walletBalancesCache)
              .set({ availableBalance: newBalance, bookBalance: newBalance })
              .where(eq(walletBalancesCache.walletId, tx.toWalletId));
          }
        });
      } else {
        await db
          .update(transactions)
          .set({ status: "FAILED" })
          .where(eq(transactions.id, tx.id));
      }

      return { received: true };
    }),

  cashOutComplete: publicQuery
    .input(
      z.object({
        transactionRef: z.string(),
        providerRef: z.string(),
        status: z.enum(["success", "failed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.transactionRef, input.transactionRef),
      });

      if (!tx) {
        return { received: true, note: "Transaction not found" };
      }

      await db
        .update(transactions)
        .set({ status: input.status === "success" ? "SETTLED" : "FAILED" })
        .where(eq(transactions.id, tx.id));

      return { received: true };
    }),
});
