# MASTER UI/UX DESIGN DIRECTION — AI SALES AGENT (AI EMPLOYEE DASHBOARD)

> **Living Reference Document**  
> Authoritative UI/UX Design System, Principles, Component Guidelines, and Architectural Rules for the AI Sales Agent Dashboard. All frontend screen implementations and redesigns must strictly comply with this document.

---

## 1. Product Framing: The AI Employee Control Center
This product is not an administrative database, generic CRM, or passive metrics viewer. It is an **AI Employee Control Center** — the cockpit where human operators monitor, collaborate with, guide, and govern autonomous AI sales agents executing outbound prospecting, inbound qualification, company research, and enterprise lead enrichment.

Every screen must answer three core operator questions:
1. **What is the AI currently doing?** (Operational visibility)
2. **What requires human attention or decision?** (Action prioritization)
3. **What is the immediate next step to drive business pipeline?** (Self-guiding workflow)

---

## 2. Core Design Philosophy & Visual Direction
- **Inspiration**: Linear, Vercel, and Stripe dashboard discipline — technical elegance, precise alignment, functional density, and typographic hierarchy.
- **Mood**: Sleek, dark, technical, highly refined, purposeful, and confidence-inspiring.
- **Explicit Rejections**:
  - NO excessive gradient blobs or rainbow color shifts.
  - NO heavy, blurry glassmorphism that obscures text readability.
  - NO neon glows, outer bloom halos, or visual noise.
  - NO decorative animations or gratuitous motion.
  - NO giant rounded "toy-like" corners or bloated padding.
- **Foundational Formula**:
  $$\text{Clarity} \longrightarrow \text{Hierarchy} \longrightarrow \text{Guidance} \longrightarrow \text{Consistency} \longrightarrow \text{Functionality} \longrightarrow \text{Aesthetics}$$
  *A visually ornate interface that confuses the operator is a complete failure.*

---

## 3. Visual Hierarchy & Surface Architecture
1. **Primary Information**: Highest contrast (`#f9fafb`), medium-to-bold weights, prioritized at eye level.
2. **Secondary Information**: Subdued contrast (`#9ca3af` / `#6b7280`), regular weights, supporting context.
3. **Primary Action**: Unambiguous, high-contrast, singular solid fill (`#6366f1` / `#4f46e5`).
4. **Secondary Actions**: Restrained outlines or ghost treatments (`rgba(255,255,255,0.04)` with subtle border).
5. **Dangerous / Irreversible Actions**: Clearly segregated with warning/destructive semantics (`#f43f5e`), requiring explicit confirmation modal/popover.
6. **Surfaces & Borders**:
   - Deep matte neutral background (`#0b0f19`).
   - Precise card and panel layers (`#111827`, `#182234`).
   - Clean 1px hairline borders (`rgba(255, 255, 255, 0.08)` to `rgba(255, 255, 255, 0.12)`).
   - Crisp elevation through hairline geometry and subtle dark drops, never fuzzy glows.

---

## 4. Design Tokens Specification

### A. Dark Neutral Palette
- `bg-canvas`: `#0b0f19` (Deep background canvas)
- `bg-surface-primary`: `#111827` (Card / primary container surface)
- `bg-surface-secondary`: `#161f30` (Nested cards, tables, headers)
- `bg-surface-elevated`: `#1e293b` (Dropdowns, modals, popovers)
- `border-subtle`: `rgba(255, 255, 255, 0.07)` (Separators, structural grid)
- `border-default`: `rgba(255, 255, 255, 0.12)` (Card borders, table bounds)
- `border-strong`: `rgba(255, 255, 255, 0.20)` (Hover states, active card bounds)
- `border-focus`: `#6366f1` (Active input focus ring with 2px 20% alpha glow)

### B. Typography Scale
- **Font Stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`
- **Monospace Stack**: `ui-monospace, "SF Mono", "Menlo", "Consolas", monospace`
- **Display / H1**: `24px` (`1.5rem`), weight `700`, line-height `1.2`, tracking `-0.025em`
- **Section Heading / H2**: `18px` (`1.125rem`), weight `600`, line-height `1.3`, tracking `-0.015em`
- **Card Heading / H3**: `15px` (`0.9375rem`), weight `600`, line-height `1.4`, tracking `-0.01em`
- **Body Regular**: `14px` (`0.875rem`), weight `400`, line-height `1.5`
- **Body Medium**: `14px` (`0.875rem`), weight `500`, line-height `1.5`
- **Label / Subtitle**: `13px` (`0.8125rem`), weight `500`, line-height `1.4`
- **Caption / Meta**: `12px` (`0.75rem`), weight `500`, line-height `1.33`, tracking `0.02em`
- **Overline / Badge Text**: `11px` (`0.6875rem`), weight `600`, tracking `0.06em`, uppercase

### C. Text Color Hierarchy
- `text-primary`: `#f9fafb` (Headings, active values, primary copy)
- `text-secondary`: `#9ca3af` (Descriptions, field labels, metadata)
- `text-muted`: `#6b7280` (Timestamps, placeholders, inactive states)
- `text-inverse`: `#ffffff` (High-contrast text on solid color buttons)

### D. Semantic Status & Accent Colors
*Colors must always be paired with text labels or iconography — never color alone as the single signal.*
- **Primary / Action**: `#6366f1` (Indigo), Hover: `#4f46e5`, Light: `#818cf8`
- **Success / Active**: `#10b981` (Emerald), Light: `#34d399`, Dark/Bg: `rgba(16, 185, 129, 0.12)`
- **Warning / Review Needed**: `#f59e0b` (Amber), Light: `#fbbf24`, Dark/Bg: `rgba(245, 158, 11, 0.12)`
- **Destructive / Error / Restricted**: `#f43f5e` (Rose), Light: `#fb7185`, Dark/Bg: `rgba(244, 63, 94, 0.12)`
- **Informational / Research**: `#0ea5e9` (Sky), Light: `#38bdf8`, Dark/Bg: `rgba(14, 165, 233, 0.12)`

### E. Spacing & Radius Rhythm
- **Spacing Steps**: `4px` (`xxs`), `8px` (`xs`), `12px` (`sm`), `16px` (`md`), `24px` (`lg`), `32px` (`xl`), `48px` (`2xl`)
- **Corner Radii**:
  - Inputs / Buttons: `6px` (`radius-sm`)
  - Cards / Tables / Modals: `10px` (`radius-md`)
  - Overlays / Large Dialogs: `12px` (`radius-lg`)
  - Badges / Pills: `9999px` (`radius-full`)
- **Transitions**: `150ms cubic-bezier(0.4, 0, 0.2, 1)` for subtle interactive states.

---

## 5. Screen-by-Screen Guidelines

### 5.1 Overview: The Operator Command Center
- Must not be a disconnected metrics dump.
- **Top Section**: Immediate Pulse ("AI is Active: 42 leads in progress, 3 items require human review").
- **Core Panels**:
  1. *Action Queue*: Pending human reviews, restrictions flagged, failed deliveries.
  2. *Pipeline Velocity*: Outreach sent vs replies received vs qualified opportunities.
  3. *Recent Autonomous Activity*: Real-time audit stream of AI decisions and scoring events.

### 5.2 Leads Operational Workspace
- Communicates the full lifecycle progression:
  $$\text{Company} \longrightarrow \text{Contact} \longrightarrow \text{Research} \longrightarrow \text{Score} \longrightarrow \text{Restriction Check} \longrightarrow \text{Outreach Draft} \longrightarrow \text{Conversation} \longrightarrow \text{Qualification} \longrightarrow \text{Opportunity}$$
- Quick filters for high-intent leads, pending reviews, and paused states.

### 5.3 Companies & Research
- Framed as intentional AI investigation actions with clear progress steps: `IDLE` $\rightarrow$ `RESEARCHING (Extracting tech stack, news, signals)` $\rightarrow$ `ENRICHED`.

### 5.4 Conversations & Outreach
- Clear visual distinction between AI-generated messages (indicated with subtle AI badge + timestamp) and human operator messages.
- Prominent indication of thread state: `AI_HANDLING`, `WAITING_FOR_REPLY`, or `HUMAN_TAKEOVER`.

### 5.5 AI Operational State Indicators
- `RUNNING`: Green indicator dot + "Autonomous Active"
- `PAUSED`: Amber indicator dot + "AI Paused"
- `HUMAN_TAKEOVER`: Indigo indicator dot + "Human Controlled"
- `REVIEW_REQUIRED`: Pulsing Amber indicator dot + "Action Required"

### 5.6 Human Oversight & Governance Controls
- **Pause AI / Resume AI**: Immediate toggle with explicit feedback.
- **Take Over Thread**: Instant transfer of conversation ownership to human operator.
- **Approve / Reject Draft**: Side-by-side inspection before external transmission.
- **Resolve Review**: Clear reason capture and audit logging.

### 5.7 Restriction States & Plain-Language Explanations
- `CLEAR`: Unrestricted outbound permitted.
- `HUMAN_REVIEW`: Outreach requires manager clearance (plain-language reason shown, e.g. "Do-Not-Contact domain match").
- `RESTRICTED`: Outbound blocked by policy (e.g. "Active Customer / Existing Contract").

### 5.8 Notifications & Action Routing
- Direct deep links to resolve items rather than passive alert lists.
- Grouping by priority: `ACTION_REQUIRED`, `RESTRICTION_FLAGGED`, `SYSTEM_NOTICE`.

---

## 6. Login Page as the Design Anchor (Section 21)
The login screen serves as the initial anchor proving the design tokens in practice:
- **Canvas**: Centered card layout on `#0b0f19` with a subtle top directional vignette (no distracting shapes).
- **Container**: Card with `#111827` base, hairline border `rgba(255, 255, 255, 0.08)`, and `10px` radius.
- **Typography**: Clean display title `AI Sales Agent` with crisp subtitle `Sign in to access your enterprise dashboard`.
- **Inputs**: Dark inputs `#161f30` with `1px` subtle borders, clear `13px` labels `#9ca3af`, and sharp focus rings `#6366f1`.
- **Primary Action**: Full-width high-contrast solid button with clear active/loading feedback (`Authenticating...`).
- **Error Feedback**: Inline alert container with precise border and clear text message (no screen flash or silent clear).
- **Keyboard Access**: Enter key triggers submit without page reload; full tab sequence preserved.

---

## 7. Ten-Point Screen Quality Bar (Section 22)
Every screen redesign must pass these 10 criteria before completion:
1. **Purpose Clarity**: Can a new operator immediately understand the screen's role?
2. **Signal-to-Noise**: Can the operator spot what matters within 3 seconds?
3. **Attention Flagging**: Are items needing human intervention highlighted with clear urgency?
4. **Next Action Guidance**: Does the interface guide the operator on what step to take next?
5. **Primary Action Salience**: Is the primary action distinct from all secondary actions?
6. **Destructive Action Safety**: Are irreversible or dangerous actions isolated with safeguards?
7. **State Completeness**: Are Loading, Empty, Error, and Populated states fully designed?
8. **Cohesive Product Identity**: Does the screen look and feel like part of the unified system?
9. **Refined Technical Polish**: Does the screen feel like a professional, high-grade developer/operator tool?
10. **AI/Human Clarity**: Is the boundary between AI autonomous work and human governance explicit?

---

## 8. Frontend Engineering Constraints
- **Framework**: Next.js App Router (Server Components for data fetching, Client Components for interactive controls).
- **UI Library**: Material UI v9 (`@mui/material` 9.4.0) customized via theme overrides and CSS tokens.
- **Preservation**: All API endpoints, auth mechanisms, cookie flows, business validation, and audit tracking must remain 100% intact.
