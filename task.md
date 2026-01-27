# PHASE 3A – Agent Mode Execution Prompt (Core Intelligence)

You are a **senior AI + platform engineer** implementing **Agent Mode** for a **Next.js (App Router) web-based code editor**.

Previous phases completed:
- Inline AI (Gemini)
- GitHub foundations
- Workspace management
- Persistence & sync

This phase introduces **Agent Mode as a controlled, transparent system**.

You must prioritize:
- Safety
- Explainability
- Human control

---

## 🎯 PHASE GOAL

Enable users to switch from **Chat Mode** to **Agent Mode**, where an AI agent can:
- Analyze the entire workspace or repository
- Propose a step-by-step execution plan
- Perform multi-file changes incrementally
- Pause for human approval at key checkpoints

This phase must **not perform GitHub operations yet**.

---

## 🧱 SCOPE (ONLY THIS PROMPT)

---

## 1️⃣ Agent Mode UX

### Requirements
- Toggle between:
  - Chat Mode
  - Agent Mode
- Agent Mode must:
  - Clearly indicate “AUTONOMOUS MODE”
  - Display agent reasoning & plan

### UI Rules
- Agent actions are verbose
- No hidden steps
- User always sees:
  - What the agent plans to do
  - Which files are affected

---

## 2️⃣ Agent Planning Phase (CRITICAL)

### Behavior
Before making any changes, the agent must:
1. Analyze the workspace
2. Generate a **step-by-step execution plan**
3. List:
   - Files to read
   - Files to modify
   - New files to create (if any)

### Rules
- Plan must be shown to user
- User must explicitly approve the plan
- No execution before approval

---

## 3️⃣ Agent Permissions Model

### Permission Levels
Agent must request permissions **per task**:
- Read files
- Modify working tree
- Create new files
- Delete files

### Rules
- Permissions are:
  - Task-scoped
  - Explicit
  - Revocable
- No global agent permissions

---

## 4️⃣ Multi-file Execution Engine

### Behavior
Once approved:
- Agent executes changes **incrementally**
- After each step:
  - Show diff
  - Allow user to approve or stop

### Rules
- No silent changes
- No batch auto-apply without review
- All changes are reversible

---

## 5️⃣ Diff & Review System

### Requirements
- Full diff view per step
- File-by-file breakdown
- Clear before/after comparison

### Constraints
- No auto-save during agent execution
- Changes are staged in-memory until approved

---

## 6️⃣ Execution Model

### Technical Notes
- Agent reasoning uses **Gemini**
- Execution is:
  - Synchronous
  - User-driven
- No background jobs yet (Inngest later)

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- GitHub commits
- Branch creation
- Pull requests
- Background execution
- Retry logic
- Autonomous loops

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear separation:
  - Agent planner
  - Agent executor
  - Diff renderer
- Comments explaining:
  - Why each approval step exists

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Users can toggle Agent Mode
2. Agent produces transparent execution plans
3. Multi-file changes are previewed safely
4. Users approve every step
5. No GitHub operations occur

---

## 🧠 FINAL INSTRUCTION

Agent Mode must feel like:
> “A junior engineer explaining every move before touching code.”

Do not optimize for speed. Optimize for trust.
