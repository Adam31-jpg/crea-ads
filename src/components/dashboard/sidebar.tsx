"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, Sparkles, Archive, Settings } from "lucide-react";

const navItems = [
    { label: "Batches", href: "/dashboard", icon: LayoutGrid },
    { label: "Studio", href: "/dashboard/studio", icon: Sparkles },
    { label: "Archives", href: "/dashboard/archives", icon: Archive },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border">
            {/* Logo */}
            <div className="flex items-center h-16 px-6 border-b border-border">
                <Link
                    href="/"
                    className="font-[var(--font-bodoni)] text-xl font-bold tracking-wide text-foreground"
                >
                    Lumina
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 flex flex-col gap-1">
                {navItems.map((item) => {
                    const isActive =
                        item.href === "/dashboard"
                            ? pathname === "/dashboard"
                            : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-brand/10 text-brand"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <span className="inline-block w-2 h-2 rounded-full bg-success" />
                    Beta v0.2
                </div>
            </div>
        </aside>
    );
}
