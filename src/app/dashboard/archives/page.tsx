import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BatchCard, type Batch } from "@/components/dashboard/batch-card";

export default async function ArchivesPage() {
    const session = await auth();
    const userId = session?.user?.id!;

    const rawBatches = await prisma.batch.findMany({
        where: {
            userId,
            metadata: { path: ["is_archived"], equals: true },
        },
        include: { jobs: { select: { id: true, status: true, result_url: true, metadata: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    const batches: Batch[] = rawBatches.map((b) => {
        const meta = (b.metadata as Record<string, unknown>) ?? {};
        return {
            id: b.id,
            project_name: (meta.project_name as string) || "Untitled",
            status: b.status,
            created_at: b.createdAt.toISOString(),
            is_archived: true,
            input_data: meta,
            jobs: b.jobs.map((j) => {
                const jMeta = (j.metadata as Record<string, unknown>) ?? {};
                return {
                    id: j.id,
                    status: j.status,
                    type: (jMeta.renderType as string) || "video",
                    result_url: j.result_url ?? null,
                    error_message: null,
                    template_id: (jMeta.template_id as string) || "",
                    created_at: "",
                };
            }),
        };
    });

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Archives</h1>
            <p className="text-muted-foreground text-sm mb-8">
                Archived batches. Use the menu to restore or permanently delete.
            </p>
            {batches.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                    <p className="text-lg font-medium">No archived batches</p>
                    <p className="text-sm mt-1">Archived batches will appear here.</p>
                </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {batches.map((batch) => (
                    <BatchCard key={batch.id} batch={batch} showUnarchive />
                ))}
            </div>
        </div>
    );
}
