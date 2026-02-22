import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { Check, Loader2, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface StrategyFormProps {
    productDescription: string;
    usps: string[];
    targetAudience: string;
    targetLanguage: string;
    logoUrl?: string;
    update: (key: string, value: any) => void;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploadingLogo: boolean;
}

export const StrategyForm = ({
    productDescription,
    usps,
    targetAudience,
    targetLanguage,
    logoUrl,
    update,
    handleLogoUpload,
    uploadingLogo
}: StrategyFormProps) => {
    const t = useTranslations("Dashboard.studio.intake");

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <motion.div variants={containerVariants as any} initial="hidden" animate="show" className="space-y-6 mt-4">
            <motion.div variants={itemVariants as any} className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl relative overflow-hidden group">
                <Label className="text-amber-500/90 font-medium tracking-wide flex items-center gap-2">
                    <span className="bg-amber-500/10 text-amber-500 px-2 flex items-center justify-center rounded-md font-bold text-xs h-5">1</span>
                    {t("sections.a")}
                </Label>
                <div className="space-y-2">
                    <Label htmlFor="desc" className="text-zinc-300">{t("form.productDesc")}</Label>
                    <Textarea
                        id="desc"
                        value={productDescription}
                        onChange={(e) => update("productDescription", e.target.value)}
                        placeholder={t("form.productDescPlaceholder")}
                        className="min-h-[100px] border-zinc-700 bg-zinc-950/50 focus-visible:ring-amber-500/50 resize-none"
                    />
                </div>
            </motion.div>

            {/* QUICK IMPORT SECTION - OPTIONAL */}
            <motion.div variants={itemVariants as any} className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 border-dashed rounded-xl relative group">
                <div className="flex items-center justify-between">
                    <Label className="text-zinc-400 font-medium tracking-wide flex items-center gap-2">
                        {t("form.quickImportTitle")}
                    </Label>
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            toast.success("Téléchargement du modèle (Bientôt disponible)");
                        }}
                        className="text-xs text-amber-500 hover:text-amber-400 transition-colors underline underline-offset-2"
                    >
                        {t("form.downloadSample")}
                    </a>
                </div>
                <div
                    onClick={() => {
                        toast.success(t("form.importSuccess"));
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-zinc-950/50 border border-zinc-700/50 group-hover:border-amber-500/50 border-dashed rounded-lg transition-colors cursor-pointer"
                >
                    <UploadCloud className="h-6 w-6 text-zinc-500 mb-2 group-hover:text-amber-500/80 transition-colors" />
                    <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {t("form.importExisting")}
                    </span>
                </div>
            </motion.div>

            <motion.div variants={itemVariants as any} className="space-y-4 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl relative overflow-hidden group">
                <Label className="text-amber-500/90 font-medium tracking-wide flex items-center gap-2">
                    <span className="bg-amber-500/10 text-amber-500 px-2 flex items-center justify-center rounded-md font-bold text-xs h-5">2</span>
                    {t("sections.b")}
                </Label>
                <div className="space-y-3">
                    <Label className="text-zinc-300">{t("form.usps")}</Label>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex gap-3 items-center group/input">
                            <span className="text-xs font-mono text-zinc-600 group-hover/input:text-amber-500/50 transition-colors w-4 text-right">{i + 1}.</span>
                            <Input
                                value={usps[i] || ""}
                                onChange={(e) => {
                                    const newUsps = [...usps];
                                    newUsps[i] = e.target.value;
                                    update("usps", newUsps);
                                }}
                                placeholder={t("form.uspPlaceholder", { num: i + 1 })}
                                className="border-zinc-700 bg-zinc-950/50 focus-visible:ring-amber-500/50 h-10"
                            />
                        </div>
                    ))}
                </div>
            </motion.div>

            <motion.div variants={itemVariants as any} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl">
                    <Label className="text-amber-500/90 font-medium tracking-wide flex items-center gap-2">
                        <span className="bg-amber-500/10 text-amber-500 px-2 flex items-center justify-center rounded-md font-bold text-xs h-5">3</span>
                        {t("sections.c")}
                    </Label>

                    <div className="space-y-4 pt-1">
                        <div className="space-y-2">
                            <Label htmlFor="audience" className="text-zinc-300 flex items-center justify-between">
                                {t("form.audience")}
                            </Label>
                            <Input
                                id="audience"
                                value={targetAudience}
                                onChange={(e) => update("targetAudience", e.target.value)}
                                placeholder={t("form.audiencePlaceholder")}
                                className="border-zinc-700 bg-zinc-950/50 focus-visible:ring-amber-500/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="langue" className="text-zinc-300">{t("form.langue")}</Label>
                            <Select value={targetLanguage} onValueChange={(v) => update("targetLanguage", v)}>
                                <SelectTrigger className="border-zinc-700 bg-zinc-950/50 focus:ring-amber-500/50">
                                    <SelectValue placeholder={t("form.languePlaceholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Français">{t("form.languages.Français")}</SelectItem>
                                    <SelectItem value="English">{t("form.languages.English")}</SelectItem>
                                    <SelectItem value="Español">{t("form.languages.Español")}</SelectItem>
                                    <SelectItem value="Deutsch">{t("form.languages.Deutsch")}</SelectItem>
                                    <SelectItem value="Italiano">{t("form.languages.Italiano")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl flex flex-col justify-start">
                    <Label className="text-amber-500/90 font-medium tracking-wide flex items-center gap-2">
                        <span className="bg-amber-500/10 text-amber-500 p-1 rounded-md">
                            <UploadCloud className="h-4 w-4" />
                        </span>
                        {t("sections.brandOption")}
                    </Label>

                    <div className="pt-3">
                        <div className="relative group cursor-pointer">
                            <input
                                type="file"
                                accept="image/png"
                                onChange={handleLogoUpload}
                                disabled={uploadingLogo}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/50 border-2 border-dashed border-zinc-700 group-hover:border-amber-500/50 rounded-lg transition-colors h-10">
                                <div className="flex items-center gap-2 text-sm text-zinc-400 group-hover:text-amber-400/80 transition-colors truncate">
                                    <span className="truncate pr-8">{logoUrl ? t("form.logoSuccess") : t("form.brandLogo")}</span>
                                </div>
                                {uploadingLogo && <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0 absolute right-3" />}
                                {logoUrl && !uploadingLogo && <Check className="h-4 w-4 text-green-500 shrink-0 absolute right-3" />}
                            </div>
                            {logoUrl && (
                                <div className="absolute top-1 right-12 h-8 w-8 bg-zinc-900 rounded border border-zinc-700 p-1 pointer-events-none z-20">
                                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
