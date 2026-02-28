import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BrickProps } from "./types";
import { motion } from "framer-motion";
import { InfoBubble } from "./InfoBubble";

export function ProductDescBrick({ data, onChange, t }: BrickProps) {
    return (
        <motion.div className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl relative overflow-hidden group">
            <Label className="text-amber-500/90 font-medium tracking-wide flex items-center gap-2">
                <span className="bg-amber-500/10 text-amber-500 px-2 flex items-center justify-center rounded-md font-bold text-xs h-5">1</span>
                {t ? t("sections.a") : "L'Essence du Produit"}
                <InfoBubble message={t ? t("tooltips.productDesc") : "Describe the physical product, what it does, and its tone. This forms the base concept context."} />
            </Label>
            <Textarea
                placeholder={t ? t("form.productDescPlaceholder") : "Description..."}
                value={data.productDescription}
                onChange={(e) => onChange({ productDescription: e.target.value })}
                rows={4}
                className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-amber-500/50 focus-visible:shadow-[inset_0_0_15px_rgba(245,158,11,0.1)] transition-all resize-none text-base text-zinc-200 placeholder:text-zinc-600"
            />
        </motion.div>
    );
}
