import * as React from "react"

function Progress({
    value = 0,
    max = 100,
    className,
    ...props
}: React.ComponentProps<"div"> & { value?: number; max?: number }) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))

    return (
        <div
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            data-slot="progress"
            className={`relative h-1.5 w-full overflow-hidden rounded-full bg-primary/10 ${className ?? ""}`}
            {...props}
        >
            <div
                data-slot="progress-indicator"
                className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
            />
        </div>
    )
}

export { Progress }
