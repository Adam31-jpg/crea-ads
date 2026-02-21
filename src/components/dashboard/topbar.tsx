"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import type { User } from "@supabase/supabase-js";
import { Zap, Sparkles } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useRechargeModal } from "@/hooks/use-recharge-modal";

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        LemonSqueezy: any;
    }
}


interface TopbarProps {
    user: User;
}

export function DashboardTopbar({ user }: TopbarProps) {
    const router = useRouter();
    const supabase = createClient();
    const t = useTranslations("Dashboard.topbar");
    const { onOpen, onClose } = useRechargeModal();
    const [credits, setCredits] = useState<number | null>(null);

    useEffect(() => {
        async function fetchCredits() {
            const { data, error } = await supabase
                .from("profiles")
                .select("credits")
                .eq("id", user.id)
                .single();

            if (data) {
                setCredits(data.credits);
                if (data.credits === 0) {
                    onOpen();
                }
            } else if (error) {
                console.warn("Could not fetch credits", error);
                setCredits(0);
            }
        }
        fetchCredits();

        // Optional: Subscribe to profile changes for real-time credit updates
        const channel = supabase
            .channel('public:profiles')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
                setCredits(payload.new.credits);
            })
            .subscribe();

        // Setup Lemon Squeezy overlay and events
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user.id, supabase]);

    // Smart Purchase Flow: Auto-trigger LemonSqueezy if "buy" param is in URL
    useEffect(() => {
        if (typeof window !== "undefined") {
            // Use native window.location to avoid Next.js useSearchParams suspense requirements
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
                if (checkoutUrl) {
                    // Small delay to ensure LemonSqueezy.js is fully initialized in the layout
                    setTimeout(() => {
                        if (window.LemonSqueezy) {
                            try {
                                const urlObj = new URL(checkoutUrl);
                                urlObj.searchParams.set("checkout[custom][user_id]", user.id);
                                window.LemonSqueezy.Url.Open(urlObj.toString());
                            } catch (e) {
                                console.error("Failed to auto-open checkout", e);
                            }
                            // Clean up URL without reloading the page
                            url.searchParams.delete("buy");
                            window.history.replaceState({}, '', url.toString());
                        }
                    }, 800);
                }
            }
        }
    }, [user.id]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
    };



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

                <span className="text-sm text-muted-foreground hidden lg:block">
                    {user.email}
                </span>
                {user.user_metadata?.avatar_url ? (
                    <Image
                        src={user.user_metadata.avatar_url}
                        alt="User Avatar"
                        width={32}
                        height={32}
                        className="rounded-full shadow-sm border border-border"
                    />
                ) : (
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/15 text-brand text-xs font-bold">
                        {user.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
                    {t("logout")}
                </Button>
            </div>
        </header>
    );
}
