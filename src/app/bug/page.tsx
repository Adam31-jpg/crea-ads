import { createClient } from "@/lib/supabase/server";
import { BugClient } from "./bug-client";

export const metadata = {
    title: "Report a Bug - Lumina",
    description: "Submit bug reports or issues to the Lumina engineering team.",
};

export default async function BugPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <BugClient
            userId={user?.id || null}
            userEmail={user?.email || ""}
        />
    );
}
