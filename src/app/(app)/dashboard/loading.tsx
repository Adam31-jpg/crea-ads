import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
    return (
        <div>
            {/* Header skeleton */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Skeleton className="h-8 w-[180px] mb-2" />
                    <Skeleton className="h-4 w-[260px]" />
                </div>
                <Skeleton className="h-10 w-[120px] rounded-lg" />
            </div>

            {/* Card grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-5 w-[140px]" />
                                <Skeleton className="h-5 w-[60px] rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-[100px] mt-2" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-3 w-[200px]" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
