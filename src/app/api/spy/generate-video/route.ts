import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json(
        {
            error: "not_implemented",
            message:
                "UGC video generation is coming soon. Download the UGC script to brief a human creator.",
        },
        { status: 501 },
    );
}
