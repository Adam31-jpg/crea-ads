"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Cpu,
  Layers,
  Zap,
  Shield,
  CreditCard,
  Play,
  CheckCircle2
} from "lucide-react";
import type { Variants } from "framer-motion";

/* ============================================================
   GLOBAL ANIMATIONS (STRICT ADHERENCE)
   Initial state: { opacity: 0, y: 40 }
   Final state: { opacity: 1, y: 0 }
   Transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }
   ============================================================ */
const revealVariant: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

/* ============================================================
   GOLDEN AURORA HALOS 
   amber-500/20, orange-600/20, yellow-400/10 with blur-[160px]
   Hardware accelerated with will-change-transform
   ============================================================ */
const BackgroundHalos = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Halo 1 (Top Left): Amber */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.25, 0.15],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -left-32 w-[800px] h-[800px] rounded-full bg-amber-500/20 blur-[160px] will-change-transform transform-gpu"
      />

      {/* Halo 2 (Center Right): Orange */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15],
          x: [0, -40, 0],
          y: [0, -50, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 -right-32 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-orange-600/20 blur-[160px] will-change-transform transform-gpu"
      />

      {/* Halo 3 (Bottom Center): Yellow */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.05, 0.15, 0.05],
          x: [-30, 30, -30],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-64 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] rounded-full bg-yellow-400/20 blur-[160px] will-change-transform transform-gpu"
      />
    </div>
  );
};

/* ============================================================
   PAGE COMPONENT
   ============================================================ */
export default function LandingPage() {
  const t = useTranslations("Landing");

  const features = [
    { icon: <Layers className="h-6 w-6" />, title: t("features.c1Title"), desc: t("features.c1Desc") },
    { icon: <Shield className="h-6 w-6" />, title: t("features.c2Title"), desc: t("features.c2Desc") },
    { icon: <CreditCard className="h-6 w-6" />, title: t("features.c3Title"), desc: t("features.c3Desc") },
  ];

  const processSteps = [
    { icon: <Cpu className="h-8 w-8" />, title: t("process.step1Title"), desc: t("process.step1Desc") },
    { icon: <Zap className="h-8 w-8" />, title: t("process.step2Title"), desc: t("process.step2Desc") },
    { icon: <Play className="h-8 w-8" />, title: t("process.step3Title"), desc: t("process.step3Desc") },
  ];

  const testimonials = [
    { feedback: t("testimonials.feedback1"), name: t("testimonials.name1"), role: t("testimonials.role1") },
    { feedback: t("testimonials.feedback2"), name: t("testimonials.name2"), role: t("testimonials.role2") },
    { feedback: t("testimonials.feedback3"), name: t("testimonials.name3"), role: t("testimonials.role3") },
  ];

  const pricingPacks = [
    {
      title: t("pricing.p1Title"),
      price: t("pricing.p1Price"),
      credits: t("pricing.p1Credits"),
      label: t("pricing.p1Label"),
      btn: t("pricing.p1Btn"),
      link: "/login?next=/dashboard?buy=variant-001",
      advs: [t("pricing.p1Adv1"), t("pricing.p1Adv2"), t("pricing.p1Adv3"), t("pricing.p1Adv4")]
    },
    {
      title: t("pricing.p2Title"),
      price: t("pricing.p2Price"),
      credits: t("pricing.p2Credits"),
      label: t("pricing.p2Label"),
      btn: t("pricing.p2Btn"),
      link: "/login?next=/dashboard?buy=variant-002",
      highlight: true,
      stat: t("pricing.p2Stat"),
      advs: [t("pricing.p2Adv1"), t("pricing.p2Adv2"), t("pricing.p2Adv3"), t("pricing.p2Adv4")]
    },
    {
      title: t("pricing.p3Title"),
      price: t("pricing.p3Price"),
      credits: t("pricing.p3Credits"),
      label: t("pricing.p3Label"),
      btn: t("pricing.p3Btn"),
      link: "/login?next=/dashboard?buy=variant-003",
      advs: [t("pricing.p3Adv1"), t("pricing.p3Adv2"), t("pricing.p3Adv3"), t("pricing.p3Adv4")]
    },
  ];

  const globalAdvs = [
    t("pricing.globalAdv1"),
    t("pricing.globalAdv2"),
    t("pricing.globalAdv3"),
  ];

  return (
    // FULL GOLDEN/FREEMIUM OVERHAUL: Deep charcoal/midnight blue -> bg-[#0A0A0A], Champagne for light mode -> bg-[#FDFBF7]
    <div className="relative min-h-screen bg-[#FDFBF7] dark:bg-[#0A0A0A] text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans selection:bg-amber-500/30 transition-colors duration-500">

      {/* Background Effect */}
      <BackgroundHalos />

      {/* ---- Glass Navbar ---- */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-white/50 dark:bg-black/20 border-b border-black/5 dark:border-white/10 transition-colors">
        <div className="flex items-center gap-8 max-w-7xl mx-auto w-full">
          <Link href="/" className="text-xl font-bold tracking-tight flex items-center gap-2 group">
            <Image
              src="/logo-lumina.png"
              alt="Lumina Logo"
              width={32}
              height={32}
              className="transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]"
            />
            Lumina
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/help" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
              {t("nav.help")}
            </Link>
            <Link href="/login" className="hidden sm:block text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
              {t("nav.signIn")}
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-white/90 rounded-full px-5 shadow-sm">
                {t("nav.getStarted")}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-24 space-y-32">

        {/* =======================================================
            SECTION 1: HERO (High Energy Golden)
            ======================================================= */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center text-center px-6 pt-16 max-w-5xl mx-auto"
        >
          <motion.div variants={revealVariant} className="mb-8">
            <span className="inline-flex items-center rounded-full border border-amber-500/20 dark:border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-1.5 text-xs font-medium backdrop-blur-md text-amber-700 dark:text-amber-300">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 mr-2 animate-pulse" />
              {t("hero.beta")}
            </span>
          </motion.div>

          <motion.h1
            variants={revealVariant}
            /* GOLDEN TYPOGRAPHY: bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 */
            className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tighter mb-8 bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-600 dark:bg-gradient-to-r dark:from-amber-200 dark:via-yellow-400 dark:to-orange-500 text-transparent bg-clip-text leading-[1.1] pb-2"
          >
            {t("hero.h1")}
          </motion.h1>

          <motion.p
            variants={revealVariant}
            className="text-lg sm:text-xl text-zinc-600 dark:text-gray-400 max-w-3xl mb-12 leading-relaxed"
          >
            {t("hero.subtext")}
          </motion.p>

          <motion.div variants={revealVariant} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-20 z-20">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full rounded-full h-14 px-8 text-base bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] transition-all duration-300 border-0"
              >
                {t("hero.ctaPrimary")}
              </Button>
            </Link>
            <Link href="#preview" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-full h-14 px-8 text-base bg-black/5 dark:bg-white/5 backdrop-blur-md border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-colors gap-2 text-zinc-900 dark:text-white"
              >
                <Play className="h-4 w-4" />
                {t("hero.ctaSecondary")}
              </Button>
            </Link>
          </motion.div>

          {/* Golden Dashboard Mockup */}
          <motion.div
            variants={revealVariant}
            className="w-full max-w-5xl aspect-[16/9] rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/40 backdrop-blur-xl relative overflow-hidden flex items-center justify-center shadow-[0_0_50px_-12px_rgba(245,158,11,0.2)] group"
          >
            {/* Top Bar for Dashboard */}
            <div className="absolute top-0 w-full h-12 border-b border-black/10 dark:border-white/10 flex items-center px-4 gap-2 bg-black/5 dark:bg-white/5">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-amber-400/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
            </div>
            {/* Play Button inside mockup */}
            <div className="h-20 w-20 rounded-full bg-white/10 dark:bg-white/5 border border-black/10 dark:border-white/10 flex flex-col items-center justify-center group-hover:scale-110 transition-transform duration-500 backdrop-blur-md">
              <Play className="h-8 w-8 text-zinc-800 dark:text-zinc-200 ml-1" />
            </div>
          </motion.div>
        </motion.section>

        {/* =======================================================
            SECTION 2: SOCIAL PROOF (Infinite Marquee)
            ======================================================= */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="w-full overflow-hidden flex flex-col items-center py-10"
        >
          <motion.p variants={revealVariant} className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-10 text-center tracking-wide">
            {t("socialProof.title")}
          </motion.p>
          {/* Framer Motion Infinite Marquee with CSS linear-gradient fade edges */}
          <motion.div variants={revealVariant} className="w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
            <motion.div
              className="flex w-max items-center will-change-transform transform-gpu"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
            >
              {/* Elements duplicated exactly to allow smooth infinite scrolling */}
              {[1, 2].map((group) => (
                <div key={group} className="flex gap-16 sm:gap-32 pr-16 sm:pr-32 items-center">
                  <div className="group flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-transparent grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:border-[#FF9900] hover:shadow-[0_0_25px_rgba(255,153,0,0.6)] cursor-default">
                    <span className="text-2xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-100 group-hover:text-white transition-colors duration-300">AWS</span>
                  </div>
                  <div className="group flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-transparent grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:border-[#00D1FF] hover:shadow-[0_0_25px_rgba(0,209,255,0.6)] cursor-default">
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-white transition-colors duration-300">REMOTION</span>
                  </div>
                  <div className="group flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-transparent grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:border-[#3ECF8E] hover:shadow-[0_0_25px_rgba(62,207,142,0.6)] cursor-default">
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-white transition-colors duration-300">SUPABASE</span>
                  </div>
                  <div className="group flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-transparent grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:border-white hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] cursor-default">
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-white transition-colors duration-300">NEXT.JS</span>
                  </div>
                  <div className="group flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-transparent grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:border-white hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] cursor-default">
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-white transition-colors duration-300">VERCEL</span>
                  </div>
                  <div className="group flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-transparent grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:border-[#4285F4] hover:shadow-[0_0_25px_rgba(66,133,244,0.6)] cursor-default">
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-white transition-colors duration-300">GOOGLE AI</span>
                  </div>
                  <div className="group flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-transparent grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:border-[#635BFF] hover:shadow-[0_0_25px_rgba(99,91,255,0.6)] cursor-default">
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-white transition-colors duration-300">STRIPE</span>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </motion.section>

        {/* =======================================================
            SECTION 3: FEATURES (Glassmorphic)
            ======================================================= */}
        <motion.section
          id="features"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="px-6 max-w-6xl mx-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div key={i} variants={revealVariant}>
                {/* Glow matches Golden Theme */}
                <div className="h-full rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-lg border border-black/10 dark:border-white/10 hover:border-amber-500/50 dark:hover:border-amber-400/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] transition-all duration-500 p-8 flex flex-col items-start text-left">
                  <div className="h-12 w-12 rounded-xl bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center mb-6 text-zinc-900 dark:text-zinc-100 shadow-sm">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3 tracking-tight text-zinc-900 dark:text-zinc-100">{feature.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* =======================================================
            SECTION 4: HOW IT WORKS
            ======================================================= */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="px-6 max-w-6xl mx-auto"
        >
          <motion.div variants={revealVariant} className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-600 dark:bg-gradient-to-r dark:from-amber-200 dark:via-yellow-400 dark:to-orange-500 text-transparent bg-clip-text">
              {t("process.title")}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative items-start">
            {/* Connecting line (Desktop) */}
            <div className="hidden md:block absolute top-[40px] left-[15%] w-[70%] h-[1px] bg-gradient-to-r from-transparent via-black/20 dark:via-white/20 to-transparent" />

            {processSteps.map((step, i) => (
              <motion.div key={i} variants={revealVariant} className="flex flex-col items-center text-center relative z-10 group">
                <div className="h-20 w-20 rounded-2xl bg-zinc-100 dark:bg-[#111111] border border-black/10 dark:border-white/10 flex items-center justify-center mb-6 text-zinc-800 dark:text-zinc-200 shadow-xl group-hover:scale-110 transition-transform duration-500 group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight text-zinc-900 dark:text-zinc-100">{step.title}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed px-4">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* =======================================================
            SECTION 5: TESTIMONIALS
            ======================================================= */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="px-6 max-w-6xl mx-auto"
        >
          <motion.div variants={revealVariant} className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-600 dark:bg-gradient-to-r dark:from-amber-200 dark:via-yellow-400 dark:to-orange-500 text-transparent bg-clip-text">
              {t("testimonials.title")}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testi, i) => (
              <motion.div key={i} variants={revealVariant}>
                <div className="h-full rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-lg border border-black/10 dark:border-white/10 p-8 flex flex-col justify-between hover:border-black/20 dark:hover:border-white/20 transition-all duration-300">
                  <p className="text-lg italic text-zinc-700 dark:text-zinc-300 mb-8 font-medium">
                    {testi.feedback}
                  </p>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white">{testi.name}</h4>
                    <span className="text-sm text-zinc-500 dark:text-zinc-500">{testi.role}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>


        {/* =======================================================
            SECTION 6: PRICING (SOPHISTICATED CREDIT PACKS)
            ======================================================= */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="px-6 py-10 max-w-5xl mx-auto"
        >

          <motion.div variants={revealVariant} className="text-center mb-10">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-600 dark:bg-gradient-to-r dark:from-amber-200 dark:via-yellow-400 dark:to-orange-500 text-transparent bg-clip-text mb-4">
              {t("pricing.title")}
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium">
              {t("pricing.note")}
            </p>
          </motion.div>
          {/* Anti-Sub/One Time Payment Glassmorphic Tag */}
          <motion.div variants={revealVariant} className="flex justify-center mb-8">
            <span className="inline-flex items-center bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 px-8 py-4 rounded-full font-bold text-[18px] tracking-wide text-zinc-900 dark:text-white shadow-sm">
              {t("pricing.badgeAntiSub")}
            </span>
          </motion.div>

          <motion.div variants={revealVariant} className="flex flex-col md:flex-row items-center mb-22 justify-center gap-4 mb-4">
            {globalAdvs.map((adv, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium bg-black/5 dark:bg-white/5 px-5 py-2.5 rounded-full border border-black/10 dark:border-white/10 backdrop-blur-sm">
                <CheckCircle2 className="h-4 w-4 text-amber-500" />
                {adv}
              </div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {pricingPacks.map((pack, i) => (
              <motion.div key={i} variants={revealVariant} className={`relative ${pack.highlight ? 'z-10' : 'z-0'}`}>
                {/* Pro card taller with Golden border/background */}
                {pack.highlight && (
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-amber-400 to-orange-600 opacity-50 blur-lg transform-gpu" />
                )}
                <div className={`relative flex flex-col rounded-3xl transition-transform duration-300 ${pack.highlight
                  ? "md:scale-110 bg-[#FDFBF7] dark:bg-[#0A0A0A] border-2 border-amber-500/50 shadow-2xl p-8 py-12"
                  : "bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 p-8 py-10"
                  }`}>
                  {pack.highlight && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[85%] text-center">
                      <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[11px] font-bold uppercase tracking-widest py-1.5 px-6 rounded-full shadow-lg border border-amber-300/30">
                        {t("pricing.badgePro")}
                      </span>
                    </div>
                  )}

                  <h3 className={`text-xl font-semibold mb-6 ${pack.highlight ? "text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-400 mt-2" : "text-zinc-600 dark:text-zinc-400"}`}>{pack.title}</h3>
                  <div className="text-5xl font-bold tracking-tighter mb-2 text-zinc-900 dark:text-white">{pack.price}</div>

                  {pack.label && (
                    <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">{pack.label}</div>
                  )}

                  <div className={`w-fit text-sm font-medium mb-8 py-2 px-4 rounded-lg ${pack.highlight ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-black/5 dark:bg-white/10"}`}>
                    {pack.credits}
                  </div>

                  {pack.stat && (
                    <div className="mb-6 py-3 px-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold text-center leading-relaxed">
                      {pack.stat}
                    </div>
                  )}

                  {/* Advantages bullet list */}
                  <ul className="space-y-4 mb-10 flex-1">
                    {pack.advs.map((adv, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                        <CheckCircle2 className={`h-4 w-4 ${pack.highlight ? "text-amber-500" : "text-zinc-400"}`} />
                        {adv}
                      </li>
                    ))}
                  </ul>

                  <Link href={pack.link} className="w-full">
                    <Button
                      className={`w-full rounded-full h-12 text-base transition-all ${pack.highlight
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-xl hover:scale-105 border-0"
                        : "bg-black/10 dark:bg-white/10 text-zinc-900 dark:text-white hover:bg-black/20 dark:hover:bg-white/20"
                        }`}
                      variant={pack.highlight ? "default" : "secondary"}
                    >
                      {pack.btn}
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* =======================================================
            SECTION 7: FAQ (Shadcn Accordion)
            ======================================================= */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="px-6 py-10 max-w-3xl mx-auto"
        >
          <motion.h2 variants={revealVariant} className="text-4xl font-bold tracking-tighter text-center mb-12 bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-600 dark:bg-gradient-to-r dark:from-amber-200 dark:via-yellow-400 dark:to-orange-500 text-transparent bg-clip-text">
            {t("faq.title")}
          </motion.h2>

          <motion.div variants={revealVariant} className="rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-lg border border-black/10 dark:border-white/10 p-6 sm:p-8">
            <Accordion type="single" collapsible className="w-full">
              {[1, 2, 3, 4, 5].map((item) => (
                <AccordionItem key={item} value={`item-${item}`} className="border-black/10 dark:border-white/10">
                  <AccordionTrigger className="text-left font-medium text-lg hover:text-amber-600 dark:hover:text-amber-500 transition-colors text-zinc-900 dark:text-zinc-100">
                    {t(`faq.q${item}` as any)}
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-base pt-2">
                    {t(`faq.a${item}` as any)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </motion.section>

        {/* =======================================================
            SECTION 8: FINAL CTA CARD
            ======================================================= */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="px-6 py-10 max-w-5xl mx-auto"
        >
          <motion.div variants={revealVariant} className="relative rounded-3xl overflow-hidden border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.15)] group">
            {/* CTA Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-600/10 to-transparent dark:from-amber-500/20 dark:via-orange-600/20 z-0 pointer-events-none transition-all duration-700 group-hover:opacity-80" />
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-500/30 blur-[100px] z-0" />

            <div className="relative z-10 p-12 sm:p-16 text-center flex flex-col items-center">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-6 bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-600 dark:bg-gradient-to-r dark:from-amber-200 dark:via-yellow-400 dark:to-orange-500 text-transparent bg-clip-text">
                {t("cta.title")}
              </h2>
              <p className="text-lg text-zinc-700 dark:text-zinc-300 font-medium mb-10 max-w-2xl">
                {t("cta.offer")}
              </p>
              <Link href="/signup">
                <Button size="lg" className="rounded-full h-14 px-8 text-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:shadow-[0_0_50px_rgba(245,158,11,0.6)] transition-all duration-300 border-0 group-hover:scale-105">
                  {t("cta.btn")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.section>

      </main>

      {/* ---- Footer ---- */}
      <footer className="relative z-10 border-t border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-md px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <p>{t("footer.rights")}</p>
          <div className="flex items-center gap-6">
            <Link href="/bug" className="hover:text-amber-600 dark:hover:text-amber-500 transition-colors flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("footer.bug")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
