export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { BugClient } from "./bug-client";
import { prisma } from "@/lib/prisma";

export const metadata = {
    title: "Report a Bug - Lumina",
    description: "Submit bug reports or issues to the Lumina engineering team.",
};

export default async function BugPage() {
    const session = await auth();
    const batches = session?.user?.id
        ? await prisma.batch.findMany({
            where: { userId: session.user.id },
            select: { id: true, createdAt: true, status: true },
            orderBy: { createdAt: "desc" },
            take: 20
        })
        : [];

    return (
        <BugClient
            userId={session?.user?.id || null}
            userEmail={session?.user?.email || ""}
            batches={batches}
        />
    );
}
