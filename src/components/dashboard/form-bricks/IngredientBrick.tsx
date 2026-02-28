import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoBubble } from "./InfoBubble";
import { BrickProps } from "./types";
import { motion } from "framer-motion";

export function IngredientBrick({ data, onChange, t }: BrickProps) {
    return (
        <motion.div className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl relative overflow-hidden group transition-all hover:border-amber-500/30">
            <Label className="text-zinc-300 font-medium tracking-wide flex items-center text-sm">
                Ingrédient Phare (Optionnel)
                <InfoBubble message={t ? t("tooltips.ingredient") : "Highlighting a key ingredient guarantees the use of the CleanIngredient circular badge to draw the eye."} />
            </Label>
            <Input
                placeholder="Ex: Acide Hyaluronique, 100% Vegan..."
                value={data.keyIngredient || ""}
                onChange={(e) => onChange({ keyIngredient: e.target.value })}
                className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-amber-500/50 text-zinc-200 placeholder:text-zinc-600 transition-all"
            />
        </motion.div>
    );
}
