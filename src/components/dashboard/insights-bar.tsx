"use client";

import { motion, Variants } from "framer-motion";
import { Timer, Clapperboard, Zap, Crown } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";
import { useTranslations } from "next-intl";

interface InsightsBarProps {
    hoursSaved: number;
    totalSuccess: number;
    successRate: number; // 0-100
    producerTier: "beginner" | "expert" | "factory";
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 24
        }
    },
};

export function InsightsBar({ hoursSaved, totalSuccess, successRate, producerTier }: InsightsBarProps) {
    const t = useTranslations("Dashboard.insights");
    const animatedHours = useCountUp(hoursSaved, 1500);
    const animatedSuccess = useCountUp(totalSuccess, 1500);
    const animatedRate = useCountUp(successRate, 1500);

    // Format helpers
    const displayHours = animatedHours.toFixed(1);
    const displaySuccess = Math.round(animatedSuccess);
    const displayRate = Math.round(animatedRate);

    // Tier Logic Colors
    const isUsine = producerTier === "factory";
    const tierIconColor = isUsine ? "text-amber-400" : producerTier === "expert" ? "text-amber-500" : "text-slate-400";
    const tierTextColor = isUsine
        ? "bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 text-transparent bg-clip-text font-bold"
        : producerTier === "expert"
            ? "text-amber-500 font-semibold"
            : "text-slate-300 font-medium";

    // 100% Glow Logic
    const isPerfect = successRate === 100;

    return (
        <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Temps gagné */}
            <motion.div
                variants={itemVariants}
                className="bg-white/5 backdrop-blur-lg border border-amber-500/20 rounded-xl p-5 shadow-[0_4px_30px_rgba(0,0,0,0.1)] flex items-center gap-4"
                style={{ willChange: "transform" }}
            >
                <div className="p-3 bg-amber-500/10 rounded-lg">
                    <Timer className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground font-medium">{t("timeSaved")}</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                        {displayHours} h
                    </p>
                </div>
            </motion.div>

            {/* Médias générés */}
            <motion.div
                variants={itemVariants}
                className="bg-white/5 backdrop-blur-lg border border-amber-500/20 rounded-xl p-5 shadow-[0_4px_30px_rgba(0,0,0,0.1)] flex items-center gap-4"
                style={{ willChange: "transform" }}
            >
                <div className="p-3 bg-amber-500/10 rounded-lg">
                    <Clapperboard className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground font-medium">{t("mediaGenerated")}</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                        {displaySuccess}
                    </p>
                </div>
            </motion.div>

            {/* Taux de succès */}
            <motion.div
                variants={itemVariants}
                className="bg-white/5 backdrop-blur-lg border border-amber-500/20 rounded-xl p-5 shadow-[0_4px_30px_rgba(0,0,0,0.1)] flex items-center gap-4"
                style={{ willChange: "transform" }}
            >
                <div className={`p-3 rounded-lg transition-colors duration-500 ${isPerfect ? 'bg-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'bg-amber-500/10'}`}>
                    <Zap className={`h-6 w-6 ${isPerfect ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-amber-400'}`} />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground font-medium">{t("successRate")}</p>
                    <p className={`text-2xl font-bold tracking-tight ${isPerfect ? 'bg-gradient-to-r from-amber-200 to-yellow-500 text-transparent bg-clip-text' : 'text-foreground'}`}>
                        {displayRate}%
                    </p>
                </div>
            </motion.div>

            {/* Statut Producteur */}
            <motion.div
                variants={itemVariants}
                className="bg-white/5 backdrop-blur-lg border border-amber-500/20 rounded-xl p-5 shadow-[0_4px_30px_rgba(0,0,0,0.1)] flex items-center gap-4"
                style={{ willChange: "transform" }}
            >
                <div className={`p-3 rounded-lg ${isUsine ? 'bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-amber-500/10'}`}>
                    <Crown className={`h-6 w-6 ${tierIconColor}`} />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground font-medium">{t("producerStatus")}</p>
                    <p className={`text-xl tracking-tight leading-none mt-1 ${tierTextColor}`} style={{ willChange: isUsine ? "transform" : "auto" }}>
                        {t(`tiers.${producerTier}`)}
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}
