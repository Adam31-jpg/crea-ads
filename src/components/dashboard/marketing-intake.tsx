"use client";

import { useState } from "react";
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
import { Sparkles, Loader2, Image, Video, Check } from "lucide-react";

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
}

interface MarketingIntakeProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStrategyReady: (concepts: AdConcept[]) => void;
}

export function MarketingIntake({
    open,
    onOpenChange,
    onStrategyReady,
}: MarketingIntakeProps) {
    const [productDescription, setProductDescription] = useState("");
    const [usps, setUsps] = useState(["", "", ""]);
    const [targetAudience, setTargetAudience] = useState("");
    const [loading, setLoading] = useState(false);
    const [concepts, setConcepts] = useState<AdConcept[] | null>(null);

    const canGenerate =
        productDescription.length > 10 &&
        usps[0].length > 0 &&
        targetAudience.length > 0;

    const handleGenerate = async () => {
        setLoading(true);
        setConcepts(null);

        try {
            const res = await fetch("/api/strategy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productDescription, usps, targetAudience }),
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "Strategy generation failed");
                setLoading(false);
                return;
            }

            setConcepts(data.concepts);
            toast.success("🧠 AI Strategy generated! Review your 10 concepts.");
        } catch {
            toast.error("Failed to connect to AI");
        }
        setLoading(false);
    };

    const handleConfirm = () => {
        if (concepts) {
            onStrategyReady(concepts);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-brand" />
                        AI Creative Director
                    </DialogTitle>
                    <DialogDescription>
                        Tell us about your product and audience. Gemini will craft 10
                        high-converting ad concepts (8 images + 2 videos).
                    </DialogDescription>
                </DialogHeader>

                {/* Input Fields */}
                {!concepts && (
                    <div className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Label>Product Description</Label>
                            <Textarea
                                placeholder="Describe your product in detail — features, benefits, what makes it special…"
                                value={productDescription}
                                onChange={(e) => setProductDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Top 3 USPs (Arguments de vente)</Label>
                            {usps.map((usp, i) => (
                                <Input
                                    key={i}
                                    placeholder={`USP ${i + 1} — e.g. "Free shipping worldwide"`}
                                    value={usp}
                                    onChange={(e) => {
                                        const next = [...usps];
                                        next[i] = e.target.value;
                                        setUsps(next);
                                    }}
                                />
                            ))}
                        </div>

                        <div className="space-y-2">
                            <Label>Target Audience</Label>
                            <Input
                                placeholder="e.g. Women 25-40, urban, health-conscious, active Instagram users"
                                value={targetAudience}
                                onChange={(e) => setTargetAudience(e.target.value)}
                            />
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={!canGenerate || loading}
                            className="w-full gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating Strategy…
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Generate Strategy
                                </>
                            )}
                        </Button>
                    </div>
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
                                Regenerate
                            </Button>
                            <Button onClick={handleConfirm} className="flex-1 gap-2">
                                <Check className="h-4 w-4" />
                                Confirm & Proceed
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
