"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Bug, Zap, CreditCard, Wrench } from "lucide-react";
import Link from "next/link";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HelpClientProps {
    isLoggedIn: boolean;
}

export function HelpClient({ isLoggedIn }: HelpClientProps) {
    const t = useTranslations("help");
    const [searchQuery, setSearchQuery] = useState("");

    const navLink = isLoggedIn ? "/dashboard" : "/";
    const navText = isLoggedIn ? t("nav.backToDashboard") : t("nav.backToHome");

    const categoryData = [
        { id: "getting_started", count: 3, icon: Zap },
        { id: "tokens", count: 4, icon: CreditCard },
        { id: "technical", count: 4, icon: Wrench },
        { id: "security", count: 3 },
        { id: "support", count: 2 },
    ];

    const urgentTopics = categoryData.slice(0, 3);

    const query = searchQuery.toLowerCase();

    const filteredCategories = categoryData.map(cat => {
        const title = t(`categories.${cat.id}.title`);
        const qas = [];
        for (let i = 1; i <= cat.count; i++) {
            const q = t(`categories.${cat.id}.q${i}`);
            const a = t(`categories.${cat.id}.a${i}`);
            if (!query || q.toLowerCase().includes(query) || a.toLowerCase().includes(query) || title.toLowerCase().includes(query)) {
                qas.push({ q, a, id: `${cat.id}-${i}` });
            }
        }
        return { ...cat, title, qas };
    }).filter(cat => cat.qas.length > 0);

    const hasResults = filteredCategories.length > 0;

    const scrollToCategory = (id: string) => {
        document.getElementById(`category-${id}`)?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-foreground selection:bg-brand/30 relative overflow-hidden flex flex-col">
            {/* GPU Accelerated Aurora Halos */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden will-change-transform transform-gpu">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/20 blur-[160px]" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-orange-600/20 blur-[160px]" />
                <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] rounded-full bg-yellow-400/10 blur-[160px]" />
            </div>

            <div className="relative z-10 flex-1 flex flex-col">
                {/* Navigation */}
                <header className="px-6 py-8">
                    <Link
                        href={navLink}
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-amber-400 transition-colors group"
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">{navText}</span>
                    </Link>
                </header>

                <main className="flex-1 max-w-4xl w-full mx-auto px-6 pb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-6 mb-16"
                    >
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight font-[var(--font-bodoni)] bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 text-transparent bg-clip-text">
                            {t("title")}
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {t("intro.description")}
                        </p>

                        <div className="relative max-w-xl mx-auto mt-8">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-500/50" />
                            <Input
                                type="text"
                                placeholder={t("search_placeholder")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 h-14 bg-white/5 backdrop-blur-md border border-amber-500/10 focus-visible:ring-amber-500/30 text-lg rounded-xl transition-all"
                            />
                        </div>
                    </motion.div>

                    {/* Urgent Topics Cards */}
                    {!query && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20"
                        >
                            {urgentTopics.map((topic) => {
                                const Icon = topic.icon!;
                                return (
                                    <button
                                        key={topic.id}
                                        onClick={() => scrollToCategory(topic.id)}
                                        className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/5 border border-amber-500/10 hover:border-amber-500/30 hover:scale-105 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
                                    >
                                        <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Icon className="h-6 w-6 text-amber-400" />
                                        </div>
                                        <h3 className="font-semibold text-lg">{t(`categories.${topic.id}.title`)}</h3>
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}

                    {/* FAQ Accordions */}
                    <div className="space-y-16">
                        {hasResults ? (
                            filteredCategories.map((category) => (
                                <motion.div
                                    key={category.id}
                                    id={`category-${category.id}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="scroll-mt-24"
                                >
                                    <h2 className="text-2xl font-bold mb-6 text-amber-500/90 flex items-center gap-3">
                                        {category.title}
                                    </h2>
                                    <Accordion type="multiple" className="space-y-4">
                                        {category.qas.map((qa) => (
                                            <AccordionItem
                                                key={qa.id}
                                                value={qa.id}
                                                className="bg-white/5 border border-amber-500/10 rounded-xl px-4 data-[state=open]:border-amber-500/30 transition-colors"
                                            >
                                                <AccordionTrigger className="text-left font-medium text-base hover:no-underline py-5 text-foreground">
                                                    {qa.q}
                                                </AccordionTrigger>
                                                <AccordionContent className="text-muted-foreground leading-relaxed pt-2 pb-5 text-base">
                                                    {qa.a}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-20"
                            >
                                <p className="text-xl text-muted-foreground mb-4">
                                    {t("search.emptyState")}
                                    <br />
                                    <Link href="/bug" className="text-amber-400 hover:text-amber-300 transition-colors mt-2 inline-block font-medium">
                                        [{t("search.emptyStateLink")}]
                                    </Link>
                                </p>
                            </motion.div>
                        )}
                    </div>
                </main>

                {/* Footer CTA */}
                <footer className="w-full border-t border-amber-500/10 bg-white/5 backdrop-blur-lg py-12 mt-auto">
                    <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                        <div>
                            <h3 className="text-xl font-bold text-foreground">
                                {t("cta.text")}
                            </h3>
                            <p className="text-muted-foreground mt-1">
                                Notre équipe technique est disponible pour vous aider.
                            </p>
                        </div>
                        <Link href="/bug">
                            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-full px-8 gap-2">
                                <Bug className="h-4 w-4" />
                                {t("cta.button")}
                            </Button>
                        </Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
