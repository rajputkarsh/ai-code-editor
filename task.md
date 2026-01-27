# PHASE 2.5 – Multi-Workspace Management Execution Prompt

You are a **senior full-stack engineer** implementing **PHASE 2.5: Multi-Workspace Management** for a **Next.js (App Router) web-based code editor**.

Previous phases already implemented:
- Authentication (Clerk)
- Workspace persistence & sync
- Inline AI & GitHub foundations

This phase introduces **multiple workspaces as a first-class concept**.

---

## 🎯 PHASE GOAL

Enable authenticated users to:
- Create, rename, delete multiple workspaces
- Switch between workspaces safely
- Work with both Cloud and GitHub-linked workspaces
- Ensure all editor, AI, and Git operations are scoped to the active workspace

This phase must **not introduce collaboration, billing UI, or agent logic**.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Workspace Lifecycle Management

### Required Operations
Implement backend + frontend support for:
- Create workspace
- Rename workspace
- Delete workspace (hard delete)
- Switch active workspace

### Rules
- Each workspace must have:
  - `workspaceId` (UUID)
  - `name`
  - `type` (`cloud` | `github`)
  - `createdAt`
  - `lastOpenedAt`
- Deleting a workspace permanently removes all associated data
- No undo or archive behavior

---

## 2️⃣ Workspace Types

### Supported Types
- **Cloud Workspace**
  - Source of truth: application backend
- **GitHub-Linked Workspace**
  - Source of truth: GitHub repository
  - Local changes tracked separately

### Constraints
- Workspace type is:
  - Explicit at creation time
  - Immutable after creation
- GitHub workspaces must reference:
  - Repository
  - Branch

---

## 3️⃣ Active Workspace Semantics (CRITICAL)

### Rules
- Only **one workspace can be active at a time**
- All operations must be scoped to:
  - Active workspace ID
- Active workspace ID must be:
  - Stored server-side
  - Available in Server Actions and Hono APIs

### Behavior
- Switching workspace:
  - Persists current workspace state
  - Loads selected workspace state
- No page reload required

---

## 4️⃣ Workspace Selector UI

### Scope
Implement a **minimal workspace selector** in the editor shell.

### UI Requirements
- Show:
  - Workspace name
  - Workspace type (Cloud / GitHub)
  - Last opened timestamp
- Allow:
  - Switching workspaces
  - Creating a new workspace
  - Deleting current workspace

### Constraints
- Minimal UI
- No search
- No drag-and-drop
- No reordering

---

## 5️⃣ Backend APIs (Hono)

### Required APIs
Implement workspace APIs via **Hono**:
- `GET /workspaces`
- `POST /workspaces`
- `PATCH /workspaces/:id`
- `DELETE /workspaces/:id`
- `POST /workspaces/:id/activate`

### Rules
- All APIs must:
  - Require authentication (Clerk)
  - Enforce workspace ownership
- Workspace ID must always be validated against `userId`

---

## 6️⃣ State Management & Integration

### Frontend
- Workspace context must expose:
  - Workspace list
  - Active workspace
  - Switch/create/delete handlers

### Editor Integration Rules
- Editor components must:
  - Consume workspace context
  - Never call workspace APIs directly
- Editor logic must not care how many workspaces exist

---

## 7️⃣ Limits & Future Billing Hooks

### Scope (Infrastructure Only)
- Enforce:
  - Maximum workspaces per user
- Enforcement:
  - Server-side only
  - Silent (no UI)

### Notes
- No billing UI
- No plan selection
- No upgrade prompts

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- Workspace sharing
- Team workspaces
- Workspace templates
- Workspace cloning
- Archiving / soft delete
- Billing UI or Stripe integration
- Collaboration or presence

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear data models:
  - Workspace
  - WorkspaceMetadata
- Explicit comments explaining:
  - Active workspace semantics
  - Source-of-truth rules
- No duplicated workspace logic

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Users can manage multiple workspaces
2. Workspace switching is seamless and safe
3. Active workspace is always explicit
4. Cloud and GitHub workspaces behave correctly
5. Editor, AI, and Git operations are workspace-scoped
6. Foundation is ready for billing, teams, and agent mode

---

## 🧠 FINAL INSTRUCTION

This phase defines **how users organize their work**.

Do not add collaboration, billing, or automation.

If something feels useful later, **leave a comment and stop**.
