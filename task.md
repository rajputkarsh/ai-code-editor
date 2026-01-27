# PHASE 3B – Agent GitHub Operations Execution Prompt

You are a **senior backend + DevOps engineer** extending **Agent Mode** to safely perform **GitHub operations**.

Agent Mode core logic already exists.

This phase allows agents to:
- Commit changes
- Create branches
- Open Pull Requests

All GitHub actions must remain **fully auditable and reversible**.

---

## 🎯 PHASE GOAL

Enable AI agents to perform **GitHub operations** in a controlled, permission-based manner while keeping humans in control.

---

## 🧱 SCOPE (ONLY THIS PROMPT)

---

## 1️⃣ Agent GitHub Permissions

### Permission Levels
Agents must request explicit permissions for:
- Create branch
- Commit changes
- Push to remote
- Open Pull Request

### Rules
- Permissions are:
  - Task-scoped
  - Repo-scoped
  - Explicitly approved
- No stored long-term permissions

---

## 2️⃣ Branch Management

### Behavior
- Agent must:
  - Create a new feature branch
  - Never push to default branch
- Branch naming:
  - Deterministic
  - Human-readable

---

## 3️⃣ Commit Generation

### Requirements
- AI-generated commit messages must:
  - Follow conventional commit style
  - Explain *why*, not just *what*

### Rules
- One logical change per commit
- No squashing automatically

---

## 4️⃣ Pull Request Creation

### Behavior
- Agent opens a Pull Request after commits
- PR description must include:
  - Summary of changes
  - Files modified
  - Risks & assumptions

### Constraints
- PR must target user-selected base branch
- No auto-merge

---

## 5️⃣ Human Review Checkpoint (MANDATORY)

Before PR creation:
- Show:
  - Commit list
  - Diffs
  - PR description draft
- Require explicit approval

---

## 6️⃣ Security & Safety

### Rules
- GitHub tokens:
  - Never exposed client-side
  - Never logged
- Repo access:
  - Validated per operation
- Agent cannot:
  - Delete repositories
  - Modify repo settings
  - Force-push

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- GitHub webhooks
- PR auto-merge
- CI/CD triggers
- Repo admin actions
- Organization-wide access

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear GitHub abstraction layer
- Extensive comments explaining:
  - Permission boundaries
  - Failure modes

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Agent can create feature branches
2. Agent can commit reviewed changes
3. Agent can open Pull Requests
4. All actions are transparent & auditable
5. Users retain full control

---

## 🧠 FINAL INSTRUCTION

This phase should feel like:
> “The agent prepared everything, but *you* pressed publish.”

No surprises. No automation without consent.
