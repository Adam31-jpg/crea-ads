"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { Variants } from "framer-motion";

/* ============================================================
   ANIMATION VARIANTS
   ============================================================ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" as const },
  }),
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ============================================================
   FEATURES DATA
   ============================================================ */

const features = [
  {
    icon: "✦",
    title: "AI-Powered Generation",
    description:
      "Describe your creative vision in natural language. Our engine translates intent into stunning, production-ready video compositions.",
  },
  {
    icon: "◎",
    title: "Batch Rendering",
    description:
      "Generate hundreds of unique video variations in a single run. Perfect for A/B testing across audiences and platforms.",
  },
  {
    icon: "⬡",
    title: "Cloud Export",
    description:
      "Render at scale on AWS Lambda. Export to every social format — 9:16, 1:1, 16:9 — with a single click.",
  },
];

/* ============================================================
   PAGE
   ============================================================ */

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-brand/5 blur-[120px]" />

      {/* ---- Navbar ---- */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link href="/" className="font-[var(--font-bodoni)] text-xl font-bold tracking-wide text-foreground">
          Lumina
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-32 max-w-4xl mx-auto"
      >
        <motion.div custom={0} variants={fadeUp}>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-4 py-1.5 text-xs font-medium text-brand mb-8">
            ✦ Now in Beta
          </span>
        </motion.div>

        <motion.h1
          custom={1}
          variants={fadeUp}
          className="font-[var(--font-bodoni)] text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6"
        >
          Create stunning
          <br />
          <span className="text-brand">product videos</span>
          <br />
          at scale.
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed"
        >
          Lumina is an AI-powered creative engine that generates
          production-ready video ads. From concept to render — in seconds, not
          days.
        </motion.p>

        <motion.div custom={3} variants={fadeUp} className="flex gap-4">
          <Link href="/signup">
            <Button size="lg" className="bg-brand text-brand-foreground shadow-lg shadow-brand/25 hover:shadow-brand/40 transition-shadow">
              Start Creating →
            </Button>
          </Link>
          <Link href="#features">
            <Button variant="outline" size="lg">
              See How It Works
            </Button>
          </Link>
        </motion.div>
      </motion.section>

      {/* ---- Features ---- */}
      <motion.section
        id="features"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="relative z-10 px-6 pb-32 max-w-6xl mx-auto"
      >
        <motion.h2
          custom={0}
          variants={fadeUp}
          className="text-center font-[var(--font-bodoni)] text-3xl sm:text-4xl font-bold mb-4"
        >
          Built for performance marketers
        </motion.h2>
        <motion.p
          custom={1}
          variants={fadeUp}
          className="text-center text-muted-foreground mb-16 max-w-xl mx-auto"
        >
          Everything you need to go from product data to high-converting video
          ads.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div key={feature.title} custom={i + 2} variants={fadeUp}>
              <Card className="h-full bg-card/50 backdrop-blur-md border-border/50">
                <CardContent className="pt-6">
                  <span className="text-3xl mb-4 block">{feature.icon}</span>
                  <h3 className="text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ---- CTA ---- */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="relative z-10 px-6 pb-32 max-w-4xl mx-auto text-center"
      >
        <motion.div
          custom={0}
          variants={fadeUp}
          className="rounded-2xl border border-border bg-card/60 backdrop-blur-lg p-12 sm:p-16"
        >
          <h2 className="font-[var(--font-bodoni)] text-3xl sm:text-4xl font-bold mb-4">
            Ready to transform your creative workflow?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join the beta and start generating professional video ads in
            minutes.
          </p>
          <Link href="/signup">
            <Button size="lg" className="shadow-lg shadow-brand/25">
              Get Started Free →
            </Button>
          </Link>
        </motion.div>
      </motion.section>

      {/* ---- Footer ---- */}
      <footer className="relative z-10 border-t border-border px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 Lumina. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
