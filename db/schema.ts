import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  decimal,
  date,
  bigint,
  json,
  int,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

// ─── Users ───
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: varchar("firebase_uid", { length: 128 }),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  kycLevel: int("kyc_level").default(1).notNull(),
  kycStatus: mysqlEnum("kyc_status", ["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  kycSubmittedAt: timestamp("kyc_submitted_at"),
  kycReviewedAt: timestamp("kyc_reviewed_at"),
  kycReviewerId: bigint("kyc_reviewer_id", { mode: "number", unsigned: true }),
  kycRejectionReason: text("kyc_rejection_reason"),
  idType: varchar("id_type", { length: 50 }),
  idNumber: varchar("id_number", { length: 100 }),
  nationality: varchar("nationality", { length: 50 }),
  dateOfBirth: date("date_of_birth"),
  homeAddress: text("home_address"),
  sourceOfFunds: varchar("source_of_funds", { length: 50 }),
  idFrontUrl: varchar("id_front_url", { length: 500 }),
  idBackUrl: varchar("id_back_url", { length: 500 }),
  selfieUrl: varchar("selfie_url", { length: 500 }),
  pinHash: varchar("pin_hash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["PENDING", "ACTIVE", "SUSPENDED"]).default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Wallet Accounts ───
export const walletAccounts = mysqlTable("wallet_accounts", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().unique(),
  walletNumber: varchar("wallet_number", { length: 20 }).notNull().unique(),
  status: mysqlEnum("status", ["ACTIVE", "FROZEN", "SUSPENDED"]).default("ACTIVE").notNull(),
  freezeReason: text("freeze_reason"),
  frozenBy: bigint("frozen_by", { mode: "number", unsigned: true }),
  frozenAt: timestamp("frozen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("wallet_user_idx").on(table.userId),
  index("wallet_number_idx").on(table.walletNumber),
]);

export type WalletAccount = typeof walletAccounts.$inferSelect;

// ─── Wallet Balances Cache ───
export const walletBalancesCache = mysqlTable("wallet_balances_cache", {
  walletId: bigint("wallet_id", { mode: "number", unsigned: true }).primaryKey(),
  availableBalance: decimal("available_balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  bookBalance: decimal("book_balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  lastLedgerEntryId: bigint("last_ledger_entry_id", { mode: "number", unsigned: true }),
  lastReconciledAt: timestamp("last_reconciled_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// ─── Transactions ───
export const transactions = mysqlTable("transactions", {
  id: serial("id").primaryKey(),
  transactionRef: varchar("transaction_ref", { length: 64 }).notNull().unique(),
  idempotencyKey: varchar("idempotency_key", { length: 64 }).unique(),
  type: mysqlEnum("type", ["SEND", "RECEIVE", "CASH_IN", "CASH_OUT", "REVERSAL", "FEE"]).notNull(),
  status: mysqlEnum("status", ["PENDING", "POSTED", "SETTLED", "FAILED", "REVERSED"]).default("PENDING").notNull(),
  fromWalletId: bigint("from_wallet_id", { mode: "number", unsigned: true }),
  toWalletId: bigint("to_wallet_id", { mode: "number", unsigned: true }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 15, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
  description: varchar("description", { length: 255 }),
  purpose: varchar("purpose", { length: 50 }),
  metadata: json("metadata"),
  reversedAt: timestamp("reversed_at"),
  reversalOfId: bigint("reversal_of_id", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("tx_from_wallet_idx").on(table.fromWalletId),
  index("tx_to_wallet_idx").on(table.toWalletId),
  index("tx_status_idx").on(table.status),
  index("tx_type_idx").on(table.type),
  index("tx_created_idx").on(table.createdAt),
  index("tx_idempotency_idx").on(table.idempotencyKey),
]);

export type Transaction = typeof transactions.$inferSelect;

// ─── Ledger Entries ───
export const ledgerEntries = mysqlTable("ledger_entries", {
  id: serial("id").primaryKey(),
  transactionId: bigint("transaction_id", { mode: "number", unsigned: true }).notNull(),
  walletId: bigint("wallet_id", { mode: "number", unsigned: true }).notNull(),
  entryType: mysqlEnum("entry_type", ["DEBIT", "CREDIT"]).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  runningBalance: decimal("running_balance", { precision: 15, scale: 2 }).notNull(),
  entrySequence: int("entry_sequence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("le_tx_idx").on(table.transactionId),
  index("le_wallet_idx").on(table.walletId),
  index("le_created_idx").on(table.createdAt),
]);

export type LedgerEntry = typeof ledgerEntries.$inferSelect;

// ─── Daily Limits ───
export const dailyLimits = mysqlTable("daily_limits", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }),
  kycLevel: int("kyc_level").notNull(),
  dailyTransferCap: decimal("daily_transfer_cap", { precision: 15, scale: 2 }).notNull(),
  dailyCashOutCap: decimal("daily_cash_out_cap", { precision: 15, scale: 2 }).notNull(),
  maxTransactionAmount: decimal("max_transaction_amount", { precision: 15, scale: 2 }).notNull(),
  monthlyCap: decimal("monthly_cap", { precision: 15, scale: 2 }).notNull(),
  effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
  effectiveTo: timestamp("effective_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Limit Usage ───
export const limitUsage = mysqlTable("limit_usage", {
  id: serial("id").primaryKey(),
  walletId: bigint("wallet_id", { mode: "number", unsigned: true }).notNull(),
  usageDate: date("usage_date").notNull(),
  transferUsed: decimal("transfer_used", { precision: 15, scale: 2 }).default("0.00").notNull(),
  cashOutUsed: decimal("cash_out_used", { precision: 15, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("limit_usage_wallet_date_idx").on(table.walletId, table.usageDate),
]);

// ─── Freeze Logs ───
export const freezeLogs = mysqlTable("freeze_logs", {
  id: serial("id").primaryKey(),
  walletId: bigint("wallet_id", { mode: "number", unsigned: true }).notNull(),
  action: mysqlEnum("action", ["FREEZE", "UNFREEZE"]).notNull(),
  reason: text("reason"),
  performedBy: bigint("performed_by", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("freeze_wallet_idx").on(table.walletId),
]);

// ─── Transaction Requests (Idempotency) ───
export const transactionRequests = mysqlTable("transaction_requests", {
  idempotencyKey: varchar("idempotency_key", { length: 64 }).primaryKey(),
  walletId: bigint("wallet_id", { mode: "number", unsigned: true }).notNull(),
  requestType: varchar("request_type", { length: 20 }).notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }),
  status: mysqlEnum("status", ["PENDING", "COMPLETED", "FAILED"]).default("PENDING").notNull(),
  transactionId: bigint("transaction_id", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  index("tr_wallet_idx").on(table.walletId),
  index("tr_expires_idx").on(table.expiresAt),
]);

// ─── Reconciliation Logs ───
export const reconciliationLogs = mysqlTable("reconciliation_logs", {
  id: serial("id").primaryKey(),
  walletId: bigint("wallet_id", { mode: "number", unsigned: true }),
  ledgerBalance: decimal("ledger_balance", { precision: 15, scale: 2 }).notNull(),
  cachedBalance: decimal("cached_balance", { precision: 15, scale: 2 }).notNull(),
  difference: decimal("difference", { precision: 15, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["MATCHED", "MISMATCHED"]).notNull(),
  performedBy: bigint("performed_by", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("rec_wallet_idx").on(table.walletId),
]);
