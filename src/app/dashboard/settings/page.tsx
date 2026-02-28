"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, Settings, CreditCard, Trash2, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRechargeModal } from "@/hooks/use-recharge-modal";

export default function SettingsPage() {
    const [credits, setCredits] = useState<number | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loadingPortal, setLoadingPortal] = useState(false);

    // Deletion state
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const isDeleteEnabled = deleteConfirmText === "SUPPRIMER";

    const session = useSession();
    const router = useRouter();
    const { onOpen } = useRechargeModal();
    const t = useTranslations("Dashboard.settings");

    // Set email and initial credits from session
    useEffect(() => {
        if (session.data?.user?.email) setUserEmail(session.data.user.email);
        if (typeof (session.data?.user as any)?.credits === 'number') {
            setCredits((session.data!.user as any).credits);
        }
    }, [session.data]);

    // Subscribe to SSE for real-time credits_update events
    useEffect(() => {
        const es = new EventSource('/api/events');
        es.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'credits_update' && typeof payload.credits === 'number') {
                    setCredits(payload.credits);
                }
            } catch { /* ignore */ }
        };
        return () => es.close();
    }, []);


    const handleLemonSqueezyPortal = async () => {
        try {
            setLoadingPortal(true);
            if (typeof window !== "undefined" && window.LemonSqueezy) {
                // To open the customer portal securely, Lemon Squeezy requires either
                // an API-generated URL or routing them to their default portal.
                // We route them to the store's default portal where they can enter their email.
                // You can find your store's generic customer portal URL in LS settings.
                window.LemonSqueezy.Url.Open("https://lumina-test.lemonsqueezy.com/billing"); // Using generic billing link
            } else {
                toast.error(t("toasts.connError"));
            }
        } catch (error) {
            toast.error(t("toasts.connError"));
        } finally {
            setLoadingPortal(false);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            setIsDeleting(true);
            const res = await fetch("/api/user/delete", { method: "POST" });
            const data = await res.json();

            if (res.ok && data.success) {
                toast.success(t("toasts.delSuccess"));
                await signOut({ callbackUrl: "/" });
            } else {
                toast.error(data.error || t("toasts.delError"));
                setIsDeleting(false);
            }
        } catch (error) {
            toast.error(t("toasts.serverError"));
            setIsDeleting(false);
        }
    };

    // Progress calculations roughly (cap visual bar at 100 on front-end for huge numbers)
    const maxVisualCredits = 100;
    const progressPercent = credits !== null
        ? Math.min((credits / (maxVisualCredits > credits ? maxVisualCredits : credits)) * 100, 100)
        : 0;

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between space-y-2 mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Settings className="h-8 w-8 text-amber-500" />
                        {t("title")}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        {t("subtitle")}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* =======================================
            TOKEN WALLET (GOLDEN THEME)
            ======================================= */}
                <Card className="col-span-1 border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.05)] bg-gradient-to-b from-card to-card hover:border-amber-500/40 transition-colors">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-amber-500" />
                            {t("wallet.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("wallet.desc")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-end justify-between">
                            <div>
                                <span className="text-4xl font-extrabold text-foreground">
                                    {credits !== null ? credits : "..."}
                                </span>
                                <span className="text-lg font-medium text-muted-foreground ml-2">{t("wallet.tokens")}</span>
                            </div>

                            {/* Refill Button right next to Gold Bar */}
                            <Button
                                onClick={onOpen}
                                size="sm"
                                className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20 gap-2"
                                variant="outline"
                            >
                                <Zap className="h-4 w-4" />
                                {t("wallet.refill")}
                            </Button>
                        </div>

                        {/* GOLD BAR PROGRESS INDICATOR */}
                        <div className="space-y-2">
                            <div
                                className="h-4 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden border border-black/10 dark:border-white/10"
                                style={{ willChange: 'transform' }} // Hardware acceleration required
                            >
                                <div
                                    className="h-full bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] transition-all duration-1000 ease-out"
                                    style={{
                                        width: `${credits !== null ? Math.max(progressPercent, 2) : 0}%`,
                                        willChange: 'transform' // Hardware acceleration explicit request
                                    }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground text-right" suppressHydrationWarning>
                                {credits !== null ? t("wallet.available", { count: credits }) : t("wallet.loading")}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* =======================================
            BILLING PORTAL
            ======================================= */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                            {t("billing.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("billing.desc")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                            <Label className="text-sm font-medium">{t("billing.email")}</Label>
                            <Input
                                disabled
                                value={userEmail || t("billing.loading")}
                                className="bg-muted text-muted-foreground"
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            onClick={handleLemonSqueezyPortal}
                            disabled={loadingPortal}
                            className="w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200"
                        >
                            {loadingPortal ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t("billing.redirecting")}
                                </>
                            ) : (
                                t("billing.manage")
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                {/* =======================================
            DANGER ZONE (ACCOUNT DELETION)
            ======================================= */}
                <Card className="col-span-1 md:col-span-2 border-red-500/20 bg-red-50/50 dark:bg-red-950/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <Trash2 className="h-5 w-5" />
                            {t("danger.title")}
                        </CardTitle>
                        <CardDescription className="text-red-600/80 dark:text-red-400/80">
                            {t("danger.desc")}
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-end">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white">
                                    {t("danger.btn")}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle className="text-red-600 dark:text-red-500 flex items-center gap-2">
                                        <Trash2 className="h-5 w-5" />
                                        {t("danger.dialogTitle")}
                                    </DialogTitle>
                                    <DialogDescription className="text-foreground pt-4 space-y-4">
                                        <p>
                                            {t("danger.dialogDesc1")}
                                        </p>
                                        <div className="bg-muted p-4 rounded-md text-sm border-l-4 border-red-500">
                                            {t.rich("danger.dialogDesc2", {
                                                word: t("danger.confirmWord"),
                                                strong: (chunks) => <strong>{chunks}</strong>
                                            })}
                                        </div>
                                        <Input
                                            placeholder="SUPPRIMER"
                                            value={deleteConfirmText}
                                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                                            className="mt-2"
                                        />
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="mt-6 flex gap-2 sm:justify-between">
                                    {/* Cancel handled by Radix Dialog primitives implicitly or explicit DialogClose */}
                                    <div className="flex-1" />
                                    <Button
                                        variant="destructive"
                                        disabled={!isDeleteEnabled || isDeleting}
                                        onClick={handleDeleteAccount}
                                        className="w-full sm:w-auto"
                                    >
                                        {isDeleting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {t("danger.deleting")}
                                            </>
                                        ) : (
                                            t("danger.confirmBtn")
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardFooter>
                </Card>

            </div>
        </div>
    );
}
