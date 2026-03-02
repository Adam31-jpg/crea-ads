"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, Sparkles, Archive, Settings, HelpCircle, Bug } from "lucide-react";
import { useTranslations } from "next-intl";

export function DashboardSidebar() {
    const pathname = usePathname();
    const t = useTranslations("Dashboard.nav");

    const navItems = [
        { label: t("batches"), href: "/dashboard", icon: LayoutGrid },
        { label: t("studio"), href: "/dashboard/studio", icon: Sparkles },
        { label: t("archives"), href: "/dashboard/archives", icon: Archive },
        { label: t("settings"), href: "/dashboard/settings", icon: Settings },
    ];

    return (
        <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border">
            {/* Logo */}
            <div className="flex items-center h-16 px-6 border-b border-border">
                <Link
                    href="/"
                    className="font-[var(--font-bodoni)] text-xl font-bold tracking-wide text-foreground flex items-center gap-2 group"
                >
                    <Image
                        src="/logo-lumina.png"
                        alt="Lumina Logo"
                        width={32}
                        height={32}
                        className="transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                    />
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
            <div className="p-4 border-t border-border flex flex-col gap-3">
                <Link
                    href="/help"
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        pathname === "/help"
                            ? "bg-brand/10 text-brand"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <HelpCircle className="h-4 w-4" />
                    {t("help")}
                </Link>
                <Link
                    href="/bug"
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-amber-500",
                        pathname === "/bug"
                            ? "bg-amber-500/10 text-amber-500"
                            : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <Bug className="h-4 w-4" />
                    Support
                </Link>
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <span className="inline-block w-2 h-2 rounded-full bg-success opacity-80" />
                    Beta v0.2
                </div>
            </div>
        </aside>
    );
}
