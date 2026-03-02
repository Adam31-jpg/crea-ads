import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized. You must be logged in to submit a bug." }, { status: 401 });
    }

    const body = await req.json();

    if (!body.subject || !body.description) {
        return NextResponse.json({ error: "missingFields" }, { status: 400 });
    }

    const fullMessage = `
Category: ${body.category}
Urgency: ${body.urgency}
Stripe ID: ${body.stripe_id || "N/A"}

Description:
${body.description}

Steps to Reproduce:
${body.steps}

Browser: ${body.browser_version} / OS: ${body.operating_system}
File Attachment: ${body.file_url || "None"}
    `.trim();

    try {
        await prisma.bugReport.create({
            data: {
                userId: userId,
                subject: body.subject,
                message: fullMessage,
                batchId: body.batch_id && body.batch_id !== "none" ? body.batch_id : null
            }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Failed to commit Support Ticket to DB:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
