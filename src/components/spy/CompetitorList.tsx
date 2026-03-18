"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, RefreshCw, Star, Check } from "lucide-react";
import { toast } from "sonner";
import { useSpySession, type Competitor } from "@/hooks/useSpySession";
import { AdPreviewCard } from "./AdPreviewCard";
import { cn } from "@/lib/utils";

interface CompetitorListProps {
    onConfirm: () => void;
}

const CHANNEL_LABELS: Record<string, string> = {
    facebook_ads: "Meta Ads",
    tiktok: "TikTok",
    instagram: "Instagram",
    google_ads: "Google Ads",
    youtube: "YouTube",
    pinterest: "Pinterest",
    snapchat: "Snapchat",
};

export function CompetitorList({ onConfirm }: CompetitorListProps) {
    const t = useTranslations("SpyMode.step2");
    const { storeAnalysis, competitors, setCompetitors, toggleCompetitor, addManualCompetitor } =
        useSpySession();

    const [isSearching, setIsSearching] = useState(false);
    const [manualName, setManualName] = useState("");
    const [manualUrl, setManualUrl] = useState("");
    const [showManualAdd, setShowManualAdd] = useState(false);

    async function handleSearch() {
        if (!storeAnalysis?.id) return;
        setIsSearching(true);
        try {
            const res = await fetch("/api/spy/find-competitors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeAnalysisId: storeAnalysis.id }),
            });
            const data = await res.json();
            if (data.status === "done") {
                setCompetitors(
                    (data.competitors as Competitor[]).map((c) => ({
                        ...c,
                        marketingChannels: Array.isArray(c.marketingChannels)
                            ? c.marketingChannels
                            : [],
                    })),
                );
                if (data.competitors.length === 0) {
                    toast.info(t("noResults"));
                }
            } else {
                toast.error(t("noResults"));
            }
        } catch {
            toast.error(t("noResults"));
        } finally {
            setIsSearching(false);
        }
    }

    function handleAddManual() {
        if (!manualName.trim() || !storeAnalysis?.id) return;
        const name = manualName.trim();
        const url = manualUrl.trim() || null;
        const metaAdLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(name)}&search_type=keyword_unordered`;
        const tiktokAdLibraryUrl = `https://library.tiktok.com/ads?region=ALL&adv_name=${encodeURIComponent(name)}`;

        addManualCompetitor({
            id: `manual_${Date.now()}`,
            competitorName: name,
            competitorUrl: url,
            positioning: null,
            priceRange: null,
            marketingChannels: [],
            relevanceScore: 5,
            isSelected: true,
            isManual: true,
            metaAdLibraryUrl,
            tiktokAdLibraryUrl,
        });
        setManualName("");
        setManualUrl("");
        setShowManualAdd(false);
    }

    const selectedCount = competitors.filter((c) => c.isSelected).length;

    if (competitors.length === 0 && !isSearching) {
        return (
            <Card className="border-border bg-card">
                <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
                    <p className="text-muted-foreground text-sm">{t("noResults")}</p>
                    <Button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none gap-2"
                    >
                        {isSearching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        {isSearching ? t("searching") : t("findBtn")}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">
                    {selectedCount} / {competitors.length} selected
                </p>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="gap-1.5"
                    >
                        {isSearching ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        {t("reSearch")}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManualAdd((v) => !v)}
                        className="gap-1.5"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {t("addManual")}
                    </Button>
                </div>
            </div>

            {/* Manual add form */}
            {showManualAdd && (
                <Card className="border-border bg-card">
                    <CardContent className="pt-4 flex flex-col gap-3">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Competitor name"
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                                className="flex-1"
                            />
                            <Input
                                placeholder="Website URL (optional)"
                                value={manualUrl}
                                onChange={(e) => setManualUrl(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                onClick={handleAddManual}
                                disabled={!manualName.trim()}
                                size="sm"
                                className="shrink-0"
                            >
                                <Check className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Competitor cards */}
            <div className="space-y-3">
                {competitors.map((competitor) => (
                    <CompetitorCard
                        key={competitor.id}
                        competitor={competitor}
                        onToggle={() => toggleCompetitor(competitor.id)}
                        t={t}
                    />
                ))}
            </div>

            {/* Confirm */}
            {competitors.length > 0 && (
                <Button
                    onClick={onConfirm}
                    disabled={selectedCount === 0}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none"
                >
                    {t("confirmBtn")} ({selectedCount})
                </Button>
            )}
        </div>
    );
}

function CompetitorCard({
    competitor,
    onToggle,
    t,
}: {
    competitor: Competitor;
    onToggle: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    return (
        <Card
            className={cn(
                "border transition-colors cursor-pointer",
                competitor.isSelected ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card opacity-60",
            )}
            onClick={onToggle}
        >
            <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className={cn(
                                    "inline-block w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                                    competitor.isSelected
                                        ? "border-amber-500 bg-amber-500"
                                        : "border-border bg-transparent",
                                )}
                            >
                                {competitor.isSelected && (
                                    <Check className="h-2.5 w-2.5 text-black" />
                                )}
                            </span>
                            <p className="font-semibold text-sm truncate">{competitor.competitorName}</p>
                            {competitor.isManual && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                    Manual
                                </span>
                            )}
                        </div>
                        {competitor.competitorUrl && (
                            <p className="text-xs text-muted-foreground truncate pl-6">
                                {competitor.competitorUrl}
                            </p>
                        )}
                        {competitor.positioning && (
                            <p className="text-xs text-muted-foreground mt-1 pl-6 line-clamp-2">
                                {competitor.positioning}
                            </p>
                        )}
                    </div>

                    {/* Relevance score */}
                    <div className="flex items-center gap-1 shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                                key={i}
                                className={cn(
                                    "h-3 w-3",
                                    i < Math.round(competitor.relevanceScore / 2)
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-muted-foreground/30",
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Channels */}
                {competitor.marketingChannels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-6">
                        {competitor.marketingChannels.map((ch) => (
                            <span
                                key={ch}
                                className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                            >
                                {CHANNEL_LABELS[ch] ?? ch}
                            </span>
                        ))}
                    </div>
                )}

                {/* Ad Library links */}
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    {competitor.metaAdLibraryUrl && (
                        <AdPreviewCard
                            competitorName={competitor.competitorName}
                            platform="meta"
                            adLibraryUrl={competitor.metaAdLibraryUrl}
                        />
                    )}
                    {competitor.tiktokAdLibraryUrl && (
                        <AdPreviewCard
                            competitorName={competitor.competitorName}
                            platform="tiktok"
                            adLibraryUrl={competitor.tiktokAdLibraryUrl}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
