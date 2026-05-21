import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users, walletAccounts, walletBalancesCache } from "@db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, hashPin, verifyPin, generateWalletNumber } from "../lib/crypto";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "paylite-secret-key-change-in-production"
);

export async function createToken(userId: number, role: string): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
    return payload as { userId: number; role: string };
  } catch {
    return null;
  }
}

function getInsertId(result: any): number {
  return Number(result[0]?.insertId || 0);
}

export const authRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        phoneNumber: z.string().min(10).max(20),
        password: z.string().min(6).max(64),
        fullName: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check if phone already exists
      const existing = await db.query.users.findFirst({
        where: eq(users.phoneNumber, input.phoneNumber),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Phone number already registered",
        });
      }

      const passwordHash = await hashPassword(input.password);

      // Create user with status PENDING (awaiting admin approval)
      const result = await db.insert(users).values({
        phoneNumber: input.phoneNumber,
        passwordHash,
        fullName: input.fullName,
        kycLevel: 1,
        kycStatus: "PENDING",
        role: "user",
        status: "PENDING",
      });

      const userId = getInsertId(result);

      // Create wallet (but user can't use it until approved)
      const walletResult = await db.insert(walletAccounts).values({
        userId,
        walletNumber: generateWalletNumber(),
        status: "ACTIVE",
      });

      const walletId = getInsertId(walletResult);

      await db.insert(walletBalancesCache).values({
        walletId,
        availableBalance: "0.00",
        bookBalance: "0.00",
      });

      return {
        success: true,
        message: "Registration successful. Your account is pending admin approval.",
        userId,
      };
    }),

  login: publicQuery
    .input(
      z.object({
        phoneNumber: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const user = await db.query.users.findFirst({
        where: eq(users.phoneNumber, input.phoneNumber),
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid phone number or password",
        });
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid phone number or password",
        });
      }

      // Check status
      if (user.status === "PENDING") {
        const token = await createToken(user.id, user.role);
        return {
          token,
          user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            fullName: user.fullName,
            email: user.email,
            kycLevel: user.kycLevel,
            kycStatus: user.kycStatus,
            role: user.role,
            status: user.status,
          },
          pending: true,
        };
      }

      if (user.status === "SUSPENDED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account suspended. Contact support.",
        });
      }

      // ACTIVE
      const token = await createToken(user.id, user.role);

      return {
        token,
        user: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          fullName: user.fullName,
          email: user.email,
          kycLevel: user.kycLevel,
          kycStatus: user.kycStatus,
          role: user.role,
          status: user.status,
        },
        pending: false,
      };
    }),

  setPin: authedQuery
    .input(z.object({ pin: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const pinHash = await hashPin(input.pin);

      await db
        .update(users)
        .set({ pinHash })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  verifyPin: authedQuery
    .input(z.object({ pin: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });

      if (!user?.pinHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "PIN not set" });
      }

      const valid = await verifyPin(input.pin, user.pinHash);
      return { valid };
    }),

  me: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const wallet = await db.query.walletAccounts.findFirst({
      where: eq(walletAccounts.userId, user.id),
    });

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      email: user.email,
      kycLevel: user.kycLevel,
      kycStatus: user.kycStatus,
      role: user.role,
      status: user.status,
      walletNumber: wallet?.walletNumber || null,
    };
  }),

  updateProfile: authedQuery
    .input(z.object({ fullName: z.string().optional(), email: z.string().email().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(users)
        .set(input)
        .where(eq(users.id, ctx.user.id));

      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });

      return user;
    }),
});
