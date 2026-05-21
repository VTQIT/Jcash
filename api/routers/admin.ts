import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  users,
  walletAccounts,
  walletBalancesCache,
  transactions,
  ledgerEntries,
  dailyLimits,
  freezeLogs,
  reconciliationLogs,
} from "@db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";

function getInsertId(result: any): number {
  return Number(result[0]?.insertId || 0);
}

export const adminRouter = createRouter({
  dashboardStats: adminQuery.query(async () => {
    const db = getDb();

    const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [activeWalletsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(walletAccounts)
      .where(eq(walletAccounts.status, "ACTIVE"));
    const [pendingKycResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.kycStatus, "PENDING"));
    const [pendingUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.status, "PENDING"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayVolumeResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(gte(transactions.createdAt, today));

    return {
      totalUsers: totalUsersResult.count,
      activeWallets: activeWalletsResult.count,
      todayVolume: todayVolumeResult.total,
      pendingKyc: pendingKycResult.count,
      pendingUsers: pendingUsersResult.count,
    };
  }),

  kycQueue: adminQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(20),
          offset: z.number().default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 20;
      const offset = input?.offset || 0;

      const conditions = [sql`${users.kycStatus} IN ('PENDING', 'REJECTED')`];
      if (input?.status) {
        conditions.push(eq(users.kycStatus, input.status as any));
      }

      const kycUsers = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          phoneNumber: users.phoneNumber,
          kycStatus: users.kycStatus,
          kycSubmittedAt: users.kycSubmittedAt,
          idType: users.idType,
        })
        .from(users)
        .where(and(...conditions))
        .orderBy(desc(users.kycSubmittedAt))
        .limit(limit)
        .offset(offset);

      return kycUsers;
    }),

  reviewKyc: adminQuery
    .input(
      z.object({
        userId: z.number(),
        decision: z.enum(["APPROVE", "REJECT"]),
        level: z.number().optional(),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const updateData: any = {
        kycReviewedAt: new Date(),
        kycReviewerId: ctx.user.id,
      };

      if (input.decision === "APPROVE") {
        updateData.kycStatus = "APPROVED";
        updateData.kycLevel = input.level || 2;
      } else {
        updateData.kycStatus = "REJECTED";
        updateData.kycRejectionReason = input.rejectionReason || "Documents do not meet requirements";
      }

      await db.update(users).set(updateData).where(eq(users.id, input.userId));

      return { success: true };
    }),

  kycDetail: adminQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      return {
        userId: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        kycStatus: user.kycStatus,
        kycLevel: user.kycLevel,
        submittedAt: user.kycSubmittedAt,
        reviewedAt: user.kycReviewedAt,
        nationality: user.nationality,
        dateOfBirth: user.dateOfBirth,
        homeAddress: user.homeAddress,
        sourceOfFunds: user.sourceOfFunds,
        idType: user.idType,
        idNumber: user.idNumber,
        idFrontUrl: user.idFrontUrl,
        idBackUrl: user.idBackUrl,
        selfieUrl: user.selfieUrl,
      };
    }),

  users: adminQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          limit: z.number().default(20),
          offset: z.number().default(0),
          status: z.string().optional(),
          kycLevel: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 20;
      const offset = input?.offset || 0;

      const allUsers = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          phoneNumber: users.phoneNumber,
          kycLevel: users.kycLevel,
          kycStatus: users.kycStatus,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      return allUsers;
    }),

  userDetail: adminQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      const wallet = await db.query.walletAccounts.findFirst({
        where: eq(walletAccounts.userId, input.userId),
      });

      let balance = null;
      if (wallet) {
        balance = await db.query.walletBalancesCache.findFirst({
          where: eq(walletBalancesCache.walletId, wallet.id),
        });
      }

      return {
        ...user,
        wallet: wallet
          ? { ...wallet, balance: balance?.availableBalance || "0.00" }
          : null,
      };
    }),

  freezeWallet: adminQuery
    .input(z.object({ walletId: z.number(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      await db
        .update(walletAccounts)
        .set({
          status: "FROZEN",
          freezeReason: input.reason,
          frozenBy: ctx.user.id,
          frozenAt: new Date(),
        })
        .where(eq(walletAccounts.id, input.walletId));

      await db.insert(freezeLogs).values({
        walletId: input.walletId,
        action: "FREEZE",
        reason: input.reason,
        performedBy: ctx.user.id,
      });

      return { success: true };
    }),

  unfreezeWallet: adminQuery
    .input(z.object({ walletId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      await db
        .update(walletAccounts)
        .set({
          status: "ACTIVE",
          freezeReason: null,
          frozenBy: null,
          frozenAt: null,
        })
        .where(eq(walletAccounts.id, input.walletId));

      await db.insert(freezeLogs).values({
        walletId: input.walletId,
        action: "UNFREEZE",
        performedBy: ctx.user.id,
      });

      return { success: true };
    }),

  transactions: adminQuery
    .input(
      z
        .object({
          limit: z.number().default(50),
          offset: z.number().default(0),
          status: z.string().optional(),
          type: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;

      const txs = await db
        .select()
        .from(transactions)
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset);

      return txs;
    }),

  reverseTransaction: adminQuery
    .input(z.object({ transactionId: z.number(), reason: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, input.transactionId),
      });

      if (!tx) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      if (tx.status === "REVERSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction already reversed" });
      }

      const txAge = Date.now() - (tx.createdAt?.getTime() || 0);
      if (txAge > 24 * 60 * 60 * 1000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reversal window closed (24h)" });
      }

      await db.transaction(async (txDb) => {
        const reversalRef = `REV-${tx.transactionRef}`;
        const revResult = await txDb.insert(transactions).values({
          transactionRef: reversalRef,
          type: "REVERSAL",
          status: "POSTED",
          fromWalletId: tx.toWalletId,
          toWalletId: tx.fromWalletId,
          amount: tx.amount,
          fee: "0.00",
          description: `Reversal: ${input.reason}`,
          reversalOfId: tx.id,
        });

        const reversalId = getInsertId(revResult);

        const originalEntries = await txDb
          .select()
          .from(ledgerEntries)
          .where(eq(ledgerEntries.transactionId, tx.id));

        for (const entry of originalEntries) {
          const reverseType = entry.entryType === "DEBIT" ? "CREDIT" : "DEBIT";

          const currentCache = await txDb.query.walletBalancesCache.findFirst({
            where: eq(walletBalancesCache.walletId, entry.walletId),
          });
          const current = parseFloat(currentCache?.availableBalance || "0");
          const adjustment = parseFloat(tx.amount);
          const newBalance =
            reverseType === "CREDIT"
              ? (current + adjustment).toFixed(2)
              : (current - adjustment).toFixed(2);

          await txDb.insert(ledgerEntries).values({
            transactionId: reversalId,
            walletId: entry.walletId,
            entryType: reverseType,
            amount: tx.amount,
            runningBalance: newBalance,
            entrySequence: entry.entrySequence,
          });

          await txDb
            .update(walletBalancesCache)
            .set({ availableBalance: newBalance, bookBalance: newBalance })
            .where(eq(walletBalancesCache.walletId, entry.walletId));
        }

        await txDb
          .update(transactions)
          .set({ status: "REVERSED", reversedAt: new Date() })
          .where(eq(transactions.id, tx.id));
      });

      return { success: true };
    }),

  ledgerExplorer: adminQuery
    .input(
      z
        .object({
          walletId: z.number().optional(),
          transactionId: z.number().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;

      const conditions = [];
      if (input?.walletId) {
        conditions.push(eq(ledgerEntries.walletId, input.walletId));
      }
      if (input?.transactionId) {
        conditions.push(eq(ledgerEntries.transactionId, input.transactionId));
      }

      const entries = await db
        .select({
          id: ledgerEntries.id,
          transactionId: ledgerEntries.transactionId,
          walletId: ledgerEntries.walletId,
          entryType: ledgerEntries.entryType,
          amount: ledgerEntries.amount,
          runningBalance: ledgerEntries.runningBalance,
          entrySequence: ledgerEntries.entrySequence,
          createdAt: ledgerEntries.createdAt,
          transactionRef: transactions.transactionRef,
          transactionType: transactions.type,
        })
        .from(ledgerEntries)
        .leftJoin(transactions, eq(ledgerEntries.transactionId, transactions.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(ledgerEntries.createdAt))
        .limit(limit)
        .offset(offset);

      return entries;
    }),

  reconciliation: adminQuery
    .input(z.object({ walletId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();

      const wallets = input?.walletId
        ? await db
            .select()
            .from(walletAccounts)
            .where(eq(walletAccounts.id, input.walletId))
        : await db.select().from(walletAccounts);

      const results = [];
      for (const wallet of wallets) {
        const [ledgerResult] = await db
          .select({
            credits: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'CREDIT' THEN ${ledgerEntries.amount} ELSE 0 END), 0)`,
            debits: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'DEBIT' THEN ${ledgerEntries.amount} ELSE 0 END), 0)`,
          })
          .from(ledgerEntries)
          .where(eq(ledgerEntries.walletId, wallet.id));

        const ledgerBalance = (
          parseFloat(ledgerResult.credits) - parseFloat(ledgerResult.debits)
        ).toFixed(2);

        const cache = await db.query.walletBalancesCache.findFirst({
          where: eq(walletBalancesCache.walletId, wallet.id),
        });

        const cachedBalance = cache?.availableBalance || "0.00";
        const difference = (parseFloat(ledgerBalance) - parseFloat(cachedBalance)).toFixed(2);

        results.push({
          walletId: wallet.id,
          walletNumber: wallet.walletNumber,
          ledgerBalance,
          cachedBalance,
          difference,
          status: difference === "0.00" ? "MATCHED" : "MISMATCHED",
        });
      }

      return results;
    }),

  runReconciliation: adminQuery
    .input(z.object({ walletId: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const wallets = input?.walletId
        ? await db
            .select()
            .from(walletAccounts)
            .where(eq(walletAccounts.id, input.walletId))
        : await db.select().from(walletAccounts);

      const results = [];
      for (const wallet of wallets) {
        const [ledgerResult] = await db
          .select({
            credits: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'CREDIT' THEN ${ledgerEntries.amount} ELSE 0 END), 0)`,
            debits: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'DEBIT' THEN ${ledgerEntries.amount} ELSE 0 END), 0)`,
          })
          .from(ledgerEntries)
          .where(eq(ledgerEntries.walletId, wallet.id));

        const ledgerBalance = (
          parseFloat(ledgerResult.credits) - parseFloat(ledgerResult.debits)
        ).toFixed(2);

        const cache = await db.query.walletBalancesCache.findFirst({
          where: eq(walletBalancesCache.walletId, wallet.id),
        });

        const cachedBalance = cache?.availableBalance || "0.00";
        const difference = (parseFloat(ledgerBalance) - parseFloat(cachedBalance)).toFixed(2);

        if (difference !== "0.00") {
          await db
            .update(walletBalancesCache)
            .set({ availableBalance: ledgerBalance, bookBalance: ledgerBalance })
            .where(eq(walletBalancesCache.walletId, wallet.id));
        }

        await db.insert(reconciliationLogs).values({
          walletId: wallet.id,
          ledgerBalance,
          cachedBalance,
          difference,
          status: difference === "0.00" ? "MATCHED" : "MISMATCHED",
          performedBy: ctx.user.id,
        });

        results.push({
          walletId: wallet.id,
          ledgerBalance,
          cachedBalance,
          difference,
          status: difference === "0.00" ? "MATCHED" : "MISMATCHED",
        });
      }

      return results;
    }),

  limits: adminQuery.query(async () => {
    const db = getDb();
    const limits = await db
      .select()
      .from(dailyLimits)
      .where(eq(dailyLimits.userId, 0))
      .orderBy(dailyLimits.kycLevel);
    return limits;
  }),

  updateLimits: adminQuery
    .input(
      z.object({
        kycLevel: z.number(),
        dailyTransferCap: z.string(),
        dailyCashOutCap: z.string(),
        maxTransactionAmount: z.string(),
        monthlyCap: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      await db
        .update(dailyLimits)
        .set({
          dailyTransferCap: input.dailyTransferCap,
          dailyCashOutCap: input.dailyCashOutCap,
          maxTransactionAmount: input.maxTransactionAmount,
          monthlyCap: input.monthlyCap,
        })
        .where(and(eq(dailyLimits.kycLevel, input.kycLevel), eq(dailyLimits.userId, 0)));

      return { success: true };
    }),

  pendingUsers: adminQuery
    .input(
      z
        .object({ limit: z.number().default(50), offset: z.number().default(0) })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;

      const pendingUsersList = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          phoneNumber: users.phoneNumber,
          kycLevel: users.kycLevel,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.status, "PENDING"))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      return pendingUsersList;
    }),

  approveUser: adminQuery
    .input(z.object({ userId: z.number(), action: z.enum(["APPROVE", "REJECT"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (user.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User is not pending approval" });
      }

      const newStatus = input.action === "APPROVE" ? "ACTIVE" : "SUSPENDED";

      await db
        .update(users)
        .set({ status: newStatus })
        .where(eq(users.id, input.userId));

      return { success: true, status: newStatus };
    }),

  freezeLogs: adminQuery
    .input(z.object({ walletId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();

      const logs = input?.walletId
        ? await db
            .select()
            .from(freezeLogs)
            .where(eq(freezeLogs.walletId, input.walletId))
            .orderBy(desc(freezeLogs.createdAt))
        : await db
            .select()
            .from(freezeLogs)
            .orderBy(desc(freezeLogs.createdAt))
            .limit(50);

      return logs;
    }),
});
