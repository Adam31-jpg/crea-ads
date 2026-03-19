export const dynamic = "force-dynamic";

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <h1 className="text-4xl font-bold">404</h1>
                <p className="mt-2 text-muted-foreground">Page introuvable</p>
                <a href="/dashboard" className="mt-4 inline-block text-amber-500 hover:underline">
                    Retour au dashboard
                </a>
            </div>
        </div>
    );
}
