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

type Step = "product" | "strategy" | "style" | "output";

const steps: { key: Step; label: string; icon: string }[] = [
    { key: "product", label: "Product Info", icon: "1" },
    { key: "strategy", label: "AI Strategy", icon: "✨" },
    { key: "style", label: "Style & Theme", icon: "2" },
    { key: "output", label: "Output Settings", icon: "3" },
];

const FORMAT_OPTIONS = [
    {
        value: "1080x1920",
        label: "Story (1080×1920)",
        description: "Best for TikTok / Reels",
        icon: Smartphone,
    },
    {
        value: "1080x1080",
        label: "Square (1080×1080)",
        description: "Best for Instagram / Facebook Feed",
        icon: Square,
    },
    {
        value: "1920x1080",
        label: "Landscape (1920×1080)",
        description: "Best for YouTube / Web",
        icon: Monitor,
    },
] as const;

export default function StudioPage() {
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
            toast.error(batchError?.message || "Failed to create batch");
            setLoading(false);
            return;
        }

        toast.success("Batch created! Starting 10 renders…");

        // 2. Trigger multi-render via API route
        try {
            const res = await fetch("/api/render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batchId: batch.id, inputData }),
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "Failed to start renders");
                setLoading(false);
                return;
            }

            toast.success(
                `🚀 ${data.jobCount} renders launched! Track progress on the Dashboard.`
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
            <h1 className="text-2xl font-bold tracking-tight mb-2">Studio</h1>
            <p className="text-muted-foreground text-sm mb-8">
                Create a full ad bundle — 8 images + 2 videos powered by AI.
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
                            <CardTitle className="mb-1">Product Information</CardTitle>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="productName">Product Name *</Label>
                                <Input
                                    id="productName"
                                    placeholder="e.g., Midnight Elixir"
                                    value={form.productName}
                                    onChange={(e) => update("productName", e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="tagline">Tagline *</Label>
                                <Input
                                    id="tagline"
                                    placeholder="e.g., Luxury Redefined"
                                    value={form.tagline}
                                    onChange={(e) => update("tagline", e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label>Product Images</Label>
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
                                <Label htmlFor="projectName">Batch Name (optional)</Label>
                                <Input
                                    id="projectName"
                                    placeholder="e.g., Q1 Campaign"
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
                                AI Creative Strategy
                            </CardTitle>
                            {!strategy ? (
                                <div className="text-center py-8 space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Let Gemini craft 10 high-converting ad concepts for
                                        your product.
                                    </p>
                                    <Button
                                        onClick={() => setIntakeOpen(true)}
                                        className="gap-2"
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        Open AI Director
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
                                                            ? "🎬 Video"
                                                            : "🖼 Image"}
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
                                        Regenerate
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {currentStep === "style" && (
                        <>
                            <CardTitle className="mb-1">Style & Theme</CardTitle>
                            <div className="flex flex-col gap-2">
                                <Label>Theme</Label>
                                <Select
                                    value={form.theme}
                                    onValueChange={(v) => update("theme", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="luxury-dark">Luxury Dark</SelectItem>
                                        <SelectItem value="luxury-light">
                                            Luxury Light
                                        </SelectItem>
                                        <SelectItem value="minimal">Minimal</SelectItem>
                                        <SelectItem value="bold">Bold & Vibrant</SelectItem>
                                        <SelectItem value="editorial">Editorial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="accentColor">Accent Color</Label>
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
                            <CardTitle className="mb-1">Output Settings</CardTitle>
                            <div className="flex flex-col gap-2">
                                <Label>Format</Label>
                                <Select
                                    value={form.format}
                                    onValueChange={(v) => update("format", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a format" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FORMAT_OPTIONS.map((opt) => (
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
                                    <Label htmlFor="fps">FPS</Label>
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
                                    <Label htmlFor="duration">Duration (seconds)</Label>
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
                    ← Back
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
                        Next →
                    </Button>
                ) : (
                    <Button onClick={handleSubmit} disabled={loading || !strategy}>
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                Launching 10 Renders…
                            </>
                        ) : (
                            "Generate Bundle (8+2) →"
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
