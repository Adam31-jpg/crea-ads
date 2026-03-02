"use server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function updateBugStatus(bugId: string, newStatus: string, adminRoute: string) {
    // 4. Technical Security: Close/Resolve action is strictly protected by isAdmin check.
    const cookieStore = await cookies();
    const adminAuth = cookieStore.get("admin_auth");

    if (adminAuth?.value !== process.env.ADMIN_PASSWORD) {
        return { error: "Unauthorized. Admin privileges required." };
    }

    try {
        await prisma.bugReport.update({
            where: { id: bugId },
            data: { status: newStatus }
        });

        revalidatePath(`/${adminRoute}/analytics/support`);
        revalidatePath(`/${adminRoute}/analytics/users/[id]`, 'page');

        return { success: true };
    } catch (e: any) {
        console.error("Failed to update bug status:", e);
        return { error: e.message || "Database update failed" };
    }
}
