"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
import {
    Smartphone,
    Square,
    Monitor,
    Sparkles,
    Loader2,
    Check,
} from "lucide-react";
import { useTranslations } from "next-intl";

type Step = "product" | "strategy" | "style" | "output";

const getSteps = (t: any): { key: Step; label: string; icon: string }[] => [
    { key: "product", label: t("steps.product"), icon: "1" },
    { key: "strategy", label: t("steps.strategy"), icon: "✨" },
    { key: "style", label: t("steps.style"), icon: "2" },
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

const THEMES = [
    { id: "luxe-sombre", image: "/images/themes/luxe-sombre.jpg", text: "text-zinc-200" },
    { id: "studio-white", image: "/images/themes/studio-white.jpg", text: "text-zinc-800" },
    { id: "neon", image: "/images/themes/neon.jpg", text: "text-zinc-100" },
    { id: "nature", image: "/images/themes/nature.jpg", text: "text-zinc-900" },
    { id: "pop", image: "/images/themes/pop.jpg", text: "text-zinc-800" },
    { id: "sunset", image: "/images/themes/sunset.jpg", text: "text-zinc-100" },
];

const ThemePreviewSVG = () => (
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
    const [userId, setUserId] = useState<string>("");
    const [intakeOpen, setIntakeOpen] = useState(false);
    const [strategy, setStrategy] = useState<AdConcept[] | null>(null);
    const router = useRouter();
    const supabase = createClient();

    // Form state
    const [form, setForm] = useState({
        projectName: "",
        productName: "",
        tagline: "",
        images: [] as string[],
        heroImageIndex: 0,
        logoUrl: null as string | null,
        theme: "luxe-sombre",
        accentColor: "#F59E0B",
        format: "1080x1920",
        fps: 30,
        durationSec: 6,
        targetLanguage: "Français",
    });

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserId(data.user.id);
        });
    }, [supabase]);

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
            theme: form.theme,
            accentColor: form.accentColor,
            format: form.format,
            fps: form.fps, // Always 30
            durationSec: form.durationSec,
            targetLanguage: form.targetLanguage,
        };

        // 1. Create batch in Supabase
        const { data: batch, error: batchError } = await supabase
            .from("batches")
            .insert([
                {
                    project_name: form.projectName || form.productName,
                    input_data: inputData,
                },
            ])
            .select("id")
            .single();

        if (batchError || !batch) {
            toast.error(batchError?.message || t("toasts.batchFailed"));
            setLoading(false);
            return;
        }

        toast.success(t("toasts.batchSuccess"));

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

    // Validation
    const canProceed: Record<Step, boolean> = {
        product: form.productName.length > 0 && form.tagline.length > 0,
        strategy: strategy !== null && strategy.length === 10,
        style: true,
        output: true,
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight mb-2">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mb-8">
                {t("subtitle")}
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

                    {currentStep === "strategy" && (
                        <>
                            <CardTitle className="mb-1 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-brand" />
                                {t("strategy.title")}
                            </CardTitle>
                            {!strategy ? (
                                <div className="text-center py-8 space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        {t("strategy.emptyState")}
                                    </p>
                                    <Button
                                        onClick={() => setIntakeOpen(true)}
                                        className="gap-2"
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        {t("buttons.openDirector")}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        {strategy.map((c) => (
                                            <div
                                                key={c.index}
                                                className="rounded-md border border-border/50 bg-muted/20 p-2.5"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-medium text-brand uppercase">
                                                        {c.framework}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {c.type === "video"
                                                            ? t("strategy.video")
                                                            : t("strategy.image")}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-semibold leading-tight">
                                                    {c.headline}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    {c.cta}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIntakeOpen(true)}
                                        className="gap-1.5"
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        {t("buttons.regenerate")}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {currentStep === "style" && (
                        <div style={{ "--accent-color": form.accentColor } as React.CSSProperties} className="flex flex-col gap-6">
                            <CardTitle className="mb-0">{t("form.styleTheme")}</CardTitle>
                            <div className="flex flex-col gap-3">
                                <Label className="text-sm font-semibold text-zinc-300">{t("form.theme")}</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {THEMES.map((theme) => (
                                        <div
                                            key={theme.id}
                                            onClick={() => update("theme", theme.id)}
                                            className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 ${form.theme === theme.id ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-transparent hover:border-zinc-700'}`}
                                        >
                                            {/* Background Image Container */}
                                            <div className="absolute inset-0 overflow-hidden bg-zinc-900">
                                                <img
                                                    src={theme.image}
                                                    alt={`Theme ${theme.id}`}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            </div>

                                            {/* Contrast Overlay for SVG Legibility */}
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500"></div>

                                            {/* SVG Content overlay */}
                                            <div className={`relative p-2 h-32 flex flex-col items-center justify-center ${theme.text} drop-shadow-md`}>
                                                <ThemePreviewSVG />
                                            </div>

                                            {/* Theme Label */}
                                            <div className="absolute bottom-0 inset-x-0 bg-black/40 backdrop-blur-md p-2 text-center text-xs font-semibold text-white border-t border-white/10 text-shadow-sm">
                                                {t(`themes.${theme.id}`)}
                                            </div>

                                            {/* Selection Ring */}
                                            {form.theme === theme.id && (
                                                <div className="absolute top-2 right-2 h-5 w-5 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10">
                                                    <Check className="h-3 w-3 text-black" strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Label htmlFor="accentColor" className="text-sm font-semibold text-zinc-300">{t("form.accentColor")}</Label>
                                <div className="flex items-center gap-4 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-zinc-700 shadow-inner">
                                        <input
                                            id="accentColor"
                                            type="color"
                                            value={form.accentColor}
                                            onChange={(e) => update("accentColor", e.target.value)}
                                            className="absolute -top-2 -left-2 w-32 h-32 cursor-pointer p-0 border-0"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm text-zinc-300 font-medium">Couleur Principale</span>
                                        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                                            {form.accentColor}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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
                            const idx = steps.findIndex(
                                (s) => s.key === currentStep
                            );
                            if (idx < steps.length - 1)
                                setCurrentStep(steps[idx + 1].key);
                        }}
                        disabled={!canProceed[currentStep]}
                    >
                        {t("buttons.next")}
                    </Button>
                ) : (
                    <Button onClick={handleSubmit} disabled={loading || !strategy}>
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                {t("buttons.launching")}
                            </>
                        ) : (
                            t("buttons.generate")
                        )}
                    </Button>
                )}
            </div>

            {/* Marketing Intake Modal */}
            <MarketingIntake
                open={intakeOpen}
                onOpenChange={setIntakeOpen}
                onStrategyReady={(concepts, logoUrl, lang) => {
                    setStrategy(concepts);
                    setForm((prev) => ({
                        ...prev,
                        logoUrl: logoUrl || prev.logoUrl,
                        targetLanguage: lang
                    }));
                    setCurrentStep("style");
                }}
            />
        </div>
    );
}
