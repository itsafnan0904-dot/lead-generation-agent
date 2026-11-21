# MASTER UI/UX DESIGN DIRECTION V2 — AI SALES AGENT

> **AUTHORITATIVE LIVING DESIGN SYSTEM SPECIFICATION**  
> **Status**: AUTHORITATIVE & ACTIVE (Supersedes `docs/DESIGN_SYSTEM.md` for all new and revised frontend work).  
> **Design Foundation**: Emil Kowalski Design Engineering Principles (`emilkowalski/skills`), Minimalist Craft, Tactile Responsiveness, Invisible Details, Perceived Performance, and Intentional Motion.  
> **Historical Note**: `docs/DESIGN_SYSTEM.md` remains preserved for historical reference only. All future screen redesigns (Overview, Leads, Companies, Conversations, Agent Activity, Notifications, Gmail, Settings) and new frontend code MUST adhere strictly to this V2 specification.

> **UI refresh (current look)**: surfaces are now navy (`#0d0e1b` canvas, `#151628` cards) with one purple accent (`#7c6ee0`), Plus Jakarta Sans, 14px card radius, and the shared `.card`, `.hero`, `.pill`, `.tbl` classes in `apps/web/src/app/globals.css`. Where this note differs from the colour values below, this note wins.

---

## 1. Product Framing: The AI Employee Control Center

This application is an **Autonomous AI Sales Agent Command Center**. Human operators use this interface to oversee, direct, audit, and collaborate with autonomous AI agents that handle outbound research, lead qualification, multi-channel outreach, and pipeline progression.

Every interface component and screen must answer three operator questions with zero ambiguity:
1. **What is the AI currently doing?** (Operational visibility & live status)
2. **What requires human attention or decision?** (Action prioritization & oversight)
3. **What is the immediate next step to drive business pipeline?** (Self-guiding workflow)

---

## 2. Core Philosophy & Craft Principles (Derived from Emil Kowalski)

### A. Taste is Trained, Not Innate
Good taste is not subjective decoration; it is a trained instinct for recognizing what elevates software. We reject generic templates, bloated frameworks, and lazy defaults. Every element, spacing step, border hairline, and interaction must feel intentional.

### B. Unseen Details Compound
Users rarely consciously notice small craft decisions—a 160ms button press scale, a 1px hairline border, optical letter-spacing, or an origin-aware popover. But in aggregate, these invisible details combine to produce an experience that feels remarkably fluid, trustworthy, and high-grade ("like a thousand barely audible voices all singing in tune" — Paul Graham).

### C. Beauty is Leverage
Software utility is table stakes. When functionality is equal, operators and teams gravitate toward tools with exceptional craft, crisp responsiveness, and refined aesthetics. Visual elegance and mechanical fluidity are competitive leverage.

### D. Extreme Restraint & Visual Discipline
- **NO Heavy Glassmorphism or Muddy Blurs**: Background blurs that obscure typography and create fuzzy halos are prohibited.
- **NO Rainbow Gradients or Neon Glow Blobs**: Color must serve a purpose, not fill space.
- **NO Gratuitous Motion**: Animations must never exist purely because they "look cool." If an action is repeated frequently, motion is eliminated or reduced to near-imperceptible durations.
- **NO Toy-Like Rounded Corners or Bloated Padding**: Interfaces must feel crisp, dense, and professional.

---

## 3. The Animation & Interaction Framework

Every interactive element and motion decision in this application must follow Emil Kowalski's Animation Decision Sequence:

### 1. Frequency Gating: Should this animate at all?

| Action Frequency | Rule | Applied UI Context |
| :--- | :--- | :--- |
| **100+ times/day** | **NO animation. Ever.** | Keyboard shortcuts, row selection, rapid data entry, quick filters |
| **Tens of times/day** | **Near-imperceptible (100–160ms)** | Button press states, input focus, row hover highlights |
| **Occasional** | **Standard crisp animation (150–250ms)** | Modals, drawers, dropdowns, popovers, toast notifications |
| **Rare / First-Time** | **Delight allowed (250–400ms max)** | Successful onboarding, critical milestone confirmations |

> **Hard Rule**: Never animate keyboard-initiated actions. Keyboard commands demand immediate, zero-latency response.

### 2. Purpose Requirement
Every animation must have a named functional purpose:
- **Feedback**: Confirming the system received user input (e.g., button scale down on press).
- **Spatial Consistency**: Showing where an element came from or went (e.g., origin-aware dropdown).
- **State Indication**: Making an AI state transition legible (e.g., AI active $\leftrightarrow$ paused).
- **Preventing Jarring Change**: Bridging asynchronous data updates smoothly without layout jump.

### 3. Custom Easing Standards
Built-in CSS easings (`ease-in`, generic `ease-out`) lack the precision needed for high-craft UI. Never use `ease-in` for UI animations (it delays initial movement when the user is watching most closely).

```css
/* Custom Curated Easing Curves */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* Strong ease-out for UI interactions & entrances */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* Strong ease-in-out for on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* Physical drawer / sheet curve */
```

### 4. Duration & Perceived Speed
All UI animations must remain strictly under **300ms**:
- **Button Press Feedback**: `100ms – 160ms`
- **Tooltips & Micro-Popovers**: `125ms – 200ms`
- **Dropdowns & Select Menus**: `150ms – 250ms`
- **Modals & Dialog Surfaces**: `200ms – 250ms`
- **Loading Spinners**: Fast rotation (`0.6s – 0.8s` linear) to enhance perceived system speed.

### 5. Hardware Acceleration & Property Constraints
- Animate **ONLY `transform` and `opacity`** (which run on the GPU and skip layout and paint phases).
- **Never animate from `scale(0)`**: Nothing in the physical world emerges from nothing. Start from `scale(0.95)` with `opacity: 0`.
- **Origin-Aware Popovers**: Dropdowns and popovers must set `transform-origin: var(--transform-origin)` anchored to their trigger element (modals are exempt and remain centered).
- **Button Tactile Feedback**: All buttons must implement `transform: scale(0.97)` on `:active` with `160ms var(--ease-out)`.

### 6. Accessibility & Media Gating
Every animation must ship with reduced motion and pointer gating:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

@media (hover: hover) and (pointer: fine) {
  /* Hover effects only applied to precise pointer devices */
}
```

---

## 4. Concrete Design Tokens Specification

### A. Dark Surface Palette (Restrained, Technical, High-Contrast)
```css
:root {
  /* Canvas & Background Surfaces */
  --bg-canvas: #090a0f;              /* Deep matte obsidian canvas */
  --bg-surface: #111318;             /* Primary container & card surface */
  --bg-surface-subtle: #161820;      /* Secondary panels, table headers, inputs */
  --bg-surface-elevated: #1c1f2a;    /* Modals, popovers, dropdown menus */
  --bg-surface-hover: #1f2330;       /* Interactive element hover surface */

  /* Hairlines & Structural Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);   /* Structural grids, inner dividers */
  --border-default: rgba(255, 255, 255, 0.10);  /* Card borders, input outlines */
  --border-strong: rgba(255, 255, 255, 0.18);   /* Active borders, hover states */
  --border-focus: #535bf2;                      /* High-clarity focus ring */

  /* Typography Colors */
  --text-primary: #f3f4f6;           /* Crisp primary text, headings, data */
  --text-secondary: #9ca3af;         /* Supporting labels, descriptions */
  --text-muted: #64748b;             /* Timestamps, subtle metadata, placeholders */
  --text-inverse: #ffffff;           /* Text on solid accent backgrounds */

  /* Functional & Semantic Accents */
  --accent-primary: #4f46e5;         /* Primary Indigo Action */
  --accent-primary-hover: #4338ca;   /* Primary Hover State */
  --accent-primary-light: #818cf8;   /* Primary Highlight */
  --accent-primary-muted: rgba(79, 70, 229, 0.12); /* Subtle badge background */

  --accent-success: #10b981;         /* AI Active / Success Emerald */
  --accent-success-muted: rgba(16, 185, 129, 0.12);

  --accent-warning: #f59e0b;         /* Human Review / Caution Amber */
  --accent-warning-muted: rgba(245, 158, 11, 0.12);

  --accent-danger: #f43f5e;          /* Restriction / Error Rose */
  --accent-danger-muted: rgba(244, 63, 94, 0.12);

  --accent-info: #0ea5e9;            /* Enriched / Investigation Sky */
  --accent-info-muted: rgba(14, 165, 233, 0.12);

  /* Geometry & Corner Radii */
  --radius-xs: 4px;                  /* Tiny badges, tags */
  --radius-sm: 6px;                  /* Inputs, standard buttons */
  --radius-md: 10px;                 /* Cards, surface panels */
  --radius-lg: 14px;                 /* Modals, floating sheets */
  --radius-full: 9999px;             /* Status pills, circular avatars */

  /* Shadows & Elevation (Crisp Hairline + Soft Depth) */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.4);
  --shadow-card: 0 4px 16px -2px rgba(0, 0, 0, 0.5), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 12px 32px -4px rgba(0, 0, 0, 0.7), 0 4px 8px -2px rgba(0, 0, 0, 0.4);

  /* Motion & Easing Tokens */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --duration-fast: 120ms;
  --duration-normal: 180ms;
  --duration-modal: 240ms;
}
```

### B. Typography Scale & Optical Hierarchy
The font stack relies on high-quality system sans-serif fonts with optical letter-spacing to prevent loose text rendering:

- **Primary Font Stack**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`
- **Monospace Stack**: `ui-monospace, "SF Mono", "Menlo", "Consolas", monospace`

| Level | Size | Weight | Line Height | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Title / H1** | `20px` (`1.25rem`) | `600` | `1.25` | `-0.025em` | Page header, login title |
| **Section Heading / H2**| `16px` (`1.0rem`)  | `600` | `1.3`  | `-0.015em` | Card section titles |
| **Card Heading / H3**   | `14px` (`0.875rem`)| `600` | `1.4`  | `-0.01em`  | Sub-panels, list section headers |
| **Body Regular**        | `13.5px` (`0.84375rem`) | `400` | `1.5` | `normal` | Main narrative text, lead info |
| **Body Medium / Control**| `13.5px` (`0.84375rem`) | `500` | `1.4` | `-0.005em` | Form inputs, button labels |
| **Label / Subtext**     | `12.5px` (`0.78125rem`) | `500` | `1.4` | `normal`   | Field labels, metadata labels |
| **Caption / Meta**      | `11.5px` (`0.71875rem`) | `500` | `1.35`| `0.01em`   | Timestamps, helper footnotes |
| **Status Badge**        | `11px` (`0.6875rem`) | `600` | `1.2`  | `0.05em`   | Uppercase operational pill |

---

## 5. Component Patterns & Craft Guidelines

### A. Buttons & Interactive Controls
- **Tactile Active Press**: Every button must scale to `0.97` on active press with `transition: transform 140ms var(--ease-out)`.
- **Clear State Transitions**:
  - Hover: Subtle background luminosity shift (`var(--accent-primary-hover)` or `rgba(255, 255, 255, 0.06)`).
  - Focus-visible: 2px offset focus ring using `var(--border-focus)`.
  - Loading: Replaces text with a fast-spinning indicator (`0.6s` spin) alongside descriptive state label (`Authenticating...`).
  - Disabled: Reduced opacity (`0.5`), cursor not-allowed, no hover/press transitions.

### B. Form Inputs & Text Fields
- Clean surface fill (`var(--bg-surface-subtle)`) with 1px hairline border (`var(--border-default)`).
- On `:focus`, instant 1px border highlight (`var(--border-focus)`) with a subtle 2px glow ring (`rgba(83, 91, 242, 0.2)`).
- Input padding: `10px 12px` for compact, comfortable optical alignment.
- Always retain entered values upon submission failure (never silently wipe user inputs).

### C. Alerts & Inline Feedback
- Structured containers with restrained tint background (`rgba(244, 63, 94, 0.10)`), clean border (`rgba(244, 63, 94, 0.25)`), and crisp icon alignment.
- Error text must be specific, actionable, and non-jarring.

### D. Operational Status Badges
- Compact pills with a solid 6px indicator dot and uppercase label:
  - `RUNNING`: Green dot + "Autonomous Active"
  - `REVIEW_REQUIRED`: Amber pulsing dot + "Action Required"
  - `PAUSED`: Amber static dot + "AI Paused"
  - `RESTRICTED`: Red dot + "Policy Restricted"
  - `HUMAN_TAKEOVER`: Indigo dot + "Human Controlled"

---

## 6. Login Page as the Design Anchor

The Login page (`apps/web/src/app/login/page.tsx`) serves as the physical proof-of-concept for Design System V2:
1. **Canvas**: Clean obsidian canvas (`#090a0f`) with subtle, optical top vignette (`rgba(79, 70, 229, 0.04)`).
2. **Container**: Centralized card (`maxWidth: 390px`), surface background `#111318`, 1px hairline border `rgba(255, 255, 255, 0.08)`, subtle depth shadow (`var(--shadow-card)`).
3. **Typography**: Refined display header with subtle technical glyph, optical subtitle (`Sign in to access your autonomous sales control center`).
4. **Interactive Controls**:
   - Dual-path submission (`form onSubmit` + `button onClick`) preserved for 100% regression safety.
   - Enter key event handler preserved.
   - High-perceived-speed spinner (`0.6s linear infinite`) during submission.
   - Button tactile press scale `0.97` on `:active`.
5. **Inline Error Handling**: Non-clearing, visible error container with clear contrast and structured layout.

---

## 7. Multi-Phase Screen Redesign Roadmap

Following this established anchor, screens will be migrated sequentially in separate tasks:
1. **Phase 1 (Current)**: Authoritative Design System V2 + Login Page Anchor.
2. **Phase 2**: Overview Dashboard (Operator Pulse, Action Queue, Pipeline Velocity, Autonomous Activity Stream).
3. **Phase 3**: Leads Operational Workspace (Lifecycle Progression, Score, Filter Matrix).
4. **Phase 4**: Companies & Research (Autonomous Enrichment & Intel Logs).
5. **Phase 5**: Conversations & Multi-Channel Outreach (AI vs Human Thread Distinction).
6. **Phase 6**: Agent Activity & Governance (Execution Audit Stream, Guardrails, Override Controls).
7. **Phase 7**: Notifications, Gmail Integration, and System Settings.
