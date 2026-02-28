import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const { name, email, password } = await req.json();

        // ── Validation ──────────────────────────────────────────────────────────
        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required." },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: "Password must be at least 8 characters." },
                { status: 400 }
            );
        }

        // ── Duplicate email guard ────────────────────────────────────────────────
        const existing = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });

        if (existing) {
            return NextResponse.json(
                { error: "An account with this email already exists." },
                { status: 409 }
            );
        }

        // ── Hash password and create user ────────────────────────────────────────
        const password_hash = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name: name?.trim() || null,
                email: email.toLowerCase().trim(),
                password_hash,
                credits: 10, // 10 free Sparks on signup
            },
            select: { id: true, email: true, name: true },
        });

        return NextResponse.json({ user }, { status: 201 });
    } catch (err) {
        console.error("[Register] Error:", err);
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        );
    }
}
