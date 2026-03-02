"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function adjustSparksAction(userId: string, amount: number, secretRoute: string) {
    if (!userId || isNaN(amount) || amount === 0) {
        return { error: "Invalid parameters for adjustSparksAction." };
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Update User Credits
            await tx.user.update({
                where: { id: userId },
                data: { credits: { increment: amount } }
            });

            // Log Admin Action
            await tx.adminAuditLog.create({
                data: {
                    userId,
                    action: amount > 0 ? "ADD_SPARKS" : "REMOVE_SPARKS",
                    amount: Math.abs(amount),
                    adminId: "system_admin", // Can be extended if mapping multiple admin OAuths
                }
            });
        });

        revalidatePath(`/${secretRoute}/analytics/users/${userId}`);
        return { success: true };
    } catch (e) {
        console.error("[Sparks Action Error]:", e);
        return { error: "Failed to adjust sparks. Check database constraints." };
    }
}
