"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useSpySession, type StoreAnalysis } from "@/hooks/useSpySession";

interface StoreAnalysisFormProps {
    onConfirm: () => void;
}

export function StoreAnalysisForm({ onConfirm }: StoreAnalysisFormProps) {
    const t = useTranslations("SpyMode.step1");
    const { storeAnalysis, setStoreAnalysis, updateStoreAnalysis } = useSpySession();

    const [storeUrl, setStoreUrl] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showManual, setShowManual] = useState(false);

    // Manual form state
    const [manualFields, setManualFields] = useState({
        storeName: "",
        productCategory: "",
        niche: "",
        priceRange: "",
        usps: "",
        toneOfVoice: "",
        targetMarket: "",
    });

    async function handleAnalyze() {
        if (!storeUrl.trim()) return;
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/spy/analyze-store", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeUrl }),
            });
            const data = await res.json();

            if (data.status === "manual_fallback") {
                setShowManual(true);
                toast.info(t("manualFallbackDesc"));
            } else if (data.status === "failed") {
                toast.error(t("manualFallbackDesc"));
                setShowManual(true);
            } else if (data.status === "done") {
                setStoreAnalysis({
                    id: data.storeAnalysisId,
                    storeUrl,
                    storeName: data.storeName ?? null,
                    productCategory: data.productCategory ?? null,
                    niche: data.niche ?? null,
                    priceRange: data.priceRange ?? null,
                    usps: data.usps ?? null,
                    toneOfVoice: data.toneOfVoice ?? null,
                    targetMarket: data.targetMarket ?? null,
                    status: "done",
                });
            }
        } catch {
            toast.error(t("manualFallbackDesc"));
            setShowManual(true);
        } finally {
            setIsAnalyzing(false);
        }
    }

    async function handleManualSubmit() {
        try {
            const uspsArray = manualFields.usps
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean);

            const res = await fetch("/api/spy/analyze-store/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    storeUrl,
                    ...manualFields,
                    usps: uspsArray,
                }),
            });
            const data = await res.json();

            if (data.storeAnalysisId) {
                setStoreAnalysis({
                    id: data.storeAnalysisId,
                    storeUrl,
                    storeName: manualFields.storeName || null,
                    productCategory: manualFields.productCategory || null,
                    niche: manualFields.niche || null,
                    priceRange: manualFields.priceRange || null,
                    usps: uspsArray.length > 0 ? uspsArray : null,
                    toneOfVoice: manualFields.toneOfVoice || null,
                    targetMarket: manualFields.targetMarket || null,
                    status: "manual_fallback",
                });
            }
        } catch {
            toast.error("Failed to save. Please try again.");
        }
    }

    // Editable review mode — analysis done
    if (storeAnalysis) {
        return (
            <Card className="border-border bg-card">
                <CardHeader>
                    <CardTitle className="text-lg">{t("title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field
                            label={t("fields.storeName")}
                            value={storeAnalysis.storeName ?? ""}
                            onChange={(v) => updateStoreAnalysis({ storeName: v })}
                        />
                        <Field
                            label={t("fields.productCategory")}
                            value={storeAnalysis.productCategory ?? ""}
                            onChange={(v) => updateStoreAnalysis({ productCategory: v })}
                        />
                        <Field
                            label={t("fields.niche")}
                            value={storeAnalysis.niche ?? ""}
                            onChange={(v) => updateStoreAnalysis({ niche: v })}
                        />
                        <Field
                            label={t("fields.priceRange")}
                            value={storeAnalysis.priceRange ?? ""}
                            onChange={(v) => updateStoreAnalysis({ priceRange: v })}
                        />
                        <Field
                            label={t("fields.toneOfVoice")}
                            value={storeAnalysis.toneOfVoice ?? ""}
                            onChange={(v) => updateStoreAnalysis({ toneOfVoice: v })}
                        />
                        <Field
                            label={t("fields.targetMarket")}
                            value={storeAnalysis.targetMarket ?? ""}
                            onChange={(v) => updateStoreAnalysis({ targetMarket: v })}
                        />
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                            {t("fields.usps")}
                        </Label>
                        <textarea
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={(storeAnalysis.usps ?? []).join("\n")}
                            onChange={(e) =>
                                updateStoreAnalysis({
                                    usps: e.target.value.split("\n").filter(Boolean),
                                })
                            }
                        />
                    </div>
                    <Button onClick={onConfirm} className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none">
                        {t("confirmBtn")}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // Manual form fallback
    if (showManual) {
        return (
            <Card className="border-border bg-card">
                <CardHeader>
                    <div className="flex items-center gap-2 text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        <CardTitle className="text-lg">{t("manualFallbackTitle")}</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">{t("manualFallbackDesc")}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(
                            [
                                ["storeName", t("fields.storeName")],
                                ["productCategory", t("fields.productCategory")],
                                ["niche", t("fields.niche")],
                                ["priceRange", t("fields.priceRange")],
                                ["toneOfVoice", t("fields.toneOfVoice")],
                                ["targetMarket", t("fields.targetMarket")],
                            ] as [keyof typeof manualFields, string][]
                        ).map(([key, label]) => (
                            <div key={key}>
                                <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
                                <Input
                                    value={manualFields[key]}
                                    onChange={(e) =>
                                        setManualFields((f) => ({ ...f, [key]: e.target.value }))
                                    }
                                />
                            </div>
                        ))}
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                            {t("fields.usps")} <span className="opacity-60">(one per line)</span>
                        </Label>
                        <textarea
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={manualFields.usps}
                            onChange={(e) =>
                                setManualFields((f) => ({ ...f, usps: e.target.value }))
                            }
                        />
                    </div>
                    <Button
                        onClick={async () => {
                            await handleManualSubmit();
                        }}
                        disabled={!manualFields.storeName}
                        className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none"
                    >
                        {t("confirmBtn")}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // Default: URL input
    return (
        <Card className="border-border bg-card">
            <CardHeader>
                <CardTitle className="text-lg">{t("title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder={t("placeholder")}
                        value={storeUrl}
                        onChange={(e) => setStoreUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !isAnalyzing && handleAnalyze()}
                        disabled={isAnalyzing}
                        className="flex-1"
                    />
                    <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !storeUrl.trim()}
                        className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none gap-2 shrink-0"
                    >
                        {isAnalyzing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Search className="h-4 w-4" />
                        )}
                        {isAnalyzing ? t("analyzing") : t("analyzeBtn")}
                    </Button>
                </div>
                <button
                    type="button"
                    onClick={() => setShowManual(true)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                    {t("manualFallbackTitle")} — fill manually
                </button>
            </CardContent>
        </Card>
    );
}

function Field({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
            <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}
