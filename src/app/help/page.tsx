import { createClient } from "@/lib/supabase/server";
import { HelpClient } from "./help-client";

export const metadata = {
    title: "Help Center - Lumina",
    description: "Support and FAQ for Lumina",
};

export default async function HelpPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    return <HelpClient isLoggedIn={!!user} />;
}
