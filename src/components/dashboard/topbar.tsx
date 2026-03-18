"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { Zap, Sparkles } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useRechargeModal } from "@/hooks/use-recharge-modal";
import type { Session } from "next-auth";
import { Label } from "@/components/ui/label";

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        LemonSqueezy: any;
    }
}

interface TopbarProps {
    user: Session["user"];
}

export function DashboardTopbar({ user }: TopbarProps) {
    const router = useRouter();
    const t = useTranslations("Dashboard.topbar");
    const { onOpen, onClose } = useRechargeModal();
    const [credits, setCredits] = useState<number | null>(
        (user as { credits?: number }).credits ?? null
    );

    // ── Server-Sent Events: real-time credit + job status updates ────────────
    useEffect(() => {
        if (!user?.id) return;

        const eventSource = new EventSource("/api/events");

        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                if (payload.type === "credits_update") {
                    setCredits(payload.credits);
                    if (payload.credits === 0) {
                        onOpen();
                    }
                }
                // job_update events are handled by batch-list component
            } catch {
                // ignore malformed events
            }
        };

        eventSource.onerror = () => {
            // Browser will auto-reconnect after a brief delay (SSE spec)
            console.warn("[SSE] Connection error — browser will retry automatically.");
        };

        return () => {
            eventSource.close();
        };
    }, [user?.id, onOpen]);

    // ── LemonSqueezy setup ────────────────────────────────────────────────────
    useEffect(() => {
        if (typeof window !== "undefined" && window.LemonSqueezy) {
            window.LemonSqueezy.Setup({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                eventHandler: (event: any) => {
                    if (event.event === "Checkout.Success") {
                        toast.success("Paiement validé ! Vos Sparks sont en cours d'ajout...");
                        onClose();
                    }
                }
            });
        }
    }, [onClose]);

    // ── Smart Purchase Flow (auto-trigger checkout from ?buy= param) ──────────
    useEffect(() => {
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            const buyVariant = url.searchParams.get("buy");
            const isSuccess = url.searchParams.get("success");

            if (isSuccess === "true") {
                toast.success(t("refill.success"), { duration: 5000 });
                url.searchParams.delete("success");
                window.history.replaceState({}, '', url.toString());
            }

            if (buyVariant) {
                const checkoutUrls: Record<string, string> = {
                    'variant-001': 'https://lumina-test.lemonsqueezy.com/checkout/buy/variant-001',
                    'variant-002': 'https://lumina-test.lemonsqueezy.com/checkout/buy/variant-002',
                    'variant-003': 'https://lumina-test.lemonsqueezy.com/checkout/buy/variant-003',
                };

                const checkoutUrl = checkoutUrls[buyVariant];
                if (checkoutUrl && user?.id) {
                    setTimeout(() => {
                        if (window.LemonSqueezy) {
                            try {
                                const urlObj = new URL(checkoutUrl);
                                urlObj.searchParams.set("checkout[custom][user_id]", user.id!);
                                window.LemonSqueezy.Url.Open(urlObj.toString());
                            } catch (e) {
                                console.error("Failed to auto-open checkout", e);
                            }
                            url.searchParams.delete("buy");
                            window.history.replaceState({}, '', url.toString());
                        }
                    }, 800);
                }
            }
        }
    }, [user?.id, t]);

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/" });
    };

    // Read current locale from cookie (client-side)
    const [currentLocale, setCurrentLocale] = useState<"fr" | "en">(() => {
        if (typeof window === "undefined") return "fr";
        const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
        return (match?.[1] as "fr" | "en") ?? "fr";
    });

    function switchLocale(locale: "fr" | "en") {
        document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`;
        setCurrentLocale(locale);
        window.location.reload();
    }

    return (
        <header className="flex items-center justify-between h-16 px-6 lg:px-8 border-b border-border bg-background">
            <div>
                <h2 className="text-sm font-medium text-foreground">{t("title")}</h2>
            </div>
            <div className="flex flex-1 justify-end items-center gap-6">

                {/* Credit Display */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-500">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground leading-none">{t("tokens")}</span>
                        <span className="text-sm font-bold text-foreground leading-none mt-1">
                            {credits !== null ? credits : "..."}
                        </span>
                    </div>
                </div>

                {/* Refill Dialog */}
                <Button onClick={onOpen} variant="outline" size="sm" className="border-amber-500/20 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 hidden sm:flex gap-2">
                    <Zap className="h-3 w-3" />
                    {t("generateMore")}
                </Button>

                <div className="h-4 w-px bg-border hidden sm:block" />

                {process.env.NODE_ENV === "development" && (
                    <div className="flex items-center gap-2 hidden lg:flex border border-zinc-800 rounded-md px-3 py-1.5 bg-zinc-900/50">
                        <Label htmlFor="devMockToggle" className="text-xs font-semibold text-zinc-400 cursor-pointer">Dev Mock AI</Label>
                        <input
                            type="checkbox"
                            id="devMockToggle"
                            className="w-4 h-4 accent-amber-500 cursor-pointer rounded"
                            onChange={(e) => {
                                if (e.target.checked) {
                                    localStorage.setItem("lumina_dev_mock", "true");
                                    toast.success("Dev Mock Mode Enabled: Bypassing Fal.ai pipeline for 2D templates.");
                                } else {
                                    localStorage.removeItem("lumina_dev_mock");
                                    toast.success("Dev Mock Mode Disabled: Live generation active.");
                                }
                            }}
                            defaultChecked={typeof window !== "undefined" ? localStorage.getItem("lumina_dev_mock") === "true" : false}
                        />
                    </div>
                )}

                <span className="text-sm text-muted-foreground hidden lg:block">
                    {user?.email}
                </span>

                {user?.image ? (
                    <Image
                        src={user.image}
                        alt="User Avatar"
                        width={32}
                        height={32}
                        className="rounded-full shadow-sm border border-border"
                    />
                ) : (
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/15 text-brand text-xs font-bold">
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                )}

                {/* Language switcher */}
                <div className="flex rounded-md border border-border overflow-hidden text-xs hidden sm:flex">
                    {(["fr", "en"] as const).map((lang) => (
                        <button
                            key={lang}
                            onClick={() => switchLocale(lang)}
                            className={`px-2.5 py-1.5 transition-colors font-medium ${
                                currentLocale === lang
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {lang === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
                        </button>
                    ))}
                </div>

                <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
                    {t("logout")}
                </Button>
            </div>
        </header>
    );
}
