import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, activeQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

export const kycRouter = createRouter({
  submit: activeQuery
    .input(
      z.object({
        fullName: z.string().min(1),
        dateOfBirth: z.string(),
        nationality: z.string(),
        homeAddress: z.string(),
        sourceOfFunds: z.string(),
        idType: z.string(),
        idNumber: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      await db
        .update(users)
        .set({
          fullName: input.fullName,
          dateOfBirth: new Date(input.dateOfBirth),
          nationality: input.nationality,
          homeAddress: input.homeAddress,
          sourceOfFunds: input.sourceOfFunds,
          idType: input.idType,
          idNumber: input.idNumber,
          kycStatus: "PENDING",
          kycSubmittedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  status: activeQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      status: user.kycStatus,
      level: user.kycLevel,
      submittedAt: user.kycSubmittedAt,
      reviewedAt: user.kycReviewedAt,
      rejectionReason: user.kycRejectionReason,
    };
  }),

  uploadDocument: activeQuery
    .input(z.object({ type: z.enum(["idFront", "idBack", "selfie"]), url: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updateData: Record<string, string> = {};

      if (input.type === "idFront") updateData.idFrontUrl = input.url;
      if (input.type === "idBack") updateData.idBackUrl = input.url;
      if (input.type === "selfie") updateData.selfieUrl = input.url;

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, ctx.user.id));

      return { success: true, url: input.url };
    }),
});
