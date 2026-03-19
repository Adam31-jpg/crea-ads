"use server";

import { cookies } from "next/headers";

export async function loginAdmin(password: string) {
    if (password === process.env.ADMIN_PASSWORD) {
        const cookieStore = await cookies();
        cookieStore.set("admin_auth", password, { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production" });
        return { success: true };
    }
    return { success: false, error: "Invalid admin password." };
}

export async function logoutAdmin() {
    const cookieStore = await cookies();
    cookieStore.delete("admin_auth");
}
