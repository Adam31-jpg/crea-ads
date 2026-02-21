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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

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
    const [credits, setCredits] = useState<number | null>(null);
    const [isRefillOpen, setIsRefillOpen] = useState(false);

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
                    setIsRefillOpen(true);
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
                        setIsRefillOpen(false);
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

    const handleBuySparks = (checkoutUrl: string) => {
        try {
            if (typeof window !== "undefined" && window.LemonSqueezy) {
                // Pass user.id via custom payload immediately before opening
                const urlObj = new URL(checkoutUrl);
                urlObj.searchParams.set("checkout[custom][user_id]", user.id);
                window.LemonSqueezy.Url.Open(urlObj.toString());
            } else {
                toast.error("Le module de paiement n'est pas prêt. Veuillez rafraîchir la page.");
            }
        } catch (err) {
            console.error("Failed to open checkout overlay", err);
            toast.error("Erreur lors de l'ouverture du paiement.");
        }
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
                <Dialog open={isRefillOpen} onOpenChange={setIsRefillOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-amber-500/20 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 hidden sm:flex gap-2">
                            <Zap className="h-3 w-3" />
                            {t("generateMore")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>{t("refill.title")}</DialogTitle>
                            <DialogDescription>
                                {t("refill.desc")}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center justify-between p-4 border rounded-xl hover:border-amber-500/50 transition-colors">
                                <div>
                                    <h4 className="font-bold text-foreground">{t("refill.starter")}</h4>
                                    <p className="text-sm text-muted-foreground">{t("refill.credits", { count: 25 })}</p>
                                </div>
                                {/* TODO: Replace with real Store URL for Starter Pack */}
                                <Button onClick={() => handleBuySparks('https://lumina-test.lemonsqueezy.com/checkout/buy/variant-001')} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">19€</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 border-2 border-amber-500/50 rounded-xl bg-amber-500/5 relative">
                                <span className="absolute -top-3 left-4 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{t("refill.popular")}</span>
                                <div>
                                    <h4 className="font-bold text-foreground">{t("refill.pro")}</h4>
                                    <p className="text-sm text-muted-foreground">{t("refill.credits", { count: 100 })}</p>
                                </div>
                                {/* TODO: Replace with real Store URL for Pro Pack */}
                                <Button onClick={() => handleBuySparks('https://lumina-test.lemonsqueezy.com/checkout/buy/variant-002')} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">49€</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-xl hover:border-amber-500/50 transition-colors">
                                <div>
                                    <h4 className="font-bold text-foreground">{t("refill.business")}</h4>
                                    <p className="text-sm text-muted-foreground">{t("refill.credits", { count: 250 })}</p>
                                </div>
                                {/* TODO: Replace with real Store URL for Business Pack */}
                                <Button onClick={() => handleBuySparks('https://lumina-test.lemonsqueezy.com/checkout/buy/variant-003')} variant="outline">99€</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

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
