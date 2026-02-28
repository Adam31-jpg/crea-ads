"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRechargeModal } from "@/hooks/use-recharge-modal";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Zap } from "lucide-react";

function TiltCard({ children, className }: { children: React.ReactNode, className?: string }) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const xPct = (e.clientX - rect.left) / rect.width - 0.5;
        const yPct = (e.clientY - rect.top) / rect.height - 0.5;
        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => { x.set(0); y.set(0); };

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

/** Price per Spark for the custom slider — scales down with volume */
function pricePerSpark(sparks: number): number {
    if (sparks >= 200) return 0.18;
    if (sparks >= 100) return 0.22;
    return 0.30;
}

function CustomSliderTab({ userId, onClose }: { userId: string | null; onClose: () => void }) {
    const [sparks, setSparks] = useState(20);

    const pps = pricePerSpark(sparks);
    const price = (sparks * pps).toFixed(2);

    const handleBuy = () => {
        if (!userId) {
            toast.error("Please log in to buy Sparks.");
            return;
        }
        if (typeof window !== "undefined" && window.LemonSqueezy) {
            try {
                // Dynamically pick correct variant based on volume tier
                const variant =
                    sparks >= 200 ? "variant-003" :
                        sparks >= 100 ? "variant-002" :
                            "variant-001";
                const checkoutUrl = `https://lumina-test.lemonsqueezy.com/checkout/buy/${variant}`;
                const urlObj = new URL(checkoutUrl);
                urlObj.searchParams.set("checkout[custom][user_id]", userId);
                urlObj.searchParams.set("checkout[custom][credits]", String(sparks));
                window.LemonSqueezy.Url.Open(urlObj.toString());
                onClose();
            } catch (e) {
                console.error("Failed to open checkout", e);
                toast.error("Could not open checkout.");
            }
        } else {
            toast.error("Payment module not ready. Please refresh.");
        }
    };

    return (
        <div className="py-6 flex flex-col items-center gap-8">
            {/* Spark amount display */}
            <div className="text-center">
                <p className="text-6xl font-black text-white tabular-nums">
                    {sparks}
                    <span className="text-2xl font-bold text-amber-400 ml-2">Sparks</span>
                </p>
                <p className="text-zinc-400 text-sm mt-1">
                    {price}€
                    <span className="text-zinc-600 ml-2">({pps.toFixed(2)}€ / Spark)</span>
                </p>
            </div>

            {/* Slider */}
            <div className="w-full max-w-sm px-2">
                <Slider
                    min={10}
                    max={500}
                    step={10}
                    value={[sparks]}
                    onValueChange={([v]) => setSparks(v)}
                    className="[&_[role=slider]]:border-amber-500 [&_[role=slider]]:bg-amber-500
                               [&_.range]:bg-gradient-to-r [&_.range]:from-amber-500 [&_.range]:to-orange-500"
                />
                <div className="flex justify-between text-xs text-zinc-600 mt-2">
                    <span>10</span>
                    <span>500</span>
                </div>
            </div>

            {/* Volume discount badges */}
            <div className="flex gap-2 text-xs">
                <span className={`px-3 py-1 rounded-full border transition-colors ${sparks < 100 ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-zinc-800 text-zinc-600"}`}>
                    &lt;100 → 0.30€/Spark
                </span>
                <span className={`px-3 py-1 rounded-full border transition-colors ${sparks >= 100 && sparks < 200 ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-zinc-800 text-zinc-600"}`}>
                    100+ → 0.22€/Spark
                </span>
                <span className={`px-3 py-1 rounded-full border transition-colors ${sparks >= 200 ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-zinc-800 text-zinc-600"}`}>
                    200+ → 0.18€/Spark
                </span>
            </div>

            <Button
                onClick={handleBuy}
                className="w-full max-w-sm h-12 bg-gradient-to-r from-amber-500 to-orange-600 text-white
                           shadow-[inset_0_2px_rgba(255,255,255,0.2),0_4px_15px_rgba(245,158,11,0.3)]
                           hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] border-0 font-bold text-base gap-2"
            >
                <Zap className="h-4 w-4" />
                Buy {sparks} Sparks for {price}€
            </Button>
        </div>
    );
}

export function RechargeModal() {
    const t = useTranslations("Dashboard.topbar");
    const { isOpen, onClose, onOpen } = useRechargeModal();
    const { data: session } = useSession();
    const userId = session?.user?.id ?? null;

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

                <Tabs defaultValue="packs" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-900 border border-white/10">
                        <TabsTrigger value="packs" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                            Fixed Packs
                        </TabsTrigger>
                        <TabsTrigger value="custom" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                            Custom Amount
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="packs">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-2" style={{ perspective: "1000px" }}>
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
                                <div className="absolute inset-0 rounded-2xl overflow-hidden z-0">
                                    <div className="absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity duration-1000">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_70%,#f59e0b_100%)]" />
                                    </div>
                                </div>
                                <div className="absolute inset-[1px] bg-[#0A0A0A] backdrop-blur-xl rounded-2xl z-10" />
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30">
                                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] sm:text-xs font-bold px-4 py-1 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)] tracking-widest whitespace-nowrap">{t("refill.popular")}</span>
                                </div>
                                <div className="relative z-20 p-6 flex flex-col h-full bg-amber-500/5 rounded-2xl border-t border-amber-500/20 shadow-[inset_0_0_40px_rgba(245,158,11,0.05)]">
                                    <div className="flex flex-col mb-6">
                                        <h4 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mb-1">{t("refill.pro")}</h4>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <span className="text-4xl font-black text-white">45€</span>
                                            <span className="text-sm text-amber-500/60 font-medium">{t("refill.unit", { price: "0.22€" })}</span>
                                        </div>
                                    </div>
                                    <p className="text-base text-amber-300 font-bold mb-8 bg-amber-500/10 py-2 px-4 rounded-lg w-fit border border-amber-500/20">{t("refill.credits", { count: 200 })}</p>
                                    <div className="mt-auto pt-4">
                                        <Button onClick={() => handleBuySparks('https://lumina-test.lemonsqueezy.com/checkout/buy/variant-002')} className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[inset_0_2px_rgba(255,255,255,0.2),0_4px_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] border-0 font-bold">{t("refill.btn", { count: 200 })}</Button>
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
                    </TabsContent>

                    <TabsContent value="custom">
                        <CustomSliderTab userId={userId} onClose={onClose} />
                    </TabsContent>
                </Tabs>

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
