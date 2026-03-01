import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Phone } from "lucide-react";
import { BrickProps } from "./types";

export function ContactBrick({ data, onChange, t }: BrickProps) {
    return (
        <div className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl col-span-1 md:col-span-2">
            <div className="space-y-1">
                <Label className="text-zinc-300 font-medium tracking-wide flex items-center gap-2">
                    Contact Information (Optional)
                </Label>
                <p className="text-[11px] text-zinc-500 pt-1">
                    Adds a small contact chip to lower corners of applicable templates.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                        value={data.websiteUrl || ""}
                        onChange={(e) => onChange({ websiteUrl: e.target.value })}
                        placeholder="e.g. yourbrand.com"
                        className="pl-9 bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-700 h-9"
                    />
                </div>
                <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                        value={data.phoneNumber || ""}
                        onChange={(e) => onChange({ phoneNumber: e.target.value })}
                        placeholder="e.g. 0800 123 456"
                        className="pl-9 bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-700 h-9"
                    />
                </div>
            </div>
        </div>
    );
}
