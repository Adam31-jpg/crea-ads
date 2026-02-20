import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { }

/**
 * Skeleton loading placeholder with shimmer animation.
 * Usage:
 *   <Skeleton className="h-4 w-[250px]" />               — text line
 *   <Skeleton className="h-12 w-12 rounded-full" />      — avatar
 *   <Skeleton className="h-[200px] w-full rounded-xl" /> — card
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn("animate-shimmer rounded-md", className)}
            {...props}
        />
    );
}
