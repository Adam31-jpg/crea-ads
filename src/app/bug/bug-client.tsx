"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UploadCloud, File as FileIcon, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface BugClientProps {
    userId: string | null;
    userEmail: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function BugClient({ userId, userEmail }: BugClientProps) {
    const t = useTranslations("bug");
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Form State
    const [category, setCategory] = useState("");
    const [stripeId, setStripeId] = useState("");
    const [batchId, setBatchId] = useState("");
    const [urgency, setUrgency] = useState("");
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [steps, setSteps] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Invisible Metadata
    const [metadata, setMetadata] = useState({
        browser_version: "",
        operating_system: "",
        current_url: "",
    });

    useEffect(() => {
        setMetadata({
            browser_version: navigator.userAgent,
            operating_system: navigator.platform,
            current_url: window.location.href,
        });
    }, []);

    // Form Schema
    const formSchema = z.object({
        category: z.string().min(1, t("form.errors.required")),
        stripe_id: z.string().optional(),
        batch_id: z.string().optional(),
        urgency: z.string().min(1, t("form.errors.required")),
        subject: z.string().min(1, t("form.errors.required")),
        description: z.string().min(1, t("form.errors.required")),
        steps: z.string().min(1, t("form.errors.required")),
    }).superRefine((data, ctx) => {
        if (data.category === "rendu" && (!data.batch_id || data.batch_id.trim() === "")) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("form.errors.batchRequired"),
                path: ["batch_id"],
            });
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            if (selected.size > MAX_FILE_SIZE) {
                toast.error(t("form.errors.fileTooLarge"));
                return;
            }
            setFile(selected);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const selected = e.dataTransfer.files[0];
            if (selected.size > MAX_FILE_SIZE) {
                toast.error(t("form.errors.fileTooLarge"));
                return;
            }
            setFile(selected);
        }
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        setIsSubmitting(true);

        const formData = {
            category,
            stripe_id: stripeId,
            batch_id: batchId,
            urgency,
            subject,
            description,
            steps,
        };

        const result = formSchema.safeParse(formData);

        if (!result.success) {
            const newErrors: Record<string, string> = {};
            result.error.errors.forEach((err) => {
                if (err.path[0]) {
                    newErrors[err.path[0].toString()] = err.message;
                }
            });
            setErrors(newErrors);
            setIsSubmitting(false);
            return;
        }

        const data = result.data;
        let fileUrl = null;

        try {
            // 1. Upload File via S3 presigned URL
            if (file) {
                const presignRes = await fetch("/api/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: file.name, contentType: file.type }),
                });
                if (!presignRes.ok) throw new Error("Failed to get upload URL");
                const { presignedUrl, publicUrl } = await presignRes.json();
                const uploadRes = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
                if (!uploadRes.ok) throw new Error("S3 upload failed");
                fileUrl = publicUrl;
            }

            // 2. Post bug report to API
            const bugRes = await fetch("/api/bug", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: userId,
                    user_email: userEmail || "anonymous@example.com",
                    category: data.category,
                    stripe_id: data.stripe_id || null,
                    batch_id: data.batch_id || null,
                    urgency: data.urgency,
                    subject: data.subject,
                    description: data.description,
                    steps: data.steps,
                    file_url: fileUrl,
                    browser_version: metadata.browser_version,
                    operating_system: metadata.operating_system,
                    current_url: metadata.current_url,
                }),
            });

            if (!bugRes.ok) throw new Error("Bug submission failed");

            toast.success(t("form.success"));
            setTimeout(() => {
                router.push("/dashboard");
            }, 3000);

        } catch (err) {
            console.error("Submission error:", err);
            toast.error(t("form.errors.submitError"));
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-foreground selection:bg-brand/30 relative overflow-x-hidden flex flex-col">
            {/* GPU Accelerated Aurora Halos */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden will-change-transform transform-gpu">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/20 blur-[160px]" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-orange-600/20 blur-[160px]" />
                <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] rounded-full bg-yellow-400/10 blur-[160px]" />
            </div>

            <div className="relative z-10 flex-1 flex flex-col pb-24">
                {/* Navigation */}
                <header className="px-6 py-8">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-amber-400 transition-colors group cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">{t("nav_back")}</span>
                    </button>
                </header>

                <main className="flex-1 w-full max-w-2xl mx-auto px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        className="text-center mb-10"
                    >
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight font-[var(--font-bodoni)] bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 text-transparent bg-clip-text mb-4">
                            {t("title")}
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            {t("subtitle")}
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
                        className="bg-white/5 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-6 sm:p-10 shadow-2xl"
                    >
                        <form onSubmit={onSubmit} className="space-y-8">

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-foreground/80">{t("form.category.label")}</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="bg-black/20 border-amber-500/10 focus:ring-amber-500/30">
                                            <SelectValue placeholder={t("form.category.placeholder")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="rendu">{t("form.category.rendu")}</SelectItem>
                                            <SelectItem value="paiement">{t("form.category.paiement")}</SelectItem>
                                            <SelectItem value="affichage">{t("form.category.affichage")}</SelectItem>
                                            <SelectItem value="autre">{t("form.category.autre")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.category && <p className="text-sm text-red-400">{errors.category}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-foreground/80">{t("form.urgency.label")}</Label>
                                    <Select value={urgency} onValueChange={setUrgency}>
                                        <SelectTrigger className="bg-black/20 border-amber-500/10 focus:ring-amber-500/30">
                                            <SelectValue placeholder={t("form.urgency.label")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">{t("form.urgency.low")}</SelectItem>
                                            <SelectItem value="medium">{t("form.urgency.medium")}</SelectItem>
                                            <SelectItem value="high">{t("form.urgency.high")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.urgency && <p className="text-sm text-red-400">{errors.urgency}</p>}
                                </div>
                            </div>

                            <AnimatePresence mode="popLayout">
                                {category === "paiement" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="space-y-2"
                                    >
                                        <Label className="text-foreground/80">{t("form.conditional.stripe_id")}</Label>
                                        <Input value={stripeId} onChange={(e) => setStripeId(e.target.value)} className="bg-black/20 border-amber-500/10 focus:ring-amber-500/30 transition-all" />
                                        {errors.stripe_id && <p className="text-sm text-red-400">{errors.stripe_id}</p>}
                                    </motion.div>
                                )}

                                {category === "rendu" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="space-y-2"
                                    >
                                        <Label className="text-foreground/80">{t("form.conditional.batch_id")}</Label>
                                        <Input value={batchId} onChange={(e) => setBatchId(e.target.value)} className="bg-black/20 border-amber-500/10 focus:ring-amber-500/30 transition-all" />
                                        {errors.batch_id && <p className="text-sm text-red-400">{errors.batch_id}</p>}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-2">
                                <Label className="text-foreground/80">{t("form.subject.label")}</Label>
                                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("form.subject.placeholder")} className="bg-black/20 border-amber-500/10 focus:ring-amber-500/30 transition-all" />
                                {errors.subject && <p className="text-sm text-red-400">{errors.subject}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground/80">{t("form.description.label")}</Label>
                                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("form.description.placeholder")} className="min-h-[120px] bg-black/20 border-amber-500/10 focus:ring-amber-500/30 resize-none transition-all" />
                                {errors.description && <p className="text-sm text-red-400">{errors.description}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground/80">{t("form.steps.label")}</Label>
                                <Textarea value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={t("form.steps.placeholder")} className="min-h-[100px] bg-black/20 border-amber-500/10 focus:ring-amber-500/30 resize-none transition-all" />
                                {errors.steps && <p className="text-sm text-red-400">{errors.steps}</p>}
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label className="text-foreground/80">{t("form.upload.label")}</Label>
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all bg-black/20 ${isDragging ? "border-amber-400 bg-amber-500/5" : "border-amber-500/20 hover:border-amber-500/40"}`}
                                >
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                        accept="image/*,video/*,.pdf"
                                    />
                                    {file ? (
                                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-lg z-10 pointer-events-none">
                                            <FileIcon className="h-5 w-5 text-amber-500/70" />
                                            <span className="text-sm font-medium">{file.name}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 ml-2 pointer-events-auto"
                                                onClick={(e) => { e.preventDefault(); setFile(null); }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="pointer-events-none flex flex-col items-center gap-2">
                                            <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                                                <UploadCloud className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm text-foreground/80 font-medium">{t("form.upload.hint")}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-14 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold text-lg shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] transition-all duration-300 border-0 mt-8"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    t("form.submit")
                                )}
                            </Button>
                        </form>
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
