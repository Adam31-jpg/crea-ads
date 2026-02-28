"use client";

import { useState, useEffect, useRef } from "react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Image, Video, Check, UploadCloud, Globe, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { GENERATION_CONFIG } from "@/config/generation.config";
import { BrandNameBrick } from "./form-bricks/BrandNameBrick";
import { ProductDescBrick } from "./form-bricks/ProductDescBrick";
import { UspsBrick } from "./form-bricks/UspsBrick";
import { AudienceBrick } from "./form-bricks/AudienceBrick";
import { OfferBrick } from "./form-bricks/OfferBrick";
import { SocialProofBrick } from "./form-bricks/SocialProofBrick";
import { IngredientBrick } from "./form-bricks/IngredientBrick";
import { CtaBrick } from "./form-bricks/CtaBrick";
import { MarketingData } from "./form-bricks/types";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
};

export interface AdConcept {
    index: number;
    type: "image" | "video";
    framework: string;
    headline: string;
    subheadline: string;
    cta: string;
    visualDirection: string;
    colorMood: string;
    emphasis: string;
    logo_position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;
    background_prompt: string;
}

interface MarketingIntakeProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialMarketingPrompt?: { productDescription: string; usps: string[]; targetAudience: string; } | null;
    initialStrategy?: AdConcept[] | null;
    initialTargetLanguage?: string;
    /** Selected theme from Step 1 — forwarded to strategy API so Gemini writes
     *  prompts inside the correct aesthetic world from the very first call. */
    theme?: string;
    /** Brand colors from Step 1 — forwarded so Gemini can curate them
     *  for adaptive_text_color before the user even sees the strategy. */
    colors?: { primary: string; secondary: string; tertiary: string };
    onStrategyReady: (concepts: AdConcept[], logoUrl: string | null, targetLanguage: string, marketingPrompt: { productDescription: string; usps: string[]; targetAudience: string; }, isStrategyReused: boolean) => void;
}

export function MarketingIntake({
    open,
    onOpenChange,
    initialMarketingPrompt,
    initialStrategy,
    initialTargetLanguage,
    theme,
    colors,
    onStrategyReady,
}: MarketingIntakeProps) {
    const [data, setData] = useState<MarketingData>({
        brandName: "",
        productDescription: initialMarketingPrompt?.productDescription || "",
        usps: initialMarketingPrompt?.usps || ["", "", ""],
        targetAudience: initialMarketingPrompt?.targetAudience || "",
        targetLanguage: initialTargetLanguage || "Français",
        offerText: "",
        socialProof: "",
        keyIngredient: "",
        customCta: "",
    });

    const handleChange = (partial: Partial<MarketingData>) => {
        setData(prev => ({ ...prev, ...partial }));
    };
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [loading, setLoading] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [isBoostsOpen, setIsBoostsOpen] = useState(false);
    const genProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [concepts, setConcepts] = useState<AdConcept[] | null>(null);
    const isSubmitting = useRef(false);
    const t = useTranslations("Dashboard.studio.intake");

    const canGenerate =
        data.productDescription.length > 10 &&
        data.usps[0].length > 0 &&
        data.targetAudience.length > 0;

    const isUnchanged = initialMarketingPrompt &&
        data.productDescription === initialMarketingPrompt.productDescription &&
        data.targetAudience === initialMarketingPrompt.targetAudience &&
        data.targetLanguage === (initialTargetLanguage || "Français") &&
        JSON.stringify(data.usps) === JSON.stringify(initialMarketingPrompt.usps);

    // Deep State Hydration on Modal Open
    useEffect(() => {
        if (open) {
            console.log("Modal received initialData:", initialMarketingPrompt);
            if (initialMarketingPrompt) {
                setData(prev => ({
                    ...prev,
                    productDescription: initialMarketingPrompt.productDescription,
                    usps: initialMarketingPrompt.usps,
                    targetAudience: initialMarketingPrompt.targetAudience,
                    targetLanguage: initialTargetLanguage || "Français"
                }));
            }
            // Clear concepts state if user opens modal again (to force them to see the form or the strategy grid natively)
            if (initialStrategy && isUnchanged) {
                // Do not force clear if they haven't modified things
            } else {
                setConcepts(null);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "image/png") {
            toast.error(t("form.logoError"));
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("Le logo dépasse la taille maximum de 10Mo.");
            return;
        }

        setUploadingLogo(true);
        try {
            const presignRes = await fetch("/api/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, contentType: file.type }),
            });
            if (!presignRes.ok) throw new Error("Failed to get upload URL");
            const { presignedUrl, publicUrl } = await presignRes.json();

            const uploadRes = await fetch(presignedUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            });
            if (!uploadRes.ok) {
                const errBody = await uploadRes.text().catch(() => "<unreadable>");
                console.error(`[S3 Logo Upload] ${uploadRes.status} ${uploadRes.statusText}`, errBody);
                throw new Error(`S3 ${uploadRes.status}: ${uploadRes.statusText}`);
            }

            setLogoUrl(publicUrl);
            toast.success(t("form.logoSuccess"));
        } catch (err) {
            console.error("[S3 Logo Upload] Unexpected error:", err);
            toast.error(t("form.logoUploadFailed"));
        }
        setUploadingLogo(false);
    };

    const handleGenerate = async () => {
        setLoading(true);
        setConcepts(null);
        setGenProgress(0);

        // Simulated progress: ramps 0 → 90% over ~60 s with easing.
        // Each tick adds (90 - current) * fraction — progress slows near 90%.
        const TICK_MS = 400;
        const EASE_FACTOR = 0.012; // controls how fast it asymptotes to 90
        genProgressRef.current = setInterval(() => {
            setGenProgress(prev => {
                const delta = (90 - prev) * EASE_FACTOR;
                const next = prev + Math.max(delta, 0.05);
                return Math.min(next, 90);
            });
        }, TICK_MS);

        try {
            const res = await fetch("/api/strategy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productDescription: data.productDescription,
                    usps: data.usps,
                    targetAudience: data.targetAudience,
                    logoUrl,
                    targetLanguage: data.targetLanguage,
                    theme: theme ?? "luxe-sombre",
                    colors: colors ?? { primary: "#FFFFFF", secondary: "#888888", tertiary: "#000000" },
                    offerText: data.offerText,
                    socialProof: data.socialProof,
                    keyIngredient: data.keyIngredient,
                    customCta: data.customCta,
                    brandName: data.brandName,
                }),
            });

            // Stop the simulation ticker and snap to 100%
            if (genProgressRef.current) clearInterval(genProgressRef.current);
            setGenProgress(100);

            const responseData = await res.json();

            if (!res.ok) {
                const knownErrors = ["unauthorized", "noApiKey", "missingFields", "invalidFormat", "insufficient_funds"];
                if (responseData.error && knownErrors.includes(responseData.error)) {
                    toast.error(t(`errors.${responseData.error}` as any, {
                        total: GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH,
                        cost: GENERATION_CONFIG.STRATEGY_SPARK_COST
                    }));
                } else {
                    toast.error(t("toasts.generateFailed"));
                }
                setLoading(false);
                setGenProgress(0);
                return;
            }

            setConcepts(responseData.concepts);
            toast.success(t("toasts.generateSuccess", { total: GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH }));
        } catch {
            if (genProgressRef.current) clearInterval(genProgressRef.current);
            toast.error(t("toasts.connectFailed"));
        }

        // Reset progress after a brief pause so the user sees 100% then it fades
        setTimeout(() => setGenProgress(0), 600);
        setLoading(false);
    };

    const handleConfirm = () => {
        if (concepts) {
            onStrategyReady(concepts, logoUrl, data.targetLanguage, {
                productDescription: data.productDescription,
                usps: data.usps,
                targetAudience: data.targetAudience
            }, false);
            onOpenChange(false);
        }
    };

    const handleReuseStrategy = () => {
        if (initialStrategy && initialMarketingPrompt) {
            // Instantly bypass generation and use the imported strategy
            onStrategyReady(initialStrategy, logoUrl, data.targetLanguage, initialMarketingPrompt, true);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl bg-[#0A0A0A]/90 backdrop-blur-xl border-zinc-800 text-zinc-100 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                            <Sparkles className="h-6 w-6 text-amber-500 animate-pulse" />
                            {t("title")}
                        </DialogTitle>
                        {isUnchanged && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 px-2.5 py-1 text-xs cursor-help">
                                            Stratégie réutilisée ✅
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[300px] text-xs">
                                        <p>Vous économisez les Sparks liés à la génération IA en conservant vos textes. Seuls les frais de rendu vidéo et image s'appliquent.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    <DialogDescription className="text-zinc-400 text-base">
                        {t("subtitle", {
                            total: GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH,
                            images: GENERATION_CONFIG.IMAGE_COUNT,
                            videos: GENERATION_CONFIG.VIDEO_COUNT
                        })}
                    </DialogDescription>
                </DialogHeader>

                {/* Input Fields */}
                {!concepts && (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="space-y-6 mt-4"
                    >
                        <motion.div variants={itemVariants} className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-orange-400 font-medium text-sm flex items-start gap-3">
                            <Sparkles className="h-5 w-5 shrink-0 mt-0.5" />
                            <p dangerouslySetInnerHTML={{ __html: t("expertTip") }} />
                        </motion.div>

                        <BrandNameBrick data={data} onChange={handleChange} t={t} />
                        <ProductDescBrick data={data} onChange={handleChange} t={t} />
                        <UspsBrick data={data} onChange={handleChange} t={t} />

                        {/* Section C: Audience, Identité & Logo */}
                        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AudienceBrick data={data} onChange={handleChange} t={t} />

                            {/* Brand Logo Upload */}
                            <div className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl flex flex-col justify-between">
                                <div className="space-y-1">
                                    <Label className="text-zinc-300 font-medium tracking-wide flex items-center gap-2">
                                        <UploadCloud className="h-4 w-4 text-zinc-500" />
                                        {t("sections.brandOption")}
                                    </Label>
                                    <p className="text-[11px] text-zinc-500 pt-1">
                                        {t("form.brandLogoTooltip")}
                                    </p>
                                </div>

                                <div className="relative group mt-auto">
                                    <Input
                                        type="file"
                                        accept="image/png"
                                        onChange={handleLogoUpload}
                                        disabled={uploadingLogo}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/50 border-2 border-dashed border-zinc-700 group-hover:border-amber-500/50 rounded-lg transition-colors h-10">
                                        <div className="flex items-center gap-2 text-sm text-zinc-400 group-hover:text-amber-400/80 transition-colors truncate">
                                            <span className="truncate pr-8">{logoUrl ? t("form.logoSuccess") : t("form.brandLogo")}</span>
                                        </div>
                                        {uploadingLogo && <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0 absolute right-3" />}
                                        {logoUrl && !uploadingLogo && <Check className="h-4 w-4 text-green-500 shrink-0 absolute right-3" />}
                                    </div>
                                    {logoUrl && (
                                        <div className="absolute top-1 right-12 h-8 w-8 bg-zinc-900 rounded border border-zinc-700 p-1 pointer-events-none z-20">
                                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>

                        {/* Optional High-Impact Bricks */}
                        <motion.div variants={itemVariants} className="pt-4 border-t border-zinc-800/50">
                            <div className="w-full">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsBoostsOpen(!isBoostsOpen);
                                    }}
                                    className="flex w-full items-center justify-between py-2 mb-2 outline-none group"
                                >
                                    <Label className="text-zinc-400 font-medium tracking-wide flex items-center cursor-pointer group-hover:text-zinc-300 transition-colors">
                                        <Sparkles className="h-4 w-4 mr-2 text-zinc-500 group-hover:text-amber-500 transition-colors" />
                                        {t("optionalBoosts")}
                                    </Label>
                                    <motion.div
                                        animate={{ rotate: isBoostsOpen ? 180 : 0 }}
                                        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                                    >
                                        <ChevronDown className="h-4 w-4 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                                    </motion.div>
                                </button>

                                <AnimatePresence initial={false}>
                                    {isBoostsOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 pt-2">
                                                <OfferBrick data={data} onChange={handleChange} t={t} />
                                                <SocialProofBrick data={data} onChange={handleChange} t={t} />
                                                <IngredientBrick data={data} onChange={handleChange} t={t} />
                                                <CtaBrick data={data} onChange={handleChange} t={t} />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>


                        <motion.div variants={itemVariants} className="pt-2">
                            <AnimatePresence mode="popLayout">
                                {isUnchanged ? (
                                    <motion.div
                                        key="btn-reuse"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Button
                                            onClick={handleReuseStrategy}
                                            disabled={!canGenerate}
                                            className="w-full h-12 gap-2 text-base font-bold text-white bg-green-600 hover:bg-green-500 border-none shadow-[0_0_20px_rgba(22,163,74,0.3)] hover:shadow-[0_0_30px_rgba(22,163,74,0.5)] transition-all disabled:opacity-50 disabled:shadow-none"
                                        >
                                            <Check className="h-5 w-5" />
                                            Utiliser la stratégie actuelle (0 Spark)
                                        </Button>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="btn-gen"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Button
                                            onClick={handleGenerate}
                                            disabled={!canGenerate || loading}
                                            className="relative w-full h-12 gap-2 text-base font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-none shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all disabled:opacity-50 disabled:shadow-none overflow-hidden"
                                        >
                                            {/* Animated fill bar behind the label */}
                                            {loading && genProgress > 0 && (
                                                <span
                                                    className="pointer-events-none absolute inset-0 bg-white/10 origin-left transition-transform duration-300"
                                                    style={{ transform: `scaleX(${genProgress / 100})` }}
                                                />
                                            )}
                                            {loading ? (
                                                <>
                                                    <Loader2 className="relative h-5 w-5 animate-spin shrink-0" />
                                                    <span className="relative">
                                                        {t("buttons.generating")}
                                                        {genProgress > 0 && (
                                                            <span className="ml-2 tabular-nums font-black">
                                                                {Math.round(genProgress)}%
                                                            </span>
                                                        )}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="h-5 w-5 animate-pulse" />
                                                    {t("buttons.generate")} ({GENERATION_CONFIG.STRATEGY_SPARK_COST} Sparks)
                                                </>
                                            )}
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}

                {/* Strategy Preview Grid */}
                {concepts && (
                    <div className="space-y-4 mt-2">
                        <div className="grid grid-cols-2 gap-3">
                            {concepts.map((concept) => (
                                <div
                                    key={concept.index}
                                    className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] uppercase tracking-wider"
                                        >
                                            {concept.framework}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            {concept.type === "video" ? (
                                                <Video className="h-3.5 w-3.5 text-brand" />
                                            ) : (
                                                <Image className="h-3.5 w-3.5" />
                                            )}
                                            <span className="text-[10px]">
                                                #{concept.index + 1}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm font-semibold leading-tight">
                                        {concept.headline}
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-snug">
                                        {concept.subheadline}
                                    </p>
                                    <div className="flex items-center justify-between pt-1">
                                        <Badge variant="outline" className="text-[10px]">
                                            {concept.cta}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground">
                                            {concept.colorMood}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setConcepts(null)}
                                className="flex-1"
                            >
                                {t("buttons.regenerate")}
                            </Button>
                            <Button onClick={handleConfirm} className="flex-1 gap-2">
                                <Check className="h-4 w-4" />
                                {t("buttons.confirm")}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
