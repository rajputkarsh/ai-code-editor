# Phase 1.6 – Storage, Autosave, Sync & GitHub Interop Execution Prompt

You are a **senior backend + platform engineer** implementing **Phase 1.6** of a **Next.js (App Router) web-based code editor**.

Authentication (Clerk) and basic workspace persistence already exist.

This phase hardens persistence with:
- A concrete storage strategy
- Autosave & draft recovery
- Cross-device sync
- GitHub interoperability rules
- API & security enforcement

This phase is **pure infrastructure** and must not affect editor UX or introduce new UI.

---

## 🎯 PHASE GOAL

Ensure workspace data is:
- Stored safely and predictably
- Recoverable after crashes or reloads
- Consistent across devices
- Securely isolated per user
- Ready for future billing limits

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Storage Strategy (Initial)

### Architecture Requirements
- Backend-managed persistence
- Database used for:
  - Workspace metadata
  - File tree structure
  - Editor state
- File contents:
  - Stored in database (text only)
  - No binary or large files

### Design Constraints
- Optimize for simplicity over scale
- Prefer a **single database** initially
- No object storage abstraction required yet

### Explicit Non-Goals
- Binary assets
- Large file streaming
- Version history storage

---

## 2️⃣ Autosave Implementation

### Autosave Triggers
Autosave must trigger on:
- File content edits
- File create / rename / delete
- Tab changes
- Editor layout changes

### Behavior
- Debounced server writes
- Non-blocking UI
- Always store a **last-known-good state**

### Technical Rules
- Autosave logic lives in:
/lib/workspace/autosave

- Autosave must:
- Be resilient to rapid changes
- Never block typing
- Never spam the API

---

## 3️⃣ Draft Recovery

### Recovery Scenarios
Restore unsaved changes after:
- Page reload
- Browser crash
- Network failure

### Recovery Rules
- On editor load:
- Fetch latest persisted workspace
- Hydrate editor state automatically
- No user prompt required
- Recovery must be silent and deterministic

---

## 4️⃣ Cross-Device Sync

### Scope
- User logs in on a different device
- Most recently saved workspace state is loaded
- Single source of truth per workspace

### Rules
- Server state always wins
- No merge logic
- No conflict resolution UI

### Explicitly Out of Scope
- Real-time multi-device sync
- Concurrent editing detection

---

## 5️⃣ GitHub Interoperability Rules

### GitHub-Linked Projects
- GitHub repository is the source of truth
- Cloud workspace tracks:
- Local uncommitted changes
- Editor state
- No automatic push to GitHub
- No background syncing

### Non-GitHub Projects
- Cloud workspace is the source of truth
- Persistence behaves exactly as defined above

---

## 6️⃣ APIs & Security (Hono)

### API Requirements
- All persistence APIs implemented using **Hono**
- All routes must:
- Require authentication (Clerk)
- Enforce workspace ownership
- Workspace ID must always be validated against `userId`

### API Responsibilities
- Save workspace snapshot
- Load workspace snapshot
- List workspaces
- Enforce limits

---

## 7️⃣ Security & Limits (Infrastructure Only)

### Security
- Strict per-user data isolation
- No cross-user access possible
- All reads and writes are user-scoped

### Limits (Enforced Server-Side)
- Maximum number of workspaces per user
- Maximum total storage per user

### Notes
- Limits enforced silently
- No UI for limits in this phase
- No billing integration yet

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- GitHub push / pull
- Real-time collaboration
- Conflict resolution
- Version history UI
- Offline-first behavior
- Storage analytics UI
- Billing logic or Stripe integration

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear data models:
- Workspace
- FileNode
- EditorState
- Explicit comments explaining:
- Autosave debounce strategy
- Recovery guarantees
- GitHub vs cloud source-of-truth rules

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Workspace data is stored using a defined strategy
2. Autosave is reliable and non-intrusive
3. Drafts recover automatically after crashes/reloads
4. Workspaces sync correctly across devices
5. GitHub-linked and non-GitHub projects behave predictably
6. APIs are secure and user-scoped
7. Foundation is ready for billing & collaboration

---

## 🧠 FINAL INSTRUCTION

This phase is about **correctness and safety**, not features.

Do not add UI, collaboration, or GitHub automation.

If a future need is identified, document it in comments — do not implement early.

