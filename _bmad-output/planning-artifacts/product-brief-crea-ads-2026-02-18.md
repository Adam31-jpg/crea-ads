---
stepsCompleted: [1, 2, 3, 4, 5, 6]
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

## Target Users

### Primary Users
**Performance Marketing Managers & Creative Strategists**
- **Context:** Responsible for scaling successful ad campaigns and maintaining low CPA (Cost Per Acquisition).
- **Pain Point:** They know exactly *what* works (the "winning angle") but are blocked by the slow speed of manual design production. They can't wait 2 weeks for 50 variations.
- **Goal:** To instantly generate high-quality volume to "feed the beast" (the ad algorithms) without sacrificing brand aesthetics.

### Secondary Users
- **Media Buyers:** Need the autonomy to quickly pull or regenerate assets for A/B testing without lagging communication loops with creative teams.
- **Brand Managers:** The "Gatekeepers" who need assurance that the "Apple-style" premium aesthetic is strictly maintained across all automated output.

### User Journey
**The "Hair on Fire" Moment:**
It's 4 PM. A key campaign is starting to fatigue—CPAs are creeping up. To maintain momentum, the team needs 20-50 fresh, premium creative variations *immediately* for tomorrow's auction. The internal design team is booked solid for two weeks.
1.  **Action:** The Strategist logs into Lumina, uploads the hero product PNG, and inputs the winning selling points.
2.  **Magic:** With one click, Lumina generated 10 diverse, on-brand assets (Stills & Motion).
3.  **Result:** The Media Buyer launches the new ads by 5 PM. Performance stabilizes.

---

## Technical Directives (User Mandate)

**Critical Architecture Requirement: The "Modular Engine"**
To support the long-term vision of a massive enterprise platform, the codebase must strictly adhere to a **Hyper-Malleable** and **Dynamically Structured** architecture.

-   **Decoupled Logic:** The Rendering Engine (Remotion/Three.js), AI Orchestration (OpenRouter), and User Interface must be loosely coupled.
-   **Extensibility:** New "Camera Paths," "Lighting Presets," and "Visual Styles" must be pluggable modules. Adding a new style should never require refactoring the core system.
-   **Scalability:** Code must be DRY, documented, and capable of evolving seamlessly from v1 to enterprise scale.

**Multi-Format Output (Responsive Design):**
-   **Requirement:** Lumina must generate each asset in multiple aspect ratios (minimum 1:1 for Square Feeds and 9:16 for Stories/TikTok) from the same input props.
-   **Implementation:** Remotion compositions must be "Responsive" by design, dynamically adjusting layout and camera framing based on the target aspect ratio.

**Color Harmony Engine:**
-   **Requirement:** Automated palette extraction from the product PNG to align background generation (via Fal.ai) and studio lighting (via Remotion) with the brand colors.
-   **Implementation:** Analysis of the uploaded image to derive primary/secondary colors and generate a matching theme.

**Social Media Safe Areas:**
-   **Requirement:** Responsive layouts and smart typography must prevent UI overlaps (Like/Share buttons, captions) on 9:16 formats (Stories/TikTok/Reels).
-   **Implementation:** predefined "safe zones" in Remotion templates that constrain text/logo placement.

## Success Metrics

### User Success (The "Aha!" Moment)
- **Velocity:** A full batch of 10 multi-format assets must be ready for preview in **< 60 seconds**.
- **Frictionless Scaling:** **100% reduction** in "resize" or "minor variation" tickets sent to the design team. The user should feel they have a "Designer-in-a-box."
- **Aesthetic Confidence:** High **Selection Rate** (at least 8 out of 10 generated assets are deemed "launch-ready" by the Brand Manager).

### Business Impact
- **Cost Efficiency:** Reducing the cost per creative asset by at least **90%** compared to traditional agency or in-house hourly rates.
- **Performance Stability:** A measurable decrease in "Ad Fatigue" indicators (CPA stability) over a 30-day period due to the high volume of fresh variations.

### Key Performance Indicators (KPIs)
- **Reliability:** **99.5% success rate** on AWS Lambda renders. Zero-failure production is the target.
- **Volume:** Successfully generate **1,000+ premium assets** in the first 30 days of internal beta.
- **Diversity Index:** Using LLM verification to ensure that in a run of 100 assets, no two assets share the same background/angle combination unless explicitly requested.

## MVP Scope

### Core Features (v1)
- **Upload & Configuration:** User uploads Product PNG + Inputs key selling points.
- **"Ad Factory" Generation:** One-click generation of 10 assets (7 Stills / 3 Videos) using 5 distinct "High Converter" premium templates.
- **Dynamic Prop Editor (Critical):** Users can modify text/selling points on any generated asset and trigger an immediate re-render via Remotion input props. *No complex timeline editing, but full text control.*
- **Batch Management:** Bulk grouping in the dashboard and one-click export (Zip) for high-volume generation.
- **Multi-Format Export:** Auto-generation of Square (1:1) and Vertical (9:16) formats for all assets.
- **Studio-Grade Rendering:** Integration with Fal.ai (backgrounds) and @remotion/three (3D motion/lighting).

### Out of Scope for MVP (Defer to v2)
- **Custom Brand Kits:** Users cannot upload custom fonts/colors in v1. *MVP relies on curated "Apple-style" presets to guarantee design quality.*
- **Advanced Timeline Editor:** No drag-and-drop video editing or keyframe manipulation.
- **API Access:** No public API for third-party integrations initially.
- **Team Collaboration:** No multi-user permissions or approval workflows in v1.

### MVP Success Criteria
- **Functional:** User can go from Upload -> Edit Text -> Final Export in < 5 minutes.
- **Technical:** Rendering engine handles concurrent requests without crashing (AWS Lambda stability).
- **Quality:** Generated assets are indistinguishable from high-end agency work (verified by Brand Manager selection rate).

### Future Vision
- **Enterprise Scale:** A massive platform for global brands to generate thousands of localized assets overnight.
- **Full Creative Control:** Advanced "Pro Mode" editor for fine-tuning motion curves and lighting.
- **AI Director:** Autonomous agents that analyze ad performance data and *automatically* generate new variations to beat the current winner.
