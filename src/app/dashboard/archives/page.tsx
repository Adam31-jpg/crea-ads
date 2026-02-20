import { createClient } from "@/lib/supabase/server";
import { BatchCard, type Batch } from "@/components/dashboard/batch-card";

export default async function ArchivesPage() {
    const supabase = await createClient();

    const { data: rawBatches, error } = await supabase
        .from("batches")
        .select(
            `
      id, project_name, status, created_at, is_archived, input_data,
      jobs (id, status, type, result_url, error_message, template_id)
    `
        )
        .eq("is_archived", true)
        .order("created_at", { ascending: false })
        .limit(50);

    const batches: Batch[] = (rawBatches ?? []).map(
        (b: Record<string, unknown>) => ({
            id: b.id as string,
            project_name: b.project_name as string,
            status: b.status as string,
            created_at: b.created_at as string,
            is_archived: b.is_archived as boolean,
            input_data: b.input_data as Record<string, unknown>,
            jobs: (b.jobs as Batch["jobs"]) ?? [],
        })
    );

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Archives</h1>
            <p className="text-muted-foreground text-sm mb-8">
                Archived batches. Use the menu to restore or permanently delete.
            </p>

            {error && (
                <p className="text-destructive text-sm">
                    Error loading archives: {error.message}
                </p>
            )}

            {batches.length === 0 && !error && (
                <div className="text-center py-16 text-muted-foreground">
                    <p className="text-lg font-medium">No archived batches</p>
                    <p className="text-sm mt-1">
                        Archived batches will appear here.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {batches.map((batch) => (
                    <BatchCard
                        key={batch.id}
                        batch={batch}
                        showUnarchive
                    />
                ))}
            </div>
        </div>
    );
}
