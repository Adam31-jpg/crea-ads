"use client";

import React, { useState } from "react";
import { loginAdmin } from "@/app/[admin_route]/actions";
import { Lock, Loader2 } from "lucide-react";

export function AdminLoginScreen() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await loginAdmin(password);
            if (result.success) {
                // Refresh the route to boundary layout check
                window.location.reload();
            } else {
                setError(result.error || "Login failed");
                setLoading(false);
            }
        } catch (err) {
            setError("Network error");
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-black">
            <div className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-zinc-800 rounded-full border border-zinc-700">
                        <Lock className="w-8 h-8 text-zinc-300" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center text-white mb-2">Admin Secure Gateway</h1>
                <p className="text-zinc-400 text-center mb-8">Enter your access credentials to continue.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 transition-all font-mono"
                            required
                        />
                    </div>
                    {error && (
                        <div className="text-red-400 text-sm text-center bg-red-950/30 py-2 rounded border border-red-900/50">
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-white text-black hover:bg-zinc-200 font-medium rounded-lg transition-colors flex justify-center items-center disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authenticate"}
                    </button>
                    <p className="text-xs text-zinc-600 text-center mt-4 uppercase tracking-widest font-mono">
                        Lumina Studio Restricted Area
                    </p>
                </form>
            </div>
        </div>
    );
}
