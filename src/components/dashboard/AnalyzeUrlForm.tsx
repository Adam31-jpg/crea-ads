"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { useSpySession } from "@/hooks/useSpySession";
import { IndeterminateBar, ProgressMessage } from "@/components/spy/SpySkeleton";

const ANALYSIS_MESSAGES = [
    "Connexion à la boutique...",
    "Extraction des données produit...",
    "Identification du positionnement...",
    "Lecture des USPs & pricing...",
    "Finalisation de l'analyse...",
];

export function AnalyzeUrlForm() {
    const t = useTranslations("SpyMode.step1");
    const router = useRouter();
    const { reset } = useSpySession();
    const [storeUrl, setStoreUrl] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Reset Zustand state when mounting the home page
    useEffect(() => {
        reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleAnalyze() {
        const trimmed = storeUrl.trim();
        if (!trimmed) return;
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/spy/analyze-store", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeUrl: trimmed }),
            });
            const data = await res.json();
            if (data.storeAnalysisId) {
                router.push(`/dashboard/projects/${data.storeAnalysisId}`);
            } else {
                toast.error("Analyse échouée. Vérifiez l'URL et réessayez.");
                setIsAnalyzing(false);
            }
        } catch {
            toast.error("Impossible de contacter le serveur.");
            setIsAnalyzing(false);
        }
    }

    if (isAnalyzing) {
        return (
            <div className="space-y-4 py-4">
                <IndeterminateBar />
                <ProgressMessage messages={ANALYSIS_MESSAGES} />
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            <div className="relative flex-1">
                <input
                    type="url"
                    placeholder={t("placeholder")}
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    className="w-full h-12 pl-4 pr-4 rounded-xl border border-border bg-background/60 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
                    autoComplete="off"
                    spellCheck="false"
                />
            </div>
            <button
                onClick={handleAnalyze}
                disabled={!storeUrl.trim()}
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
            >
                <Zap className="h-4 w-4" />
                Analyser
            </button>
        </div>
    );
}
