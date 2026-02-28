import { Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoBubbleProps {
    message: string;
}

export function InfoBubble({ message }: InfoBubbleProps) {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <button type="button" className="inline-flex text-zinc-500 hover:text-amber-500 transition-colors ml-2 focus:outline-none">
                        <Info className="h-4 w-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] bg-zinc-900 border-zinc-700 text-zinc-200 text-xs shadow-xl ring-1 ring-black/5" side="top">
                    {message}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
