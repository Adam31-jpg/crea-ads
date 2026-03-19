export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { HelpClient } from "./help-client";

export const metadata = {
    title: "Help Center - Lumina",
    description: "Support and FAQ for Lumina",
};

export default async function HelpPage() {
    const session = await auth();
    return <HelpClient isLoggedIn={!!session?.user} />;
}
