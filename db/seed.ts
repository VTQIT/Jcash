import { getDb } from "../api/queries/connection";
import { users, dailyLimits, walletAccounts, walletBalancesCache } from "./schema";
import { eq } from "drizzle-orm";
import { hashPin, hashPassword } from "../api/lib/crypto";

async function seed() {
  const db = getDb();

  // Seed default daily limits for each KYC level
  const existingLimits = await db.select().from(dailyLimits);
  if (existingLimits.length === 0) {
    await db.insert(dailyLimits).values([
      {
        userId: 0,
        kycLevel: 1,
        dailyTransferCap: "5000.00",
        dailyCashOutCap: "0.00",
        maxTransactionAmount: "1000.00",
        monthlyCap: "10000.00",
      },
      {
        userId: 0,
        kycLevel: 2,
        dailyTransferCap: "100000.00",
        dailyCashOutCap: "50000.00",
        maxTransactionAmount: "50000.00",
        monthlyCap: "1000000.00",
      },
      {
        userId: 0,
        kycLevel: 3,
        dailyTransferCap: "500000.00",
        dailyCashOutCap: "250000.00",
        maxTransactionAmount: "250000.00",
        monthlyCap: "5000000.00",
      },
    ]);
    console.log("Default limits seeded.");
  }

  // Seed admin user if not exists
  const existingAdmin = await db.select().from(users).where(eq(users.phoneNumber, "+639171111111"));

  if (existingAdmin.length === 0) {
    const pinHash = await hashPin("123456");
    const passwordHash = await hashPassword("admin123");
    const result = await db.insert(users).values({
      firebaseUid: "admin-firebase-uid-001",
      phoneNumber: "+639171111111",
      passwordHash,
      fullName: "System Admin",
      email: "admin@paylite.ph",
      kycLevel: 3,
      kycStatus: "APPROVED",
      role: "admin",
      status: "ACTIVE",
      pinHash,
    });

    const adminUserId = Number(result[0]?.insertId || 1);

    const walletResult = await db.insert(walletAccounts).values({
      userId: adminUserId,
      walletNumber: "PL-0000-0001",
      status: "ACTIVE",
    });

    const walletId = Number(walletResult[0]?.insertId || 1);

    await db.insert(walletBalancesCache).values({
      walletId,
      availableBalance: "1000000.00",
      bookBalance: "1000000.00",
    });

    console.log("Admin user seeded: +639171111111 / PIN: 123456");
  }

  // Seed demo user if not exists
  const existingUser = await db.select().from(users).where(eq(users.phoneNumber, "+639172222222"));

  if (existingUser.length === 0) {
    const pinHash = await hashPin("123456");
    const passwordHash = await hashPassword("demo123");
    const result = await db.insert(users).values({
      firebaseUid: "demo-firebase-uid-002",
      phoneNumber: "+639172222222",
      passwordHash,
      fullName: "Juan Dela Cruz",
      email: "juan@email.com",
      kycLevel: 2,
      kycStatus: "APPROVED",
      role: "user",
      status: "ACTIVE",
      nationality: "Filipino",
      dateOfBirth: new Date("1995-03-15"),
      homeAddress: "123 Mabini St, Makati City, Metro Manila",
      sourceOfFunds: "Salary",
      pinHash,
    });

    const demoUserId = Number(result[0]?.insertId || 2);

    await db.insert(walletAccounts).values({
      userId: demoUserId,
      walletNumber: "PL-1234-5678",
      status: "ACTIVE",
    });

    console.log("Demo user seeded: +639172222222 / PIN: 123456");
  }

  console.log("Seed complete.");
}

seed().catch(console.error);
