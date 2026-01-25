# Phase 1.5 – Workspace Persistence & Cloud Sync Execution Prompt

You are a **senior full-stack engineer** implementing **Phase 1.5: Workspace Persistence & Cloud Sync** for a **Next.js (App Router) web-based code editor**.

Authentication is already implemented using **Clerk**.

This phase introduces **cloud-backed workspace persistence** as **product infrastructure** and must not leak into core editor or AI logic.

---

## 🎯 PHASE GOAL

Enable authenticated users to:
- Save workspace state to the server
- Restore workspace state on reload or login
- Access the same workspace across devices

All workspace data must be **scoped to the authenticated user**.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Authentication & Identity (Given)

### Assumptions (Now Explicit)
- Clerk authentication is live
- A stable `userId` is available server-side
- All workspace data is user-owned

Do NOT modify authentication logic in this phase.

---

## 2️⃣ Workspace Persistence Model

### Persist the Following State
- Virtual file system:
  - Folder structure
  - File names
  - File contents (text only)
- Editor state:
  - Open tabs
  - Active file
  - Cursor position
  - Editor layout (single / split)

### Design Requirements
- Workspace state must be:
  - Serializable
  - Deterministic
  - Forward-compatible

---

## 3️⃣ Data Storage Strategy (Initial)

### Architecture
- Backend-managed persistence
- Use database storage for:
  - Workspace metadata
  - File tree structure
- Store file contents:
  - Inline for small text files
  - No binary assets

### Notes
- Optimize for correctness and simplicity
- Multi-workspace support required

---

## 4️⃣ Workspace APIs (Hono)

### API Responsibilities
- Create workspace
- Load workspace
- Save workspace
- List user workspaces

### Constraints
- APIs must:
  - Require authentication
  - Validate workspace ownership
- Implement APIs using **Hono**
- Place under:
/app/api/workspace/*

---

## 5️⃣ Autosave & Restore Behavior

### Autosave
- Triggered on:
- File content changes
- Tab changes
- Layout changes
- Writes must be:
- Debounced
- Non-blocking

### Restore
- On editor load:
- Fetch last opened workspace
- Hydrate workspace state
- Optimistic hydration allowed

---

## 6️⃣ Editor Integration Rules (CRITICAL)

- Editor components must:
- Read from workspace context only
- Never call persistence APIs directly
- Persistence logic must live in:
/lib/workspace/persistence


Editor behavior must remain unchanged.

---

## 7️⃣ State Management

### Requirements
- Workspace context exposes:
- Current workspace
- Load / save handlers
- Persistence is:
- Side-effect driven
- Transparent to UI

Avoid global stores and tight coupling.

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- GitHub repository sync
- Real-time collaboration
- Conflict resolution UI
- Offline-first behavior
- Version history UI
- Storage quota enforcement UI
- Billing or plan-based limits

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Explicit data models:
- Workspace
- FileNode
- EditorState
- Clear serialization boundaries
- Comments explaining:
- Autosave debounce strategy
- Restore flow assumptions

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Authenticated users have one or more saved workspaces
2. Workspace state persists across reloads
3. Workspaces load correctly on new devices
4. Editor functionality is unchanged
5. Persistence logic is isolated and reusable

---

## 🧠 FINAL INSTRUCTION

This phase is **product infrastructure**, not UX or editor logic.

Do not introduce collaboration, GitHub sync, or billing logic.

If a future concern arises, leave a comment — do not implement ahead of scope.
