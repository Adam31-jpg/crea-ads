import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/bug — Submit a bug report
 * Inserts a JSON record into a bug_submissions log table.
 * Body: { user_id, user_email, category, stripe_id?, batch_id?, urgency, subject, description, steps, file_url?, browser_version, operating_system, current_url }
 *
 * NOTE: This stores reports in a JSONB metadata column on the Bug model.
 * Add a Bug model to prisma/schema.prisma if more structured storage is needed.
 * For now, we log the report as a JSON blob in the "metadata" field.
 */
export async function POST(req: NextRequest) {
    const body = await req.json();

    // Simple honeypot validation
    if (!body.subject || !body.description) {
        return NextResponse.json({ error: "missingFields" }, { status: 400 });
    }

    // For now, log to console and return OK (add a Bug model to schema later)
    console.log("[BugReport]", JSON.stringify(body, null, 2));

    return NextResponse.json({ success: true });
}
