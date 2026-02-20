"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

interface TopbarProps {
    user: User;
}

export function DashboardTopbar({ user }: TopbarProps) {
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
    };

    return (
        <header className="flex items-center justify-between h-16 px-6 lg:px-8 border-b border-border bg-background">
            <div>
                <h2 className="text-sm font-medium text-foreground">Dashboard</h2>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden sm:block">
                    {user.email}
                </span>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/15 text-brand text-xs font-bold">
                    {user.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                    Logout
                </Button>
            </div>
        </header>
    );
}
