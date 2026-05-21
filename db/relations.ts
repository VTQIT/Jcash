import { relations } from "drizzle-orm";
import { users, walletAccounts, transactions, ledgerEntries } from "./schema";

export const usersRelations = relations(users, ({ one }) => ({
  wallet: one(walletAccounts, {
    fields: [users.id],
    references: [walletAccounts.userId],
  }),
}));

export const walletAccountsRelations = relations(walletAccounts, ({ one }) => ({
  user: one(users, {
    fields: [walletAccounts.userId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ many }) => ({
  ledgerEntries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  transaction: one(transactions, {
    fields: [ledgerEntries.transactionId],
    references: [transactions.id],
  }),
  wallet: one(walletAccounts, {
    fields: [ledgerEntries.walletId],
    references: [walletAccounts.id],
  }),
}));
