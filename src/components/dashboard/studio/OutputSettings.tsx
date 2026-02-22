import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from "next-intl";

interface OutputSettingsProps {
    projectName: string;
    format: string;
    durationSec: number;
    update: (key: string, value: any) => void;
    formatOptions: any[];
}

export const OutputSettings = ({
    projectName,
    format,
    durationSec,
    update,
    formatOptions
}: OutputSettingsProps) => {
    const t = useTranslations("Dashboard");

    return (
        <div className="flex flex-col gap-6">
            <h3 className="text-2xl font-semibold leading-none tracking-tight mb-0">{t("form.outputSettings")}</h3>

            <div className="flex flex-col gap-2">
                <Label htmlFor="projectName">{t("form.batchName")}</Label>
                <Input
                    id="projectName"
                    placeholder={t("form.batchNamePlaceholder")}
                    value={projectName}
                    onChange={(e) => update("projectName", e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-2">
                <Label>{t("form.format")}</Label>
                <Select
                    value={format}
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
                                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${durationSec === val
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
        </div>
    );
};
