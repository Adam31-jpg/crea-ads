import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

interface ThemeSelectorProps {
    theme: string;
    accentColor: string;
    update: (key: string, value: any) => void;
    THEMES: any[];
    ThemePreviewSVG: React.FC;
}

export const ThemeSelector = ({
    theme,
    accentColor,
    update,
    THEMES,
    ThemePreviewSVG
}: ThemeSelectorProps) => {
    const t = useTranslations("Dashboard.studio");

    return (
        <div style={{ "--accent-color": accentColor } as React.CSSProperties} className="flex flex-col gap-6">
            <h3 className="text-2xl font-semibold leading-none tracking-tight mb-0">{t("form.styleTheme")}</h3>
            <div className="flex flex-col gap-3">
                <Label className="text-sm font-semibold text-zinc-300">{t("form.theme")}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {THEMES.map((themeItem) => (
                        <div
                            key={themeItem.id}
                            onClick={() => update("theme", themeItem.id)}
                            className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 ${theme === themeItem.id ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-transparent hover:border-zinc-700'}`}
                        >
                            <div className="absolute inset-0 overflow-hidden bg-zinc-900">
                                <img
                                    src={themeItem.image}
                                    alt={`Theme ${themeItem.id}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            </div>

                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500"></div>

                            <div className={`relative p-2 h-32 flex flex-col items-center justify-center ${themeItem.text} drop-shadow-md`}>
                                <ThemePreviewSVG />
                            </div>

                            <div className="absolute bottom-0 inset-x-0 bg-black/40 backdrop-blur-md p-2 text-center text-xs font-semibold text-white border-t border-white/10 text-shadow-sm">
                                {t(`themes.${themeItem.id}`)}
                            </div>

                            {theme === themeItem.id && (
                                <div className="absolute top-2 right-2 h-5 w-5 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10">
                                    <Check className="h-3 w-3 text-black" strokeWidth={3} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <Label htmlFor="accentColor" className="text-sm font-semibold text-zinc-300">{t("form.accentColor")}</Label>
                <div className="flex items-center gap-4 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-zinc-700 shadow-inner">
                        <input
                            id="accentColor"
                            type="color"
                            value={accentColor}
                            onChange={(e) => update("accentColor", e.target.value)}
                            className="absolute -top-2 -left-2 w-32 h-32 cursor-pointer p-0 border-0"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm text-zinc-300 font-medium">Couleur Principale</span>
                        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                            {accentColor}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
