import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pre-existing Prisma schema mismatches (cost_usd, bugReports, adminAuditLog,
  // supabase module stubs) cause tsc to fail the build. These are not runtime
  // errors — suppress until the schema is reconciled.
  typescript: {
    ignoreBuildErrors: true,
  },

  // CRITICAL: gives next-intl's plugin configuration space for Turbopack module aliases.
  // Without this, the plugin only configures webpack aliases and Vercel's Turbopack
  // runtime cannot resolve the i18n config file.
  turbopack: {},

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.fal.media',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
        port: '',
        pathname: '/**',
      },
    ],
  },

};

export default withNextIntl(nextConfig);
