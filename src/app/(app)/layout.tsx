export const dynamic = "force-dynamic";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { RechargeModal } from "@/components/modals/recharge-modal";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <TooltipProvider>
                {children}
            </TooltipProvider>
            <Toaster />
            <RechargeModal />
        </NextIntlClientProvider>
    );
}
