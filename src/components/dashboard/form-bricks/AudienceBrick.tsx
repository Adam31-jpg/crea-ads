import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrickProps } from "./types";
import { InfoBubble } from "./InfoBubble";

export function AudienceBrick({ data, onChange, t }: BrickProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-4 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl">
                <Label className="text-amber-500/90 font-medium tracking-wide flex items-center gap-2">
                    <span className="bg-amber-500/10 text-amber-500 px-2 flex items-center justify-center rounded-md font-bold text-xs h-5">3</span>
                    {t ? t("sections.c") : "Audience & Identité"}
                    <InfoBubble message={t ? t("tooltips.audience") : "Influences the tone of voice and the aesthetic selection in the strategy phase."} />
                </Label>

                <div className="space-y-2 pt-1">
                    <Input
                        placeholder={t ? t("form.audiencePlaceholder") : "Audience cible..."}
                        value={data.targetAudience}
                        onChange={(e) => onChange({ targetAudience: e.target.value })}
                        className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-amber-500/50 text-zinc-200 placeholder:text-zinc-600 transition-all"
                    />
                </div>
            </div>

            <div className="space-y-4 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl">
                <div className="space-y-2">
                    <Label className="text-amber-500/90 font-medium tracking-wide flex items-center gap-2">
                        <span className="bg-amber-500/10 text-amber-500 px-2 flex items-center justify-center rounded-md font-bold text-xs h-5">4</span>
                        {t ? t("form.langue") : "Langue de sortie"}
                    </Label>
                    <Select value={data.targetLanguage} onValueChange={(val) => onChange({ targetLanguage: val })}>
                        <SelectTrigger className="bg-zinc-950/50 border-zinc-800 focus:ring-1 focus:ring-amber-500/50 text-zinc-200">
                            <SelectValue placeholder={t ? t("form.languePlaceholder") : "Sélectionner la langue"} />
                        </SelectTrigger>
                        <SelectContent>
                            {t && t.raw ? Object.keys(t.raw("form.languages")).map((lang) => (
                                <SelectItem key={lang} value={lang}>
                                    {t(`form.languages.${lang}`)}
                                </SelectItem>
                            )) : (
                                <>
                                    <SelectItem value="Français">Français</SelectItem>
                                    <SelectItem value="English">English</SelectItem>
                                    <SelectItem value="Español">Español</SelectItem>
                                </>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
