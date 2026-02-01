# PHASE 4.5 – Live Preview Inside the Editor Execution Prompt

You are a **senior frontend + platform engineer** implementing  
**PHASE 4.5: Live Preview Inside the Editor** for a **Next.js (App Router) web-based code editor**.

Previous phases already implemented:
- Core editor & workspace
- Authentication (Clerk)
- Workspace persistence & sync
- Inline AI & GitHub foundations
- Multi-workspace management
- Terminal & execution (WebContainer-based)

This phase introduces **live preview for frontend projects** inside the editor.

---

## 🎯 PHASE GOAL

Enable developers to:
- See real-time output of their code
- Iterate quickly using an **edit → preview** loop
- Stay fully inside the editor

This phase focuses on **developer feedback**, not deployment or production builds.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Live Preview Capabilities

### Requirements
- Render application output **inside the editor UI**
- Preview updates automatically when code changes
- Preview always reflects the **active workspace**

### Supported Preview Types (Initial)
- Static HTML / CSS / JavaScript
- React-based frontend apps (client-side only)
- Basic dev servers:
  - Vite
  - Next.js (client-side preview only)

### Constraints
- Preview is best-effort
- If a project type is unsupported, fail gracefully

---

## 2️⃣ Preview Architecture

### Rendering Strategy
- Preview must run inside an **isolated iframe**
- No direct DOM access between:
  - Editor runtime
  - Preview runtime

### Isolation Rules
- Communication only via:
  - `postMessage`
  - Explicit message contracts
- No shared global state

---

## 3️⃣ Source of Truth

### Rules
- Preview consumes:
  - Active workspace files
  - Unsaved changes (optimistic preview)
- Preview must NOT:
  - Write to workspace
  - Modify files
  - Trigger autosave

Workspace remains the single source of truth.

---

## 4️⃣ Preview Controls

### UI Requirements
- Toggle preview on / off
- Manual refresh button
- Layout modes:
  - Code-only
  - Split view (editor + preview)

### Behavior
- Preview must never block:
  - Typing
  - Editor interactions
- Preview crashes must not affect editor state

---

## 5️⃣ Error Handling & Feedback

### Scope
- Capture runtime errors from preview execution
- Display errors:
  - Inside preview panel
  - As non-blocking inline overlays

### Constraints
- Errors must be:
  - Descriptive
  - Read-only
- No automatic fixes
- No AI auto-repair in this phase

---

## 6️⃣ Security & Isolation (CRITICAL)

### Mandatory Rules
- Preview execution must be sandboxed
- Preview must NOT have access to:
  - User credentials
  - Clerk auth tokens
  - GitHub tokens
  - Internal APIs
- Network access:
  - Restricted
  - No arbitrary outbound requests (initially)

---

## 7️⃣ Performance Constraints

### Requirements
- Fast preview startup
- Debounced rebuilds on file changes
- Avoid full reloads unless required by framework

### Rules
- Preview rebuilds must:
  - Never block editor UI
  - Be cancellable on rapid changes

---

## 8️⃣ Integration Rules

### Editor Integration
- Preview reads from workspace context
- Preview does NOT:
  - Modify workspace state
  - Trigger AI actions
  - Interact with GitHub

### AI Interaction
- AI may reference preview output in future phases
- No AI-driven preview analysis in this phase

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- Production builds
- Deployment or hosting
- Server-side rendering previews
- Mobile or device emulation
- Real browser testing
- Collaborative preview sessions
- Preview-based code generation

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear separation between:
  - Editor runtime
  - Preview runtime
- Explicit comments explaining:
  - Sandbox boundaries
  - Preview limitations
  - Why certain project types are unsupported

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Users can enable a live preview inside the editor
2. Preview updates reliably on code changes
3. Unsaved changes are reflected optimistically
4. Preview errors are visible but non-intrusive
5. Editor performance remains unaffected
6. Preview execution is secure and isolated

---

## 🧠 FINAL INSTRUCTION

This phase is about **fast feedback, not correctness guarantees**.

Do not turn the preview into:
- A deployment platform
- A testing framework
- An AI automation surface

If a feature feels powerful but risky, **leave a comment and stop**.
