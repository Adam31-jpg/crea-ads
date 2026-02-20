"use client";

import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Upload, Star, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
    userId,
}: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const uploadFiles = useCallback(
        async (files: FileList | File[]) => {
            const fileArray = Array.from(files);
            const valid = fileArray.filter((f) =>
                ["image/png", "image/jpeg", "image/webp"].includes(f.type)
            );

            if (valid.length === 0) {
                toast.error("Please upload PNG, JPEG, or WebP images.");
                return;
            }

            setUploading(true);
            const newUrls: string[] = [];

            for (const file of valid) {
                const ext = file.name.split(".").pop();
                const path = `${userId}/draft/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

                const { error } = await supabase.storage
                    .from("product-assets")
                    .upload(path, file, { cacheControl: "3600", upsert: false });

                if (error) {
                    toast.error(`Upload failed: ${error.message}`);
                    continue;
                }

                const {
                    data: { publicUrl },
                } = supabase.storage.from("product-assets").getPublicUrl(path);

                newUrls.push(publicUrl);
            }

            if (newUrls.length > 0) {
                onImagesChange([...images, ...newUrls]);
                toast.success(
                    `${newUrls.length} image${newUrls.length > 1 ? "s" : ""} uploaded`
                );
            }
            setUploading(false);
        },
        [images, onImagesChange, supabase, userId]
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
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
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
                <Upload
                    className={cn(
                        "h-8 w-8 transition-colors",
                        dragOver ? "text-brand" : "text-muted-foreground"
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {uploading ? (
                        "Uploading..."
                    ) : (
                        <>
                            <span className="font-medium text-foreground">
                                Click to upload
                            </span>{" "}
                            or drag and drop
                        </>
                    )}
                </p>
                <p className="text-xs text-muted-foreground">
                    PNG, JPEG, or WebP (max 10MB)
                </p>
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
                    <strong>Pro tip:</strong> Use transparent PNGs for optimal results.
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
                            <img
                                src={url}
                                alt={`Product ${i + 1}`}
                                className="h-full w-full object-cover"
                            />

                            {/* Hero badge */}
                            {heroIndex === i && (
                                <div className="absolute top-1 left-1 flex items-center gap-1 rounded-md bg-brand px-1.5 py-0.5">
                                    <Star className="h-3 w-3 fill-brand-foreground text-brand-foreground" />
                                    <span className="text-[10px] font-bold text-brand-foreground">
                                        HERO
                                    </span>
                                </div>
                            )}

                            {/* Remove button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeImage(i);
                                }}
                                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                <X className="h-3 w-3" />
                            </button>

                            {/* Click-to-set-hero hint */}
                            {heroIndex !== i && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] font-medium text-white">
                                        Set as Hero
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
