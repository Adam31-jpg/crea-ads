---
stepsCompleted: [1, 2]
inputDocuments: []
date: 2026-02-18
author: Meda
---

# Product Brief: crea-ads

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

Lumina Creative Engine is a high-end, agentic "Ad Factory" platform designed to revolutionize the production of performance marketing creatives. By synthesizing the BMAD Method with advanced AI orchestration and studio-grade code-based rendering, Lumina enables the mass generation of "Aesthetic" ad creatives (Stills & Videos) that rival top-tier human design. Users can transform a single product PNG and key selling points into batches of highly diverse, professional assets with a single click, bridging the gap between automated scalability and premium "Apple-style" visual quality.

---

## Core Vision

### Problem Statement
Modern performance marketing demands a massive volume of creative assets to combat ad fatigue, but producing high-quality, high-design creatives at scale is prohibitively slow and expensive. Brands are forced to choose between the high cost/low volume of manual agency design or the low cost/high volume of generic, low-quality templates from existing automation tools.

### Problem Impact
- **Creative Bottleneck:** Marketing campaigns stall due to lack of fresh assets.
- **Brand Dilution:** usage of low-quality, template-heavy automation harms premium brand perception.
- **Ad Fatigue:** Lack of true visual diversity leads to rapid performance degradation in paid media channels.

### Why Existing Solutions Fall Short
Current "creative automation" tools typically rely on static templates that look generic and "cheap." They lack the capability to produce cinematic motion, dynamic 3D-like lighting key to premium aesthetics, and true variation. They solve for *quantity* but fail on *quality* and *desirability*.

### Proposed Solution
**Lumina Creative Engine**: An intelligent "Ad Factory" that automates the entire creative direction and production process.
- **Core Concept:** One-click generation of 10 unique assets (7 Stills / 3 Videos) from a single product image.
- **Technology:** Orchestration via OpenRouter (LLMs) maps selling points to structured input props. Rendering via Remotion/Three.js and Fal.ai delivers cinematic camera moves, product spins, and AI-generated backgrounds.
- **Infrastructure:** AWS Lambda + Next.js architecture ensures high-speed, parallelized mass production.

### Key Differentiators
- **Aesthetic Motion & Lighting:** Uses `@remotion/three` for cinematic camera movements (Dolly Zoom, Panning) and dynamic studio lighting (Rim/Key lights), making 2D PNGs feel like 3D hero objects.
- **Agentic Diversity Logic:** intelligently varies angles, styles, and backgrounds (via Fal.ai) for every asset in a run, preventing "template fatigue."
- **Premium Visual Standard:** A strict adherence to "Apple-style" transparency, clean typography, and glassmorphism, rejecting the "cluttered" look of standard ad tools.
- **Workflow Orchestration:** Seamless integration of LLM reasoning (for creative direction) with code-based video generation.
