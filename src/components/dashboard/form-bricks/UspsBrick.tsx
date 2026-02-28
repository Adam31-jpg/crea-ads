import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrickProps } from "./types";
import { motion } from "framer-motion";
import { InfoBubble } from "./InfoBubble";

export function UspsBrick({ data, onChange, t }: BrickProps) {
    return (
        <motion.div className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl">
            <Label className="text-amber-500/90 font-medium tracking-wide flex items-center gap-2">
                <span className="bg-amber-500/10 text-amber-500 px-2 flex items-center justify-center rounded-md font-bold text-xs h-5">2</span>
                {t ? t("sections.b") : "Les Piliers de Vente (USPs)"}
                <InfoBubble message={t ? t("tooltips.usps") : "Unique Selling Propositions. Translates directly into subheadlines and PointerBenefit components."} />
            </Label>
            <div className="space-y-2">
                {data.usps.map((usp, i) => (
                    <div key={i} className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium text-sm">
                            {i + 1}.
                        </div>
                        <Input
                            placeholder={t ? t("form.uspPlaceholder", { num: i + 1 }) : `USP ${i + 1}`}
                            value={usp}
                            onChange={(e) => {
                                const next = [...data.usps];
                                next[i] = e.target.value;
                                onChange({ usps: next });
                            }}
                            className="pl-8 bg-zinc-950/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-amber-500/50 text-zinc-200 placeholder:text-zinc-600 transition-all"
                        />
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
