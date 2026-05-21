import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, activeQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  users,
  walletAccounts,
  walletBalancesCache,
  transactions,
  ledgerEntries,
  dailyLimits,
  limitUsage,
  transactionRequests,
} from "@db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { verifyPin, generateTransactionRef, generateIdempotencyKey } from "../lib/crypto";

function getInsertId(result: any): number {
  return Number(result[0]?.insertId || 0);
}

function todayDate(): Date {
  return new Date();
}

export const walletRouter = createRouter({
  balance: activeQuery.query(async ({ ctx }) => {
    const db = getDb();

    const wallet = await db.query.walletAccounts.findFirst({
      where: eq(walletAccounts.userId, ctx.user.id),
    });

    if (!wallet) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Wallet not found" });
    }

    const balance = await db.query.walletBalancesCache.findFirst({
      where: eq(walletBalancesCache.walletId, wallet.id),
    });

    return {
      available: balance?.availableBalance || "0.00",
      book: balance?.bookBalance || "0.00",
      walletNumber: wallet.walletNumber,
      walletId: wallet.id,
      status: wallet.status,
    };
  }),

  send: activeQuery
    .input(
      z.object({
        toWalletNumber: z.string(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        pin: z.string().regex(/^\d{6}$/),
        idempotencyKey: z.string().optional(),
        purpose: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const amount = parseFloat(input.amount);

      if (amount <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Amount must be positive" });
      }

      const senderUser = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });

      if (!senderUser?.pinHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "PIN not set" });
      }

      const pinValid = await verifyPin(input.pin, senderUser.pinHash);
      if (!pinValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid PIN" });
      }

      if (senderUser.kycLevel < 2) {
        throw new TRPCError({ code: "FORBIDDEN", message: "KYC verification required for transfers" });
      }

      const senderWallet = await db.query.walletAccounts.findFirst({
        where: eq(walletAccounts.userId, ctx.user.id),
      });

      if (!senderWallet) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sender wallet not found" });
      }

      if (senderWallet.status === "FROZEN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Wallet is frozen" });
      }

      const recipientWallet = await db.query.walletAccounts.findFirst({
        where: eq(walletAccounts.walletNumber, input.toWalletNumber),
      });

      if (!recipientWallet) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipient wallet not found" });
      }

      if (recipientWallet.status !== "ACTIVE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Recipient wallet is not active" });
      }

      const senderBalance = await db.query.walletBalancesCache.findFirst({
        where: eq(walletBalancesCache.walletId, senderWallet.id),
      });

      const availableBalance = parseFloat(senderBalance?.availableBalance || "0");
      if (availableBalance < amount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }

      const limit = await db.query.dailyLimits.findFirst({
        where: and(
          eq(dailyLimits.kycLevel, senderUser.kycLevel),
          eq(dailyLimits.userId, 0)
        ),
      });

      if (limit) {
        const maxTx = parseFloat(limit.maxTransactionAmount);
        if (amount > maxTx) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Maximum transaction amount is ${limit.maxTransactionAmount}`,
          });
        }

        const today = todayDate();
        const usage = await db.query.limitUsage.findFirst({
          where: and(
            eq(limitUsage.walletId, senderWallet.id),
            eq(limitUsage.usageDate, today)
          ),
        });

        const transferUsed = parseFloat(usage?.transferUsed || "0");
        const dailyCap = parseFloat(limit.dailyTransferCap);
        if (transferUsed + amount > dailyCap) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Daily transfer cap exceeded. Remaining: ${(dailyCap - transferUsed).toFixed(2)}`,
          });
        }
      }

      const idemKey = input.idempotencyKey || generateIdempotencyKey();
      const existingRequest = await db.query.transactionRequests.findFirst({
        where: eq(transactionRequests.idempotencyKey, idemKey),
      });

      if (existingRequest) {
        if (existingRequest.status === "COMPLETED" && existingRequest.transactionId) {
          const tx = await db.query.transactions.findFirst({
            where: eq(transactions.id, existingRequest.transactionId),
          });
          return tx;
        }
        if (existingRequest.status === "PENDING") {
          throw new TRPCError({ code: "CONFLICT", message: "Transaction already in progress" });
        }
      }

      await db.insert(transactionRequests).values({
        idempotencyKey: idemKey,
        walletId: senderWallet.id,
        requestType: "SEND",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const transactionRef = generateTransactionRef();

      await db.transaction(async (txDb) => {
        const txResult = await txDb.insert(transactions).values({
          transactionRef,
          idempotencyKey: idemKey,
          type: "SEND",
          status: "POSTED",
          fromWalletId: senderWallet.id,
          toWalletId: recipientWallet.id,
          amount: input.amount,
          fee: "0.00",
          description: input.description || `Send to ${input.toWalletNumber}`,
          purpose: input.purpose || "Payment",
        });

        const transactionId = getInsertId(txResult);

        const newSenderBalance = (availableBalance - amount).toFixed(2);
        await txDb.insert(ledgerEntries).values({
          transactionId,
          walletId: senderWallet.id,
          entryType: "DEBIT",
          amount: input.amount,
          runningBalance: newSenderBalance,
          entrySequence: 1,
        });

        const recipientBalance = await txDb.query.walletBalancesCache.findFirst({
          where: eq(walletBalancesCache.walletId, recipientWallet.id),
        });
        const recipientAvailable = parseFloat(recipientBalance?.availableBalance || "0");
        const newRecipientBalance = (recipientAvailable + amount).toFixed(2);

        await txDb.insert(ledgerEntries).values({
          transactionId,
          walletId: recipientWallet.id,
          entryType: "CREDIT",
          amount: input.amount,
          runningBalance: newRecipientBalance,
          entrySequence: 2,
        });

        await txDb
          .update(walletBalancesCache)
          .set({ availableBalance: newSenderBalance, bookBalance: newSenderBalance })
          .where(eq(walletBalancesCache.walletId, senderWallet.id));

        await txDb
          .update(walletBalancesCache)
          .set({
            availableBalance: newRecipientBalance,
            bookBalance: newRecipientBalance,
          })
          .where(eq(walletBalancesCache.walletId, recipientWallet.id));

        const today = todayDate();
        const existingUsage = await txDb.query.limitUsage.findFirst({
          where: and(
            eq(limitUsage.walletId, senderWallet.id),
            eq(limitUsage.usageDate, today)
          ),
        });

        if (existingUsage) {
          await txDb
            .update(limitUsage)
            .set({
              transferUsed: (parseFloat(existingUsage.transferUsed) + amount).toFixed(2),
            })
            .where(eq(limitUsage.id, existingUsage.id));
        } else {
          await txDb.insert(limitUsage).values({
            walletId: senderWallet.id,
            usageDate: today,
            transferUsed: amount.toFixed(2),
            cashOutUsed: "0.00",
          });
        }

        await txDb
          .update(transactionRequests)
          .set({ status: "COMPLETED", transactionId })
          .where(eq(transactionRequests.idempotencyKey, idemKey));
      });

      const completedTx = await db.query.transactions.findFirst({
        where: eq(transactions.transactionRef, transactionRef),
      });

      return completedTx;
    }),

  cashIn: activeQuery
    .input(
      z.object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        method: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const amount = parseFloat(input.amount);

      const wallet = await db.query.walletAccounts.findFirst({
        where: eq(walletAccounts.userId, ctx.user.id),
      });

      if (!wallet || wallet.status !== "ACTIVE") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Wallet not active" });
      }

      const transactionRef = generateTransactionRef();

      await db.transaction(async (txDb) => {
        const txResult = await txDb.insert(transactions).values({
          transactionRef,
          type: "CASH_IN",
          status: "POSTED",
          toWalletId: wallet.id,
          amount: input.amount,
          fee: "0.00",
          description: input.description || `Cash-in via ${input.method}`,
          metadata: { method: input.method },
        });

        const transactionId = getInsertId(txResult);

        const currentBalance = await txDb.query.walletBalancesCache.findFirst({
          where: eq(walletBalancesCache.walletId, wallet.id),
        });

        const available = parseFloat(currentBalance?.availableBalance || "0");
        const newBalance = (available + amount).toFixed(2);

        await txDb.insert(ledgerEntries).values({
          transactionId,
          walletId: wallet.id,
          entryType: "CREDIT",
          amount: input.amount,
          runningBalance: newBalance,
          entrySequence: 1,
        });

        await txDb
          .update(walletBalancesCache)
          .set({ availableBalance: newBalance, bookBalance: newBalance })
          .where(eq(walletBalancesCache.walletId, wallet.id));
      });

      return { success: true, transactionRef };
    }),

  cashOut: activeQuery
    .input(
      z.object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        method: z.string(),
        pin: z.string().regex(/^\d{6}$/),
        bankDetails: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const amount = parseFloat(input.amount);

      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });

      if (!user?.pinHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "PIN not set" });
      }

      const pinValid = await verifyPin(input.pin, user.pinHash);
      if (!pinValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid PIN" });
      }

      if (user.kycLevel < 2) {
        throw new TRPCError({ code: "FORBIDDEN", message: "KYC verification required for cash-out" });
      }

      const wallet = await db.query.walletAccounts.findFirst({
        where: eq(walletAccounts.userId, ctx.user.id),
      });

      if (!wallet || wallet.status !== "ACTIVE") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Wallet not active" });
      }

      const balance = await db.query.walletBalancesCache.findFirst({
        where: eq(walletBalancesCache.walletId, wallet.id),
      });

      const available = parseFloat(balance?.availableBalance || "0");
      if (available < amount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }

      const limit = await db.query.dailyLimits.findFirst({
        where: and(eq(dailyLimits.kycLevel, user.kycLevel), eq(dailyLimits.userId, 0)),
      });

      if (limit) {
        const today = todayDate();
        const usage = await db.query.limitUsage.findFirst({
          where: and(eq(limitUsage.walletId, wallet.id), eq(limitUsage.usageDate, today)),
        });

        const cashOutUsed = parseFloat(usage?.cashOutUsed || "0");
        const dailyCashOutCap = parseFloat(limit.dailyCashOutCap);
        if (cashOutUsed + amount > dailyCashOutCap) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Daily cash-out cap exceeded. Remaining: ${(dailyCashOutCap - cashOutUsed).toFixed(2)}`,
          });
        }
      }

      const transactionRef = generateTransactionRef();

      await db.transaction(async (txDb) => {
        const txResult = await txDb.insert(transactions).values({
          transactionRef,
          type: "CASH_OUT",
          status: "POSTED",
          fromWalletId: wallet.id,
          amount: input.amount,
          fee: "15.00",
          description: `Cash-out via ${input.method}`,
          metadata: { method: input.method, bankDetails: input.bankDetails },
        });

        const transactionId = getInsertId(txResult);
        const newBalance = (available - amount).toFixed(2);

        await txDb.insert(ledgerEntries).values({
          transactionId,
          walletId: wallet.id,
          entryType: "DEBIT",
          amount: input.amount,
          runningBalance: newBalance,
          entrySequence: 1,
        });

        await txDb
          .update(walletBalancesCache)
          .set({ availableBalance: newBalance, bookBalance: newBalance })
          .where(eq(walletBalancesCache.walletId, wallet.id));

        const today = todayDate();
        const existingUsage = await txDb.query.limitUsage.findFirst({
          where: and(eq(limitUsage.walletId, wallet.id), eq(limitUsage.usageDate, today)),
        });

        if (existingUsage) {
          await txDb
            .update(limitUsage)
            .set({ cashOutUsed: (parseFloat(existingUsage.cashOutUsed) + amount).toFixed(2) })
            .where(eq(limitUsage.id, existingUsage.id));
        } else {
          await txDb.insert(limitUsage).values({
            walletId: wallet.id,
            usageDate: today,
            transferUsed: "0.00",
            cashOutUsed: amount.toFixed(2),
          });
        }
      });

      return { success: true, transactionRef };
    }),

  transactions: activeQuery
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().default(0),
          type: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = input?.limit || 20;
      const offset = input?.offset || 0;

      const wallet = await db.query.walletAccounts.findFirst({
        where: eq(walletAccounts.userId, ctx.user.id),
      });

      if (!wallet) return [];

      const conditions = [
        or(eq(transactions.fromWalletId, wallet.id), eq(transactions.toWalletId, wallet.id)),
      ];

      if (input?.type) {
        conditions.push(eq(transactions.type, input.type as any));
      }

      const txs = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset);

      return txs;
    }),

  transactionDetail: activeQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, input.id),
      });

      if (!tx) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      const entries = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, input.id))
        .orderBy(ledgerEntries.entrySequence);

      return { ...tx, ledgerEntries: entries };
    }),

  limits: activeQuery.query(async ({ ctx }) => {
    const db = getDb();

    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const limit = await db.query.dailyLimits.findFirst({
      where: and(eq(dailyLimits.kycLevel, user.kycLevel), eq(dailyLimits.userId, 0)),
    });

    const wallet = await db.query.walletAccounts.findFirst({
      where: eq(walletAccounts.userId, ctx.user.id),
    });

    let usage = null;
    if (wallet) {
      const today = todayDate();
      usage = await db.query.limitUsage.findFirst({
        where: and(eq(limitUsage.walletId, wallet.id), eq(limitUsage.usageDate, today)),
      });
    }

    return {
      kycLevel: user.kycLevel,
      dailyTransferCap: limit?.dailyTransferCap || "0.00",
      dailyCashOutCap: limit?.dailyCashOutCap || "0.00",
      maxTransactionAmount: limit?.maxTransactionAmount || "0.00",
      transferUsed: usage?.transferUsed || "0.00",
      cashOutUsed: usage?.cashOutUsed || "0.00",
    };
  }),
});
