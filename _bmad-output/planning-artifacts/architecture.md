stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['product-brief-crea-ads-2026-02-18.md', 'technical-modular-engine-architecture-research-2026-02-18.md']
workflowType: 'architecture'
project_name: 'crea-ads'
user_name: 'Meda'
date: '2026-02-18'
lastStep: 8
status: 'complete'
completedAt: '2026-02-18'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
-   **Batch Generation:** 1-click execution of 10 distinct assets (Stills & Video) from a single product input.
-   **AI Orchestration:** LLM-driven transformation of "Selling Points" into structured `inputProps` for rendering.
-   **Hybrid Rendering:** Combination of Deterministic (Remotion/Three.js) and Generative (Fal.ai) pipelines.
-   **Dynamic Prop Editor:** "Designer-in-a-box" experience allowing text/prop modification without timeline editing.
-   **Responsive Output:** Single composition definitions adapting to 1:1 and 9:16 aspect ratios.

**Non-Functional Requirements:**
-   **Performance:** < 60s total turnaround for a 10-asset batch.
-   **Extensibility:** New "Styles" and "Camera Paths" must be pluggable without core refactoring.
-   **Aesthetics:** "Apple-style" premium quality with strict layout safety (Social Safe Areas).
-   **Reliability:** 99.5% success rate on stateless Lambda renders.

**Scale & Complexity:**
-   **Primary Domain:** Event-Driven Serverless Architecture.
-   **Complexity Level:** High. Requires robust handling of async jobs, race conditions, and external API dependencies.
-   **Estimated Components:** Orchestrator, Render Worker, Asset Manager, API Layer, Client UI.

### Technical Constraints & Dependencies
-   **Dependency Latency:** Fal.ai and OpenRouter response times are outside our direct control; the system must be resilient to their variance.
-   **Lambda Limitations:** Memory and Timeout constraints for heavy WebGL/Three.js rendering tasks.
-   **Network Overhead:** High bandwidth usage for transferring generated video/image assets between services.

### Cross-Cutting Concerns Identified
-   **Deep Decoupling:** Ensuring the *Renderer* knows nothing about the *Business Logic*, and the *AI* knows nothing about the *React Components*.
-   **Observability:** Tracing the lifecycle of a "Generation Job" across multiple async steps (LLM -> Fal -> Remotion -> Storage).
-   **Design Token Sharing:** Ensuring colors, fonts, and spacing are consistent between the Next.js UI and the Remotion Video output.

### Modular Engine Architecture Decisions

**1. The Interface Contract: "Design Adapter" Pattern**
To decouple the LLM from technical implementation, we introduce a **"Design Adapter"** layer.
*   **Layer 1: Semantic Intent (LLM Output)**
    *   The LLM outputs high-level "Creative Directions" (e.g., `{ "vibe": "luxury_minimal" }`).
*   **Layer 2: The Design Adapter (Logic Layer)**
    *   Translates "Semantic Keys" into "Technical Tokens" (e.g., `luxury_minimal` -> `{ font: "Bodoni", glassmorphism: true }`).
*   **Layer 3: Technical Props (Remotion Input)**
    *   The final resolved JSON passed to the React component.
*   **Override Priority:** User manual edits (text/color) must bypass the Semantic Intent mapping and be injected directly into the final Technical Props, ensuring the "Designer-in-a-box" flexibility.

**2. The Diversity Loop: "Style Hashing" & Deduplication**
*   **Orchestrator Responsibility:** The Orchestrator manages diversity, not the LLM.
*   **Style Hashing:** Computes a hash for each candidate (e.g., `hash(Angle + BackgroundType + ColorTheme)`).
*   **Deduplication:** Compares hashes against the `GenerationHistory` table to select the top 10 *least similar* candidates, preventing "template fatigue".

**3. Parallel Execution & Pre-Generation Pipeline**
*   **Pre-Generation:** Fal.ai background generation occurs *before* Lambda rendering. Lambdas receive final background URLs to minimize execution time and cost.
*   **Fan-Out:** The API creates 10 `Job` records and immediately fires 10 **Async Lambda Invocations** simultaneously.
*   **Realtime Streaming:** The UI subscribes to `postgres_changes` on the `jobs` table via Supabase Realtime to update progress bars instantly without polling.

## Starter Template Evaluation

### Primary Technology Domain
**Full-Stack Web + Video Infrastructure** (Next.js + Supabase + Remotion)

### Starter Options Considered
-   **Option 1: Makerkit (SaaS Starter):** Good for SaaS features, but too opinionated/bloated for custom engine logic. High risk of fighting the framework.
-   **Option 2: Remotion SaaS Starter:** Good for video, but often lags on Next.js/App Router features. Weak on DB/Auth integration.
-   **Option 3: Custom Scaffolding (Create Next App):** Maximum control. Allows perfect implementation of "Modular Engine" architecture from day one.

### Selected Starter: Custom Next.js App Router

**Rationale for Selection:**
Selected **Option 3 (Custom)** to ensure a "Hyper-Malleable" architecture. The "Modular Engine" requires deep decoupling (separate `/engine` vs `/app` directories) that standardized starters often violate. We prioritize architectural purity over initial setup speed to guarantee the "Design Adapter" pattern can be implemented without compromise.

**Initialization Command:**
```bash
npx create-next-app@latest crea-ads --typescript --tailwind --eslint
# Followed by manual setup of:
# npm install @supabase/ssr @supabase/supabase-js
# npx remotion install
```

**Architectural Decisions Provided:**
-   **Language:** TypeScript (Strict)
-   **Styling:** Tailwind CSS (v4 if available, else v3.4+)
-   **State/Query:** TanStack Query (standard for Supabase)
-   **State/Query:** TanStack Query (standard for Supabase)
-   **Video Engine:** Remotion Lambda

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
-   **Folder Structure Strategy:** Enforcing separation of concerns between Next.js UI (`/app`) and Remotion Logic (`/engine`).
-   **Data Schema:** Defining the relational model for Batches and Jobs to support Realtime tracking.
-   **Interface Contract:** Defining the TypeScript types for the "Design Adapter" pattern.

### 1. Folder Structure Strategy
**Decision:** Adopt a `src` root with strict separation between "Application" and "Engine".

```text
/
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js App Router (UI Layer)
│   │   ├── (dashboard)/    # Authenticated routes
│   │   ├── api/            # API Routes (Webhooks, Triggers)
│   │   └── page.tsx        # Landing page
│   ├── components/         # Shared UI Components (shadcn/ui)
│   ├── engine/             # REMOTION ROOT (The "Modular Engine")
│   │   ├── compositions/   # Video Templates (The "Creative Logic")
│   │   │   ├── HyperStomp/
│   │   │   └── ZenFlow/
│   │   ├── schema/         # Zod Schemas for Input Props
│   │   └── Root.tsx        # Remotion Entry Point
│   ├── lib/
│   │   ├── adapter/        # DESIGN ADAPTER (Logic Layer)
│   │   │   ├── mappings/   # Semantic -> Technical maps
│   │   │   └── types.ts    # Interface Definitions
│   │   ├── supabase/       # Supabase Client & Server helpers
│   │   └── ai/             # OpenRouter & Fal.ai clients
```

**Rationale:**
Moving Remotion logic into `src/engine` (instead of the default root `/remotion`) signals that it is a sub-system of the larger application, while keeping it distinct from `src/app` (Next.js routing).

### 2. Data Architecture (Supabase Schema)
**Decision:** Relational model with Realtime enabled for Job tracking.

**Schema Definitions:**

```sql
-- 1. Batches: Represents a user's request to generate assets
create table batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  project_name text not null,
  input_data jsonb not null, -- The original product data/selling points
  created_at timestamptz default now()
);

-- 2. Jobs: Individual asset generation tasks (1 Batch = 10 Jobs)
create table jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches not null,
  status text check (status in ('pending', 'generating_assets', 'rendering', 'uploading', 'done', 'failed')),
  type text check (type in ('video', 'image')),
  template_id text not null, -- ID of the Remotion composition used
  result_url text, -- Final S3/Storage URL
  error_message text,
  metadata jsonb, -- Stores specific props used for this render
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Generation History: For Diversity Logic Deduplication
create table generation_history (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches not null,
  style_hash text not null, -- hash(angle + background + color)
  created_at timestamptz default now()
);

-- CRITICAL: Enable Realtime for Progress Tracking
alter publication supabase_realtime add table jobs;
alter table jobs replica identity full; -- Required for extracting 'old' vs 'new' states
```

### 3. Design Adapter Scaffold
**Decision:** TypeScript Interfaces for the "Semantic to Technical" pipeline.

```typescript
// src/lib/adapter/types.ts

// 1. Semantic Intent (What the LLM outputs)
export interface CreativeIntent {
  visualStyle: 'luxury_minimal' | 'high_energy_sport' | 'organic_warmth';
  cameraMotion: 'orbit_center' | 'pan_horizontal' | 'static_hero';
  colorMood: 'sunset' | 'midnight' | 'studio_white';
  emphasis: 'product_detail' | 'typography_heavy';
}

// 2. Technical Props (What Remotion needs)
export interface RemotionProps {
  // Appearance
  primaryColor: string; // Hex
  fontFamily: string;
  glassmorphismIntensity: number; // 0-1
  
  // Camera
  cameraZoomStart: number;
  cameraZoomEnd: number;
  orbitSpeed: number;
  
  // Content
  headlineText: string;
  productImageUrl: string;
  backgroundImageUrl: string;
}

// 3. The Adapter Function Signature
export type ResolveDesignFn = (
  intent: CreativeIntent, 
  overrides?: Partial<RemotionProps>
) => RemotionProps;
```

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
-   **Validation Strategy:** Ensuring UI inputs match Video Engine constraints.
-   **Error Handling:** Managing async failures across 3 services (Next.js, AWS Lambda, Fal.ai).
-   **Naming Conventions:** Distinguishing between "Business Logic" and "Creative Logic".

### 1. Validation Patterns (The "Shared Schema" Rule)
**Decision:** All input validation MUST use Shared Zod Schemas located in `src/engine/schema`.

```typescript
// src/engine/schema/product.ts
export const ProductSchema = z.object({
  headline: z.string().max(40, "Headline too long for video"),
  // ... other props
});

// Usage 1: Next.js API (Validation before save)
// Usage 2: Remotion Root (Validation before render)
// Usage 3: UI Forms (Real-time feedback)
```
**Constraint:** `src/app` imports from `src/engine`, NEVER vice-versa.

### 2. Error Handling Patterns

**Global Error Strategy:**
-   **UI Layer:** React Error Boundaries for synchronous crashes.
-   **Async/API Layer:** A standardized `Result<T, E>` pattern or custom `AppError` class.

**External Service Failures (Lambda/Fal.ai):**
-   **Timeout/Crash:** Caught by the Orchestrator, marked as `failed` in DB, and exposed to UI via Realtime (not a 500 error page).
-   **Logic:**
    1.  **Retry Policy:** Exponential backoff (max 3 attempts) for network timeouts (Fal.ai).
    2.  **Circuit Breaker:** Stop batch if >30% of jobs fail.
    3.  **User Feedback:** "Asset 3 failed to render. [Retry Asset]" button in Dashboard.

### 3. Naming Patterns

**Core Conventions:**

| Concept | Pattern | Example |
| :--- | :--- | :--- |
| **Databases** | `snake_case` | `generation_history`, `user_id` |
| **API Components** | `camelCase` | `createBatch`, `getUser` |
| **React Components** | `PascalCase` | `VideoPlayer`, `AssetCard` |
| **Remotion Compositions** | `PascalCase` | `HyperStomp`, `ZenFlow` |
| **Design Intent** | `camelCase` | `luxuryMinimal`, `orbitCenter` |
| **Zod Schemas** | `PascalCase` suffix | `ProductSchema`, `JobSchema` |

**Specific "Modular Engine" Rules:**
-   **Compositions:** Must be named after their *Creative Concept*, not their technical attributes (e.g., `BangerAds` not `RedFastVideo`).
-   **Props:** Technical props passed to Remotion must match the CSS/Style naming conventions (e.g., `primaryColor`, `fontFamily`).

### 4. Communication Patterns

**Event System (Realtime):**
-   **Channel:** `jobs` (Table-level changes)
-   **Event:** `UPDATE`
-   **Payload:** Full Row (enabled by `REPLICA IDENTITY FULL`)
-   **UI Handler:** `useSubscription` hook updates local React Query cache.

### Enforcement Guidelines

**All AI Agents MUST:**
1.  **NEVER** hardcode validation logic in UI components; import the Zod Schema from `/engine`.
2.  **ALWAYS** use `try/catch` blocks around Fal.ai/Lambda calls and map errors to the `AppError` types.
3.  **STRICTLY** follow the `src/engine` vs `src/app` boundary. Engine components cannot import from App.

export type ResolveDesignFn = (
  intent: CreativeIntent, 
  overrides?: Partial<RemotionProps>
) => RemotionProps;
```



