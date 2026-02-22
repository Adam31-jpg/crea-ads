'use client';

import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { GENERATION_CONFIG } from "@/config/generation.config";

interface StrategyPreviewProps {
    strategy: any[] | null;
    setIntakeOpen: (open: boolean) => void;
}

export const StrategyPreview = ({ strategy, setIntakeOpen }: StrategyPreviewProps) => {
    const t = useTranslations("Dashboard.studio");

    return (
        <>
            <CardTitle className="mb-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand" />
                {t("strategy.title")}
            </CardTitle>
            {!strategy ? (
                <div className="text-center py-8 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {t("strategy.emptyState", { total: GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH })}
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
    );
};
