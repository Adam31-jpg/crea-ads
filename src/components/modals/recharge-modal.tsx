"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRechargeModal } from "@/hooks/use-recharge-modal";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function TiltCard({ children, className }: { children: React.ReactNode, className?: string }) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const xPct = mouseX / rect.width - 0.5;
        const yPct = mouseY / rect.height - 0.5;
        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
            className={`relative rounded-2xl transition-all duration-300 ease-out group ${className}`}
        >
            <div style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }} className="w-full h-full relative">
                {children}
            </div>
        </motion.div>
    );
}

export function RechargeModal() {
    const t = useTranslations("Dashboard.topbar");
    const { isOpen, onClose, onOpen } = useRechargeModal();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    }, []);

    const handleBuySparks = (checkoutUrl: string) => {
        try {
            if (typeof window !== "undefined" && window.LemonSqueezy) {
                if (!userId) {
                    toast.error("Veuillez vous connecter pour acheter des Sparks.");
                    return;
                }
                const urlObj = new URL(checkoutUrl);
                urlObj.searchParams.set("checkout[custom][user_id]", userId);
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
        <Dialog open={isOpen} onOpenChange={(open) => open ? onOpen() : onClose()}>
            <DialogContent className="sm:max-w-4xl p-8 sm:p-10 bg-[#0A0A0A]/80 backdrop-blur-[20px] border-white/10 text-white shadow-[0_0_80px_rgba(245,158,11,0.15)] [&>button]:text-zinc-500 hover:[&>button]:text-amber-500 [&>button]:hover:bg-transparent [&>button]:transition-colors">
                <DialogHeader className="text-center sm:text-center pb-4">
                    <DialogTitle className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">{t("refill.title")}</DialogTitle>
                    <DialogDescription className="text-zinc-400 font-medium text-base leading-relaxed max-w-lg mx-auto">
                        {t("refill.desc")}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6" style={{ perspective: "1000px" }}>
                    {/* STARTER */}
                    <TiltCard className="p-[1px] bg-white/5 border border-white/5 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                        <div className="p-6 flex flex-col h-full bg-[#0A0A0A]/50 rounded-2xl backdrop-blur-sm">
                            <div className="flex flex-col mb-6">
                                <h4 className="text-xl font-bold text-white mb-1">{t("refill.starter")}</h4>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-4xl font-black text-white">15€</span>
                                    <span className="text-sm text-zinc-500 font-medium">{t("refill.unit", { price: "0.30€" })}</span>
                                </div>
                            </div>
                            <p className="text-base text-zinc-300 font-medium mb-8 bg-white/5 py-2 px-4 rounded-lg w-fit border border-white/10">{t("refill.credits", { count: 50 })}</p>
                            <div className="mt-auto pt-4">
                                <Button onClick={() => handleBuySparks('https://lumina-test.lemonsqueezy.com/checkout/buy/variant-001')} className="w-full bg-white/5 text-white hover:bg-white/10 border-white/10 shadow-sm transition-all duration-500">{t("refill.btn", { count: 50 })}</Button>
                            </div>
                        </div>
                    </TiltCard>

                    {/* PRO */}
                    <TiltCard className="p-[1px] relative group">
                        {/* Animated Beam Masking Container */}
                        <div className="absolute inset-0 rounded-2xl overflow-hidden z-0">
                            <div className="absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity duration-1000">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_70%,#f59e0b_100%)]" />
                            </div>
                        </div>
                        <div className="absolute inset-[1px] bg-[#0A0A0A] backdrop-blur-xl rounded-2xl z-10" />

                        {/* Floating Badge */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30">
                            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] sm:text-xs font-bold px-4 py-1 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)] tracking-widest transition-transform group-hover:scale-110 border border-amber-300/30 whitespace-nowrap">{t("refill.popular")}</span>
                        </div>

                        {/* Card Content */}
                        <div className="relative z-20 p-6 flex flex-col h-full bg-amber-500/5 rounded-2xl border-t border-amber-500/20 shadow-[inset_0_0_40px_rgba(245,158,11,0.05)] group-hover:shadow-[inset_0_0_60px_rgba(245,158,11,0.1)] transition-all">
                            <div className="flex flex-col mb-6">
                                <h4 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mb-1">{t("refill.pro")}</h4>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-4xl font-black text-white">45€</span>
                                    <span className="text-sm text-amber-500/60 font-medium">{t("refill.unit", { price: "0.22€" })}</span>
                                </div>
                            </div>
                            <p className="text-base text-amber-300 font-bold mb-8 bg-amber-500/10 py-2 px-4 rounded-lg w-fit border border-amber-500/20">{t("refill.credits", { count: 200 })}</p>
                            <div className="mt-auto pt-4">
                                <Button onClick={() => handleBuySparks('https://lumina-test.lemonsqueezy.com/checkout/buy/variant-002')} className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[inset_0_2px_rgba(255,255,255,0.2),0_4px_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] group-hover:scale-[1.02] border-0 transition-all duration-500 font-bold justify-center transition-transform group-hover:animate-pulse hover:!animate-none">{t("refill.btn", { count: 200 })}</Button>
                            </div>
                        </div>
                    </TiltCard>

                    {/* BUSINESS */}
                    <TiltCard className="p-[1px] bg-white/5 border border-white/5 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                        <div className="p-6 flex flex-col h-full bg-[#0A0A0A]/50 rounded-2xl backdrop-blur-sm">
                            <div className="flex flex-col mb-6">
                                <h4 className="text-xl font-bold text-white mb-1">{t("refill.business")}</h4>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-4xl font-black text-white">90€</span>
                                    <span className="text-sm text-zinc-500 font-medium">{t("refill.unit", { price: "0.18€" })}</span>
                                </div>
                            </div>
                            <p className="text-base text-zinc-300 font-medium mb-8 bg-white/5 py-2 px-4 rounded-lg w-fit border border-white/10">{t("refill.credits", { count: 500 })}</p>
                            <div className="mt-auto pt-4">
                                <Button onClick={() => handleBuySparks('https://lumina-test.lemonsqueezy.com/checkout/buy/variant-003')} className="w-full bg-white/5 text-white hover:bg-white/10 border-white/10 shadow-sm transition-all duration-500">{t("refill.btn", { count: 500 })}</Button>
                            </div>
                        </div>
                    </TiltCard>
                </div>

                {/* Trust Footer */}
                <div className="mt-4 pt-6 border-t border-white/10 flex items-center justify-center gap-2 opacity-80">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 border border-white/10">
                        <span className="text-[10px]">🔒</span>
                    </div>
                    <span className="text-xs text-zinc-400 font-medium leading-none">{t("refill.footer")}</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
