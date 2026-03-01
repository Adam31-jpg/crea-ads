"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutTemplate, ShieldAlert, LogOut } from "lucide-react";
import { logoutAdmin } from "@/app/[admin_route]/actions";

export function AdminSidebar({ secretRoute }: { secretRoute: string }) {
    const pathname = usePathname();

    const handleLogout = async () => {
        await logoutAdmin();
        window.location.reload();
    };

    const links = [
        {
            name: "Template Sandbox",
            href: `${secretRoute}/sandbox`,
            icon: LayoutTemplate,
        }
    ];

    return (
        <aside className="w-64 h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col text-zinc-300 font-sans">
            <div className="p-6 flex items-center gap-3 border-b border-zinc-800/50">
                <ShieldAlert className="w-6 h-6 text-red-500" />
                <span className="font-bold text-white tracking-wide">ADMIN PORTAL</span>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {links.map((link) => {
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                ? "bg-zinc-800 text-white font-medium"
                                : "hover:bg-zinc-900 hover:text-white"
                                }`}
                        >
                            <link.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-zinc-500"}`} />
                            {link.name}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-zinc-800/50">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    Secure Logout
                </button>
            </div>
        </aside>
    );
}
