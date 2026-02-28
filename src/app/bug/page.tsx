import { auth } from "@/lib/auth";
import { BugClient } from "./bug-client";

export const metadata = {
    title: "Report a Bug - Lumina",
    description: "Submit bug reports or issues to the Lumina engineering team.",
};

export default async function BugPage() {
    const session = await auth();
    return (
        <BugClient
            userId={session?.user?.id || null}
            userEmail={session?.user?.email || ""}
        />
    );
}
