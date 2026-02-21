"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { Coins, Zap } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface TopbarProps {
    user: User;
}

export function DashboardTopbar({ user }: TopbarProps) {
    const router = useRouter();
    const supabase = createClient();
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user.id, supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
    };

    const handleBuyCredits = async (planId: string) => {
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, planId })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error("Failed to init checkout", err);
        }
    };

    return (
        <header className="flex items-center justify-between h-16 px-6 lg:px-8 border-b border-border bg-background">
            <div>
                <h2 className="text-sm font-medium text-foreground">Dashboard</h2>
            </div>
            <div className="flex flex-1 justify-end items-center gap-6">

                {/* Credit Display */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-500">
                        <Coins className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground leading-none">Jetons</span>
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
                            Générer (+ de jetons)
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Recharger vos jetons</DialogTitle>
                            <DialogDescription>
                                Vous êtes à court de jetons. Achetez un pack pour continuer à générer des médias avec une précision chirurgicale.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center justify-between p-4 border rounded-xl hover:border-amber-500/50 transition-colors">
                                <div>
                                    <h4 className="font-bold text-foreground">Pack Starter</h4>
                                    <p className="text-sm text-muted-foreground">50 crédits</p>
                                </div>
                                <Button onClick={() => handleBuyCredits('starter')} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">15€</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 border-2 border-amber-500/50 rounded-xl bg-amber-500/5 relative">
                                <span className="absolute -top-3 left-4 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Populaire</span>
                                <div>
                                    <h4 className="font-bold text-foreground">Pack Pro</h4>
                                    <p className="text-sm text-muted-foreground">200 crédits</p>
                                </div>
                                <Button onClick={() => handleBuyCredits('pro')} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">45€</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-xl hover:border-amber-500/50 transition-colors">
                                <div>
                                    <h4 className="font-bold text-foreground">Pack Business</h4>
                                    <p className="text-sm text-muted-foreground">500 crédits</p>
                                </div>
                                <Button onClick={() => handleBuyCredits('business')} variant="outline">90€</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <div className="h-4 w-px bg-border hidden sm:block" />

                <span className="text-sm text-muted-foreground hidden lg:block">
                    {user.email}
                </span>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/15 text-brand text-xs font-bold">
                    {user.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
                    Logout
                </Button>
            </div>
        </header>
    );
}
