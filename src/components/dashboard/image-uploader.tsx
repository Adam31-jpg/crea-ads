"use client";

import { useState, useCallback, useRef } from "react";
import { X, Upload, Star, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ImageUploaderProps {
    images: string[];
    heroIndex: number;
    onImagesChange: (images: string[]) => void;
    onHeroChange: (index: number) => void;
    userId: string;
}

export function ImageUploader({
    images,
    heroIndex,
    onImagesChange,
    onHeroChange,
}: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const t = useTranslations("Dashboard.studio.imageUploader");

    const uploadFiles = useCallback(
        async (files: FileList | File[]) => {
            const fileArray = Array.from(files);

            const valid = fileArray.filter((f) => {
                if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
                    toast.error(t("errorType"));
                    return false;
                }
                if (f.size > 10 * 1024 * 1024) {
                    toast.error(`Fichier trop volumineux (max 10Mo): ${f.name}`);
                    return false;
                }
                return true;
            });

            if (valid.length === 0) return;

            setUploading(true);
            const newUrls: string[] = [];

            for (const file of valid) {
                try {
                    // 1. Get a presigned S3 URL
                    const presignRes = await fetch("/api/upload", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ filename: file.name, contentType: file.type }),
                    });

                    if (!presignRes.ok) {
                        toast.error(t("errorUpload", { message: "Failed to get upload URL" }));
                        continue;
                    }

                    const { presignedUrl, publicUrl } = await presignRes.json();

                    // 2. PUT directly to S3 — body must be raw File, NOT FormData
                    const uploadRes = await fetch(presignedUrl, {
                        method: "PUT",
                        headers: { "Content-Type": file.type },
                        body: file,
                    });

                    if (!uploadRes.ok) {
                        // Log the exact S3 XML error (AccessDenied / SignatureDoesNotMatch etc.)
                        const errBody = await uploadRes.text().catch(() => "<unreadable>");
                        console.error(`[S3 Upload] ${uploadRes.status} ${uploadRes.statusText}`, errBody);
                        toast.error(t("errorUpload", { message: `S3 ${uploadRes.status}: ${uploadRes.statusText}` }));
                        continue;
                    }

                    newUrls.push(publicUrl);
                } catch (err) {
                    console.error("[S3 Upload] Unexpected error:", err);
                    toast.error(t("errorUpload", { message: String(err) }));
                }
            }

            if (newUrls.length > 0) {
                onImagesChange([...images, ...newUrls]);
                toast.success(t("success", { count: newUrls.length }));
            }
            setUploading(false);
        },
        [images, onImagesChange, t]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        },
        [uploadFiles]
    );

    const removeImage = (index: number) => {
        const updated = images.filter((_, i) => i !== index);
        onImagesChange(updated);
        if (heroIndex === index) onHeroChange(0);
        else if (heroIndex > index) onHeroChange(heroIndex - 1);
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Drop Zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-all",
                    dragOver
                        ? "border-brand bg-brand/5"
                        : "border-input hover:border-muted-foreground/50 hover:bg-muted/30"
                )}
            >
                <Upload className={cn("h-8 w-8 transition-colors", dragOver ? "text-brand" : "text-muted-foreground")} />
                <p className="text-sm text-muted-foreground">
                    {uploading ? (
                        t("uploading")
                    ) : (
                        <>
                            <span className="font-medium text-foreground">{t("clickToUpload")}</span>{" "}
                            {t("dragDrop")}
                        </>
                    )}
                </p>
                <p className="text-xs text-muted-foreground">{t("files")}</p>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                />
            </div>

            {/* Tip */}
            <div className="flex items-center gap-2 rounded-lg bg-brand/5 border border-brand/15 px-3 py-2">
                <ImageIcon className="h-4 w-4 text-brand shrink-0" />
                <p className="text-xs text-brand">
                    <strong>{t("proTip")}</strong>{t("proTipText")}
                </p>
            </div>

            {/* Image Preview Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    {images.map((url, i) => (
                        <div
                            key={url}
                            className={cn(
                                "group relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
                                heroIndex === i
                                    ? "border-brand shadow-[0_0_12px_hsl(var(--brand)/0.3)]"
                                    : "border-border hover:border-muted-foreground/50"
                            )}
                            onClick={() => onHeroChange(i)}
                        >
                            <img src={url} alt={`Product ${i + 1}`} className="h-full w-full object-cover" />
                            {heroIndex === i && (
                                <div className="absolute top-1 left-1 flex items-center gap-1 rounded-md bg-brand px-1.5 py-0.5">
                                    <Star className="h-3 w-3 fill-brand-foreground text-brand-foreground" />
                                    <span className="text-[10px] font-bold text-brand-foreground">{t("hero")}</span>
                                </div>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                <X className="h-3 w-3" />
                            </button>
                            {heroIndex !== i && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] font-medium text-white">{t("setHero")}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
