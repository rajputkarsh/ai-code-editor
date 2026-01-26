# PHASE 2 – Inline AI & GitHub Foundations Execution Prompt

You are a **senior full-stack engineer** implementing **PHASE 2: Inline AI & GitHub Foundations** for a **Next.js (App Router) web-based code editor**.

Previous phases completed:
- Core Editor (Monaco, workspace, persistence)
- Authentication (Clerk)
- Workspace Persistence & Sync
- Contextual AI Chat (Gemini)

This phase introduces **inline AI coding** and **GitHub repository connectivity**.

You must follow all existing architectural boundaries strictly.

---

## 🎯 PHASE GOAL

Enable users to:
- Receive **inline AI coding assistance**
- Perform **safe, previewable AI code actions**
- Connect and work with **real GitHub repositories**
- See **Git-aware editor state**

This phase must **not introduce agent autonomy** or unsafe automation.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Inline AI Capabilities

### Requirements
- Inline AI code completions inside Monaco
- Suggestions triggered via:
  - Keyboard shortcut (e.g. `Cmd/Ctrl + Enter`)
- Inline ghost-text or suggestion overlay

### Behavior
- User can:
  - Accept suggestion
  - Reject suggestion
- Suggestions must:
  - Be contextual (cursor + file)
  - Never auto-apply without confirmation

### Technical Rules
- Inline AI must:
  - Use Gemini (hosted)
  - Stream tokens
  - Be cancelable
- No background jobs (no Inngest here)

---

## 2️⃣ AI Code Actions (Safe & Explicit)

### Supported Actions
Right-click or command-palette actions:
- Refactor function
- Convert file to TypeScript
- Add comments
- Improve performance

### Safety Rules
- AI must **never** modify files directly
- All actions must:
  - Generate a diff
  - Show preview
  - Require explicit user approval

### Implementation
- Generate patch/diff from AI output
- Apply changes only after user confirms

---

## 3️⃣ Explain & Trace

### Scope
Implement read-only explainability tools:
- Explain this file
- Explain this function
- Step-by-step logic explanation

### Rules
- No code modification
- Explanation only
- Uses same context pipeline as AI chat

---

## 4️⃣ Prompt History

### Requirements
- Store AI prompts locally per session
- Support:
  - Viewing past prompts
  - Re-running previous actions

### Constraints
- No cloud persistence yet
- No analytics
- Session-scoped only

---

## 5️⃣ GitHub Authentication

### Requirements
- OAuth-based GitHub authentication
- Use GitHub OAuth **in addition to Clerk**
- Permission scopes:
  - Read-only
  - Read & Write

### Rules
- GitHub auth is:
  - Optional per user
  - Explicitly granted
- Token storage must be:
  - Server-side only
  - User-scoped

---

## 6️⃣ Repository Import & Sync

### Supported Imports
- GitHub repository picker
- Public GitHub repo URL

### Import Options
- Branch selection
- Shallow clone only

### Behavior
- Imported repo becomes a workspace
- GitHub repo is treated as:
  - External source of truth
  - Not auto-synced

---

## 7️⃣ Git Awareness in Editor

### Editor Indicators
- Modified files
- New files
- Deleted files

### Diff Support
- Diff vs HEAD
- Per-file diff view

### Change Tracking
- Track local changes separately from GitHub
- No auto-commit
- No auto-push

---

## 🔐 SECURITY & BOUNDARIES

- GitHub tokens:
  - Never exposed to client
  - Never logged
- Repo access:
  - Validated per request
- Workspace ownership enforced

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- Agent mode
- Background AI jobs
- Automatic commits or PRs
- GitHub webhooks
- Real-time collaboration
- Billing enforcement
- Usage analytics

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear separation between:
  - Editor
  - AI logic
  - GitHub logic
- Comments explaining:
  - Why changes are non-destructive
  - GitHub source-of-truth rules

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Inline AI suggestions work safely
2. AI code actions show diffs before apply
3. Files can be explained and traced
4. GitHub repositories can be imported
5. Editor shows Git-aware file status
6. No code changes happen without user consent

---

## 🧠 FINAL INSTRUCTION

This phase is about **augmenting developers**, not replacing them.

Optimize for:
- Trust
- Visibility
- Reversibility

Do not introduce autonomy or background agents yet.
