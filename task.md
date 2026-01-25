# Phase 4.4 – Non-Functional Scope Execution Prompt

You are a **senior frontend + platform engineer** implementing **Phase 4.4: Non-Functional Requirements** for a **Next.js (App Router) web-based code editor**.

This phase focuses on **responsiveness, performance, and safety limits** without introducing new product features.

Follow all existing architectural constraints strictly.

---

## 🎯 PHASE GOAL

Harden the editor so that it:
- Works well across screen sizes
- Loads fast and predictably
- Enforces AI token usage limits to prevent abuse

No new editor features should be introduced.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Responsive UI

### Requirements
- Editor layout must adapt to:
  - Desktop
  - Tablet
  - Small laptop screens
- Core areas:
  - File explorer
  - Editor panes
  - AI chat panel

### Behavior
- Side panels must be collapsible
- Editor always retains usable minimum width
- Split views must stack or collapse on small screens

### Constraints
- No new design system
- No pixel-perfect polish
- Functional responsiveness only

---

## 2️⃣ Fast Editor Load

### Requirements
Optimize initial load so:
- Editor shell renders immediately
- Monaco loads lazily
- Heavy modules are code-split

### Implementation Rules
- Use dynamic imports for:
  - Monaco editor
  - AI chat panel
- Avoid blocking server components
- Defer non-critical JS

### Performance Targets (Soft)
- First meaningful paint < 2s (dev environment)
- Monaco loaded only when editor is visible

---

## 3️⃣ Token Usage Limits (AI Safety)

### Scope
Introduce **basic token usage controls** for AI chat to prevent runaway costs and abuse.

### Rules
- Hard per-request token cap
- Hard per-session token cap
- Graceful failure when limits are exceeded

### Behavior
- UI shows:
  - “Token limit reached” message
- No retries
- No partial responses beyond limit

### Technical Notes
- Token limits enforced server-side
- Client must not be trusted
- Limits should be configurable via env variables

---

## 🧠 ARCHITECTURAL RULES

- No business logic in UI components
- Performance optimizations must be:
  - Commented
  - Measurable
- Token logic must be:
  - Centralized
  - Provider-agnostic (Gemini-aware, not Gemini-dependent)

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- UI theming
- Dark mode
- Detailed performance analytics
- User-visible token counters
- Billing enforcement
- Rate limiting across users

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear separation of concerns
- Comments explaining:
  - Why something is lazy-loaded
  - Why token limits are chosen

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Editor layout works on multiple screen sizes
2. Initial load is noticeably faster
3. Monaco is lazily loaded
4. AI chat enforces token limits safely
5. No regressions in editor behavior

---

## 🧠 FINAL INSTRUCTION

This phase is about **making the product feel solid**, not flashy.

Do not introduce new features or abstractions beyond what is required to meet the non-functional goals.
