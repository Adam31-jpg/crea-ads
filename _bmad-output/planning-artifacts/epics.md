---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: ['product-brief-crea-ads-2026-02-18.md', 'c:/Users/adamh/Documents/Projects/crea-ads/_bmad-output/planning-artifacts/architecture.md']
status: 'complete'
completedAt: '2026-02-18'
---

# crea-ads - Epic & Story Breakdown

## Overview

This document provides the complete epic and story breakdown for crea-ads, decomposing the requirements from the Product Brief and Architecture documents into implementable User Stories with strict Acceptance Criteria (AC).

## Requirements Inventory

### Functional Requirements (FR)

| ID | Requirement | Description | Epic Map |
| :--- | :--- | :--- | :--- |
| **FR1** | **Media Mix Controller** | Generate 10 assets (Stills & Videos) with mixed aspect ratios (16:9, 9:16, 4:5, 1:1) from one input. | Epic 3 |
| **FR2** | **Diversity Logic** | Maintain visual distinction using "Style Hashing" to prevent duplicates. | Epic 3 |
| **FR3** | **Aesthetic Motion** | "Apple-style" high-end visuals with smooth animation (Remotion). | Epic 2 |
| **FR4** | **UGC Integration** | Support blending user-uploaded images/videos with generated elements. | Epic 4 |
| **FR5** | **Modular Engine** | Decouple "Creative Logic" (Compositions) from "Business Logic" (Next.js). | Epic 2 |
| **FR6** | **Realtime Progress** | Live generation progress without polling. | Epic 4 |
| **FR7** | **Dynamic Prop Editor** | Manual override of text/props with immediate re-render priority. | Epic 4 |
| **FR8** | **Color Harmony Engine** | Automated palette extraction from product PNG to drive background/lighting. | Epic 3 |
| **FR9** | **Social Safe Areas** | Smart layout constraints for 9:16 formats to avoid UI overlap. | Epic 2 |

### Non-Functional Requirements (NFR)

*   **NFR1:** Performance (<60s for 10 assets).
*   **NFR2:** Brand Compliance (Strict adherence to tokens).
*   **NFR3:** Reliability (Auto-retry, graceful failure).
*   **NFR4:** Scalability (Lambda Fan-Out).

---

## Epic List & Story Breakdown

### Epic 1: Engine Foundation & Security
**Goal:** Establish the secure, modular infrastructure required to support the creative engine, ensuring strict data isolation and scalable execution.

*   **Story 1.1: Initialize Modular Engine Repository**
    *   **As a** System Architect
    *   **I want to** initialize a Next.js App Router project with a strict property boundary between `src/engine` and `src/app`
    *   **So that** the creative logic is decoupled from the UI and ready for independent scaling.
    *   **Acceptance Criteria:**
        *   [ ] Project initialized with `create-next-app` (TypeScript, Tailwind, ESLint).
        *   [ ] Directory structure created: `src/engine` (Remotion root), `src/app` (Next.js UI), `src/lib/adapter`.
        *   [ ] `tsconfig.json` configured with path aliases (`@engine/*`, `@app/*`).
        *   [ ] CI/CD pipeline (GitHub Actions) setup for basic lint/build check.

*   **Story 1.2: Database Schema & Realtime Setup**
    *   **As a** Backend Developer
    *   **I want to** configure Supabase with the defined relational schema and enable Realtime
    *   **So that** I can store generation jobs and track their status live.
    *   **Acceptance Criteria:**
        *   [ ] Supabase project created/connected.
        *   [ ] Tables created: `batches` (user inputs), `jobs` (individual renders), `generation_history` (deduplication).
        *   [ ] `REPLICA IDENTITY FULL` enabled on `jobs` table (critical for Realtime).
        *   [ ] RLS policies configured (Users can only access their own data).

*   **Story 1.3: Shared Validation Layer (Zod)**
    *   **As a** Developer
    *   **I want to** implement Shared Zod Schemas in `src/engine/schema`
    *   **So that** input props are validated identically by the API, UI, and Render Engine.
    *   **Acceptance Criteria:**
        *   [ ] Created `src/engine/schema/project.ts`.
        *   [ ] Defined schemas for `CreativeIntent` (Semantic) and `RemotionProps` (Technical).
        *   [ ] Exported TypeScript types inferred from Zod schemas.
        *   [ ] Implemented `validateProps` helper function used in both API and Remotion Root.

### Epic 2: Core Rendering Engine
**Goal:** Enable the programmatic generation of high-quality, branded video assets from structured data using the Modular Engine architecture.

*   **Story 2.1: Remotion Root & Dev Player**
    *   **As a** Creative Developer
    *   **I want to** configure the Remotion Root and a local development player
    *   **So that** I can build and preview compositions rapidly.
    *   **Acceptance Criteria:**
        *   [ ] `src/engine/Root.tsx` implemented with `Composition` definitions.
        *   [ ] Route `/start` (or `npm run remotion`) launches the Remotion Player.
        *   [ ] "Hello World" composition rendering successfully with passing props.

*   **Story 2.2: The Design Adapter Implementation**
    *   **As a** System
    *   **I want to** implement the `DesignAdapter` logic layer
    *   **So that** high-level semantic intent (e.g., "Luxury") is deterministically mapped to technical animation props.
    *   **Acceptance Criteria:**
        *   [ ] `resolveDesign(intent, overrides)` function implemented in `src/lib/adapter`.
        *   [ ] Unit tests verify that specific intents produce expected technical props (fonts, colors, easing).
        *   [ ] Implemented "Overrides" logic: Manual properties must supersede semantic defaults.

*   **Story 2.3: Master Composition & Social Safe Areas** (Combines FR5, FR9)
    *   **As a** Designer
    *   **I want to** build the main `MasterComposition` with responsive layout logic and safe zones
    *   **So that** assets are aesthetically pleasing and text is never obscured on TikTok/Reels (9:16).
    *   **Acceptance Criteria:**
        *   [ ] Composition accepts `aspectRatio` as a prop and adjusts layout (1:1 vs 9:16).
        *   [ ] "Safe Zone" overlay component implemented (visible only in debug mode).
        *   [ ] Text components automatically wrap/resize to stay within safe zones.
        *   [ ] Integration of `@remotion/three` for basic 3D camera movement.

*   **Story 2.4: AWS Lambda Rendering Pipeline**
    *   **As a** System
    *   **I want to** deploy the rendering engine to AWS Lambda
    *   **So that** I can render highly parallel jobs without managing servers.
    *   **Acceptance Criteria:**
        *   [ ] Remotion Lambda functions deployed to AWS region.
        *   [ ] `renderMediaOnLambda` function wrapper implemented with error handling.
        *   [ ] Webhook or polling mechanism to update Job status upon completion.

### Epic 3: AI Orchestration & Diversity
**Goal:** Automate the creation of diverse, on-brand creative concepts from raw product data using Generative AI and Style Hashing.

*   **Story 3.1: Color Harmony Engine** (FR8)
    *   **As a** System
    *   **I want to** analyze the input product image to extract a harmonious color palette
    *   **So that** the generated background and lighting match the product branding.
    *   **Acceptance Criteria:**
        *   [ ] Utility to extract dominant and accent colors from PNG URL.
        *   [ ] Logic to map extracted colors to "Moods" (e.g., Dark Mode vs Light Mode).
        *   [ ] Integration into the `DesignAdapter` to influence background generation.

*   **Story 3.2: LLM Orchestrator (OpenRouter)**
    *   **As a** System
    *   **I want to** use an LLM (via OpenRouter) to generate diversity in creative direction
    *   **So that** each of the 10 assets in a batch feels unique.
    *   **Acceptance Criteria:**
        *   [ ] `OpenRouterClient` implemented with robust error handling.
        *   [ ] System Prompt designed to output valid `CreativeIntent` JSON.
        *   [ ] "Style Hashing" logic: deduplicate concepts before rendering (FR2).

*   **Story 3.3: Generative Backgrounds (Fal.ai)**
    *   **As a** System
    *   **I want to** generate unique background images using Fal.ai
    *   **So that** the product is placed in a high-quality, context-aware scene.
    *   **Acceptance Criteria:**
        *   [ ] `FalClient` implemented (Flux or similar high-quality model).
        *   [ ] Background generation happens in parallel *before* video rendering.
        *   [ ] Fallback logic: Use solid color/gradient if Fal.ai fails.

### Epic 4: User Experience & Controls
**Goal:** Empower users to initiate batches, track progress in real-time, and refine results using dynamic tools.

*   **Story 4.1: Workspace Dashboard & Batch Trigger**
    *   **As a** User
    *   **I want to** upload a product image and define selling points
    *   **So that** I can trigger a new generation batch.
    *   **Acceptance Criteria:**
        *   [ ] Dashboard UI with "New Campaign" flow.
        *   [ ] Drag & drop image upload (to Supabase Storage).
        *   [ ] "Selling Points" input form.
        *   [ ] "Generate" button triggers the API and redirects to Progress View.

*   **Story 4.2: Realtime Progress Tracking** (FR6)
    *   **As a** User
    *   **I want to** see the status of each asset in the batch update live
    *   **So that** I'm not wondering if the system is frozen.
    *   **Acceptance Criteria:**
        *   [ ] `useBatchSubscription` hook implemented (Supabase Realtime).
        *   [ ] Visual cards for each of the 10 assets showing: Pending -> Generating -> Rendering -> Done.
        *   [ ] Error states visualized clearly on affected cards.

*   **Story 4.3: Dynamic Prop Editor** (FR7)
    *   **As a** User
    *   **I want to** click an asset to edit its text or colors and see a quick update
    *   **So that** I can fix minor AI mistakes without a full re-run.
    *   **Acceptance Criteria:**
        *   [ ] Asset Detail Modal with form inputs for `headline`, `colors`, etc.
        *   [ ] "Update" button triggers a single-asset re-render (High Priority).
        *   [ ] "Optimistic Update" or fast preview if possible.

*   **Story 4.4: Asset Delivery**
    *   **As a** User
    *   **I want to** download individual assets or the whole batch as a ZIP
    *   **So that** I can use them in my media campaigns.
    *   **Acceptance Criteria:**
        *   [ ] "Download" button on each completed asset card.
        *   [ ] "Download All" (ZIP) functionality.
        *   [ ] Assets are correctly named/tagged.
