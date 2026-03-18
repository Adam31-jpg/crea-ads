import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),

    // ─── Providers ─────────────────────────────────────────────────────────────
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),

        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                    select: { id: true, email: true, name: true, image: true, password_hash: true, credits: true },
                });

                if (!user || !user.password_hash) return null;

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password_hash
                );

                if (!isValid) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    credits: user.credits,
                };
            },
        }),
    ],

    // ─── JWT + Session ──────────────────────────────────────────────────────────
    // Use JWT strategy so Credentials provider works (PrismaAdapter requires jwt
    // strategy when using Credentials to avoid session table conflicts).
    session: { strategy: "jwt" },

    callbacks: {
        async jwt({ token, user }) {
            // On initial sign-in, `user` is populated; persist id + credits to token.
            if (user) {
                token.id = user.id;
                token.credits = (user as { credits?: number }).credits ?? 0;
            }
            return token;
        },

        async session({ session, token }) {
            // Expose id + credits on the client-side session object.
            if (session.user) {
                session.user.id = token.id as string;
                (session.user as { credits?: number }).credits = token.credits as number;
            }
            return session;
        },
    },

    // ─── Pages ─────────────────────────────────────────────────────────────────
    pages: {
        signIn: "/login",
        signOut: "/",
        error: "/login",
    },

    // ─── Events ────────────────────────────────────────────────────────────────
    events: {
        // Assign 10 free credits when a brand-new OAuth user signs up.
        async createUser({ user }) {
            await prisma.user.update({
                where: { id: user.id },
                data: { credits: 10 },
            });
        },
    },
});
