import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function GET() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "No API key" }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey: key });
    const result = await ai.models.list();

    const models: string[] = [];
    for await (const m of result) {
        if (m.name) models.push(m.name);
    }

    // Filter to show only "pro" or "gemini-3" models for quick scanning
    const relevant = models.filter(
        (n) => n.includes("pro") || n.includes("gemini-3") || n.includes("gemini-2")
    );

    return NextResponse.json({ relevant, all: models });
}
