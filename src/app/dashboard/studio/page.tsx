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
        theme: "luxury-dark",
        accentColor: "#D4AF37",
        format: "1080x1920",
        fps: 30,
        durationSec: 6,
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
                },
            ],
            strategy: strategy,
            theme: form.theme,
            accentColor: form.accentColor,
            format: form.format,
            fps: form.fps,
            durationSec: form.durationSec,
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
                                <p className="text-xs text-amber-500 font-medium bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-md">
                                    {t("tips.proTip")}
                                </p>
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
                        <>
                            <CardTitle className="mb-1">{t("form.styleTheme")}</CardTitle>
                            <div className="flex flex-col gap-2">
                                <Label>{t("form.theme")}</Label>
                                <Select
                                    value={form.theme}
                                    onValueChange={(v) => update("theme", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("form.themePlaceholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="luxury-dark">{t("themes.luxury-dark")}</SelectItem>
                                        <SelectItem value="luxury-light">
                                            {t("themes.luxury-light")}
                                        </SelectItem>
                                        <SelectItem value="minimal">{t("themes.minimal")}</SelectItem>
                                        <SelectItem value="bold">{t("themes.bold")}</SelectItem>
                                        <SelectItem value="editorial">{t("themes.editorial")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="accentColor">{t("form.accentColor")}</Label>
                                <div className="flex items-center gap-3">
                                    <input
                                        id="accentColor"
                                        type="color"
                                        value={form.accentColor}
                                        onChange={(e) => update("accentColor", e.target.value)}
                                        className="h-9 w-12 rounded-md border border-input bg-transparent cursor-pointer"
                                    />
                                    <span className="text-sm text-muted-foreground font-mono">
                                        {form.accentColor}
                                    </span>
                                </div>
                            </div>
                        </>
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="fps">{t("form.fps")}</Label>
                                    <Input
                                        id="fps"
                                        type="number"
                                        value={form.fps.toString()}
                                        onChange={(e) =>
                                            update("fps", parseInt(e.target.value) || 30)
                                        }
                                        min={24}
                                        max={60}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="duration">{t("form.duration")}</Label>
                                    <Input
                                        id="duration"
                                        type="number"
                                        value={form.durationSec.toString()}
                                        onChange={(e) =>
                                            update(
                                                "durationSec",
                                                parseInt(e.target.value) || 6
                                            )
                                        }
                                        min={3}
                                        max={30}
                                    />
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
                onStrategyReady={(concepts) => setStrategy(concepts)}
            />
        </div>
    );
}
