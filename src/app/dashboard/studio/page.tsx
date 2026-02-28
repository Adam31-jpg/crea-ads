"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import {
    MarketingIntake,
    type AdConcept,
} from "@/components/dashboard/marketing-intake";
import { ThemeSelector } from "@/components/shared/studio/ThemeSelector";
import { StrategyPreview } from "@/components/shared/studio/StrategyPreview";
import { GENERATION_CONFIG } from "@/config/generation.config";
import {
    Smartphone,
    Square,
    Monitor,
    Sparkles,
    Loader2,
    Check,
} from "lucide-react";
import { useTranslations } from "next-intl";

// Step sequence: product → style → strategy → output
// Critical: theme is locked in step 2 (style) BEFORE the MarketingIntake
// modal opens. When the user clicks "Next" on the style step the modal fires
// immediately so Gemini receives the activeTheme in its first call.
type Step = "product" | "style" | "strategy" | "output";

const getSteps = (t: any): { key: Step; label: string; icon: string }[] => [
    { key: "product", label: t("steps.product"), icon: "1" },
    { key: "style", label: t("steps.style"), icon: "2" },
    { key: "strategy", label: t("steps.strategy"), icon: "✨" },
    { key: "output", label: t("steps.output"), icon: "3" },
];

const getFormatOptions = (t: any) => [
    {
        value: "1080x1920",
        label: t("formats.story.label"),
        description: t("formats.story.desc"),
        icon: Smartphone,
    },
    {
        value: "1080x1080",
        label: t("formats.square.label"),
        description: t("formats.square.desc"),
        icon: Square,
    },
    {
        value: "1920x1080",
        label: t("formats.landscape.label"),
        description: t("formats.landscape.desc"),
        icon: Monitor,
    },
] as const;

export const THEMES = [
    { id: "luxe-sombre", image: "/images/themes/luxe-sombre.jpg", text: "text-zinc-200", palette: { primary: "#D4AF37", secondary: "#1A1A1A", tertiary: "#4A4A4A" } },
    { id: "studio-white", image: "/images/themes/studio-white.jpg", text: "text-zinc-800", palette: { primary: "#000000", secondary: "#F5F5F5", tertiary: "#E0E0E0" } },
    { id: "neon", image: "/images/themes/neon.jpg", text: "text-zinc-100", palette: { primary: "#FF00FF", secondary: "#00FFFF", tertiary: "#09090B" } },
    { id: "nature", image: "/images/themes/nature.jpg", text: "text-zinc-900", palette: { primary: "#2E8B57", secondary: "#F5DEB3", tertiary: "#8FBC8F" } },
    { id: "pop", image: "/images/themes/pop.jpg", text: "text-zinc-800", palette: { primary: "#FF4500", secondary: "#FFD700", tertiary: "#1E90FF" } },
    { id: "sunset", image: "/images/themes/sunset.jpg", text: "text-zinc-100", palette: { primary: "#FF7F50", secondary: "#8A2BE2", tertiary: "#FFDAB9" } },
];

export const ThemePreviewSVG = () => (
    <svg viewBox="0 0 100 100" className="w-full h-full opacity-80" preserveAspectRatio="xMidYMid meet">
        {/* Mock Image Placeholder */}
        <rect x="10" y="10" width="80" height="40" rx="4" fill="currentColor" fillOpacity="0.1" />
        {/* Mock Headline */}
        <rect x="10" y="55" width="60" height="6" rx="3" fill="currentColor" fillOpacity="0.8" />
        <rect x="10" y="65" width="40" height="4" rx="2" fill="currentColor" fillOpacity="0.4" />
        {/* Mock CTA Button mapped to CSS variable */}
        <rect x="10" y="75" width="35" height="12" rx="2" fill="var(--accent-color)" />
        <rect x="15" y="80" width="25" height="2" rx="1" fill="#ffffff" fillOpacity="0.8" />
    </svg>
);

export default function StudioPage() {
    const t = useTranslations("Dashboard.studio");
    const steps = getSteps(t);
    const formatOptions = getFormatOptions(t);

    const [currentStep, setCurrentStep] = useState<Step>("product");
    const [loading, setLoading] = useState(false);
    const { data: sessionData } = useSession();
    const userId = sessionData?.user?.id || "";
    const [intakeOpen, setIntakeOpen] = useState(false);
    const [strategy, setStrategy] = useState<AdConcept[] | null>(null);
    const [isStrategyReused, setIsStrategyReused] = useState(false);
    const [marketingPrompt, setMarketingPrompt] = useState<{ productDescription: string; usps: string[]; targetAudience: string; } | null>(null);
    const router = useRouter();


    // Form state
    const [form, setForm] = useState({
        projectName: "",
        productName: "",
        tagline: "",
        images: [] as string[],
        heroImageIndex: 0,
        logoUrl: null as string | null,
        theme: "luxe-sombre",
        colors: THEMES[0].palette,
        format: "1080x1920",
        fps: 30,
        durationSec: 6,
        targetLanguage: "Français",
    });


    useEffect(() => {
        // Force completely clean slate if normal "New Project" flow
        setForm({
            projectName: "",
            productName: "",
            tagline: "",
            images: [],
            heroImageIndex: 0,
            logoUrl: null,
            theme: "luxe-sombre",
            colors: THEMES[0].palette,
            format: "1080x1920",
            fps: 30,
            durationSec: 6,
            targetLanguage: "Français",
        });
        setMarketingPrompt(null);
        setStrategy(null);
        setIsStrategyReused(false);
    }, []);

    const update = (field: string, value: string | number) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setLoading(true);

        const inputData = {
            products: [
                {
                    productName: form.productName,
                    tagline: form.tagline,
                    images: form.images,
                    heroImageIndex: form.heroImageIndex,
                    logoUrl: form.logoUrl,
                },
            ],
            strategy: strategy,
            marketingPrompt: marketingPrompt,
            isStrategyReused: isStrategyReused,
            theme: form.theme,
            colors: form.colors,
            format: form.format,
            fps: form.fps, // Always 30
            durationSec: form.durationSec,
            targetLanguage: form.targetLanguage,
        };

        // 1. Create batch via API
        const batchRes = await fetch("/api/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectName: form.projectName || form.productName, inputData }),
        });
        const batchData = await batchRes.json();
        if (!batchRes.ok) {
            toast.error(batchData.error || t("toasts.batchFailed"));
            setLoading(false);
            return;
        }
        const batch = batchData;

        toast.success(t("toasts.batchSuccess", { total: GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH }));

        // 2. Trigger multi-render via API route
        try {
            const res = await fetch("/api/render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batchId: batch.id, inputData }),
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || t("toasts.renderFailed"));
                setLoading(false);
                return;
            }

            toast.success(
                t("toasts.renderSuccess", { count: data.jobCount })
            );

            // Removed duplicateBatch clean

            // Navigate to dashboard — realtime will handle progress updates
            router.push("/dashboard");
            router.refresh();
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to start render";
            toast.error(message);
            setLoading(false);
        }
    };

    // Validation — gates the "Next" button per step
    const canProceed: Record<Step, boolean> = {
        product: form.productName.length > 0 && form.tagline.length > 0,
        style: true, // theme always has a default; no blocking required
        strategy: strategy !== null,
        output: true,
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight mb-2">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mb-8">
                {t("subtitle", { images: GENERATION_CONFIG.IMAGE_COUNT, videos: GENERATION_CONFIG.VIDEO_COUNT })}
            </p>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-8">
                {steps.map((step) => (
                    <button
                        key={step.key}
                        onClick={() => setCurrentStep(step.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentStep === step.key
                            ? "bg-brand/10 text-brand border border-brand/25"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                    >
                        <span
                            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${currentStep === step.key
                                ? "bg-brand text-brand-foreground"
                                : "bg-muted text-muted-foreground"
                                }`}
                        >
                            {step.icon}
                        </span>
                        {step.label}
                    </button>
                ))}
            </div>

            {/* Step Content */}
            <Card>
                <CardContent className="pt-6 flex flex-col gap-5">

                    {/* ── Step 1: Product Information ─────────────────────────── */}
                    {currentStep === "product" && (
                        <>
                            <CardTitle className="mb-1">{t("form.productInfo")}</CardTitle>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="productName">{t("form.productName")}</Label>
                                <Input
                                    id="productName"
                                    placeholder={t("form.productNamePlaceholder")}
                                    value={form.productName}
                                    onChange={(e) => update("productName", e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="tagline">{t("form.tagline")}</Label>
                                <Input
                                    id="tagline"
                                    placeholder={t("form.taglinePlaceholder")}
                                    value={form.tagline}
                                    onChange={(e) => update("tagline", e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label>{t("form.productImages")}</Label>
                                <ImageUploader
                                    images={form.images}
                                    heroIndex={form.heroImageIndex}
                                    onImagesChange={(images) =>
                                        setForm((prev) => ({ ...prev, images }))
                                    }
                                    onHeroChange={(index) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            heroImageIndex: index,
                                        }))
                                    }
                                    userId={userId}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="projectName">{t("form.batchName")}</Label>
                                <Input
                                    id="projectName"
                                    placeholder={t("form.batchNamePlaceholder")}
                                    value={form.projectName}
                                    onChange={(e) => update("projectName", e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {/* ── Step 2: Style & Thème ────────────────────────────────
                         Theme is locked HERE before any Gemini call.
                         The "Next" button on this step opens MarketingIntake
                         immediately, passing form.theme + form.colors so
                         the strategy API receives the correct activeTheme.      */}
                    {currentStep === "style" && (
                        <ThemeSelector
                            theme={form.theme}
                            colors={form.colors}
                            update={update}
                            THEMES={THEMES}
                            ThemePreviewSVG={ThemePreviewSVG}
                        />
                    )}

                    {/* ── Step 3: Stratégie IA ─────────────────────────────── */}
                    {currentStep === "strategy" && (
                        <StrategyPreview
                            strategy={strategy}
                            setIntakeOpen={setIntakeOpen}
                        />
                    )}

                    {/* ── Step 4: Output Settings ───────────────────────────── */}
                    {currentStep === "output" && (
                        <>
                            <CardTitle className="mb-1">{t("form.outputSettings")}</CardTitle>
                            <div className="flex flex-col gap-2">
                                <Label>{t("form.format")}</Label>
                                <Select
                                    value={form.format}
                                    onValueChange={(v) => update("format", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("form.formatPlaceholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {formatOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                <div className="flex items-center gap-2">
                                                    <opt.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <div className="flex flex-col">
                                                        <span>{opt.label}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {opt.description}
                                                        </span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-3">
                                    <Label className="text-sm font-semibold text-zinc-300">{t("form.duration")}</Label>
                                    <div className="flex items-center gap-2 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl w-fit">
                                        {[6, 10, 15].map((val) => (
                                            <button
                                                key={val}
                                                onClick={() => update("durationSec", val)}
                                                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${form.durationSec === val
                                                    ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                                    }`}
                                            >
                                                {t(`form.durations.${val}` as any) || `${val}s`}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {t("form.durationHint")}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
                <Button
                    variant="ghost"
                    onClick={() => {
                        const idx = steps.findIndex((s) => s.key === currentStep);
                        if (idx > 0) setCurrentStep(steps[idx - 1].key);
                    }}
                    disabled={currentStep === "product"}
                >
                    {t("buttons.back")}
                </Button>

                {currentStep !== "output" ? (
                    <Button
                        onClick={() => {
                            if (currentStep === "style") {
                                // Theme is now locked — open the intake modal so Gemini
                                // receives form.theme as activeTheme on the very first call.
                                // We advance to the strategy step at the same time so
                                // closing the modal without generating lands on the correct
                                // step (user can still use the "Modifier la stratégie" CTA
                                // inside StrategyPreview to re-open the modal).
                                setCurrentStep("strategy");
                                setIntakeOpen(true);
                                return;
                            }
                            const idx = steps.findIndex(
                                (s) => s.key === currentStep
                            );
                            if (idx < steps.length - 1)
                                setCurrentStep(steps[idx + 1].key);
                        }}
                        disabled={!canProceed[currentStep]}
                        className={currentStep === "style" ? "gap-2" : ""}
                    >
                        {currentStep === "style" ? (
                            <>
                                <Sparkles className="h-4 w-4" />
                                {t("buttons.next") || "Générer la stratégie IA"}
                            </>
                        ) : (
                            t("buttons.next")
                        )}
                    </Button>
                ) : (
                    <Button onClick={handleSubmit} disabled={loading || !strategy} className="gap-2">
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                {t("buttons.launching", { total: GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH })}
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                {t("buttons.generate", {
                                    images: GENERATION_CONFIG.IMAGE_COUNT,
                                    videos: GENERATION_CONFIG.VIDEO_COUNT
                                })}
                                <span className="ml-1 px-2 py-0.5 bg-black/20 rounded text-xs">
                                    {(GENERATION_CONFIG.IMAGE_COUNT * GENERATION_CONFIG.IMAGE_SPARK_COST) + (GENERATION_CONFIG.VIDEO_COUNT * GENERATION_CONFIG.VIDEO_SPARK_COST)} Sparks
                                </span>
                            </>
                        )}
                    </Button>
                )}
            </div>

            {/* Marketing Intake Modal — receives theme + accentColor so the
                strategy API call includes them in the Gemini payload */}
            <MarketingIntake
                open={intakeOpen}
                onOpenChange={setIntakeOpen}
                initialMarketingPrompt={marketingPrompt}
                initialStrategy={strategy}
                initialTargetLanguage={form.targetLanguage}
                theme={form.theme}
                colors={form.colors}
                onStrategyReady={(
                    concepts: AdConcept[],
                    logoUrl: string | null,
                    lang: string,
                    prompt: { productDescription: string; usps: string[]; targetAudience: string; },
                    reused: boolean
                ) => {
                    setStrategy(concepts);
                    setMarketingPrompt(prompt);
                    setIsStrategyReused(reused);
                    setForm((prev) => ({
                        ...prev,
                        logoUrl: logoUrl || prev.logoUrl,
                        targetLanguage: lang
                    }));
                    // Strategy confirmed — advance to output settings.
                    // Theme was locked in step 2; strategy step already active.
                    setCurrentStep("output");
                }}
            />
        </div>
    );
}
