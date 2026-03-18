import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;

        const body = await req.json();
        const {
            storeUrl,
            storeName,
            productCategory,
            niche,
            priceRange,
            usps,
            toneOfVoice,
            targetMarket,
        } = body as {
            storeUrl?: string;
            storeName?: string;
            productCategory?: string;
            niche?: string;
            priceRange?: string;
            usps?: string[];
            toneOfVoice?: string;
            targetMarket?: string;
        };

        const storeAnalysis = await prisma.storeAnalysis.create({
            data: {
                userId,
                storeUrl: storeUrl ?? "",
                storeName: storeName ?? null,
                productCategory: productCategory ?? null,
                niche: niche ?? null,
                priceRange: priceRange ?? null,
                usps: usps ? (usps as string[]) : undefined,
                toneOfVoice: toneOfVoice ?? null,
                targetMarket: targetMarket ?? null,
                status: "manual_fallback",
            },
        });

        return NextResponse.json({
            status: "manual_fallback",
            storeAnalysisId: storeAnalysis.id,
        });
    } catch (err) {
        console.error("[spy/analyze-store/manual]", err);
        return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
}
