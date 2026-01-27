# PHASE 4 – Terminal, Execution & Debugging Execution Prompt

You are a **senior platform + developer tooling engineer** implementing  
**PHASE 4: Terminal, Execution & Debugging** for a **Next.js (App Router) web-based code editor**.

Previous phases already implemented:
- Editor & workspace foundations
- Authentication (Clerk)
- Workspace persistence & sync
- Inline AI & GitHub foundations
- Multi-workspace management
- Live preview

This phase introduces **code execution and debugging inside the browser**.

You must prioritize:
- Security
- Isolation
- Predictability
- Non-destructive behavior

---

## 🎯 PHASE GOAL

Enable users to:
- Run project scripts from a web terminal
- Inspect logs and errors
- Receive AI-assisted explanations for failures

This phase should feel like a **safe, limited local dev experience**, not a production runtime.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Web Terminal (Sandboxed)

### Requirements
- Web-based terminal UI embedded in the editor
- Terminal must support:
  - `npm`
  - `yarn`
  - `pnpm`
- Ability to run:
  - `install`
  - `dev`
  - `build`
  - custom scripts from `package.json`

### Architecture Rules
- Terminal execution must run in a **sandboxed environment**
- No direct access to:
  - Host filesystem
  - Environment secrets
  - Auth tokens
- Execution must be **workspace-scoped**

### Constraints
- No root access
- No long-running daemons
- Hard execution timeouts

---

## 2️⃣ Execution Model

### Behavior
- Commands execute against:
  - Active workspace only
- Terminal output:
  - Streams in real time
  - Is persisted short-term (session scope)

### Limits
- CPU & memory limits enforced
- Max execution time enforced
- Graceful termination on timeout

---

## 3️⃣ AI + Terminal (Read-only Assistance)

### Scope
Add AI assistance for terminal output using **Gemini**.

### Supported AI Actions
- Explain why a command failed
- Summarize long logs
- Suggest possible fixes

### Rules
- AI is:
  - Read-only
  - Non-destructive
- AI must:
  - Never run commands
  - Never modify files
- User explicitly triggers AI help

---

## 4️⃣ Debug Assistance

### Supported Inputs
- Stack traces
- Runtime errors
- Build failures
- Test failures (basic)

### Behavior
- AI analyzes:
  - Error message
  - Stack trace
  - Relevant file context
- AI outputs:
  - Root cause explanation
  - Suggested fix (text only)
  - Files likely involved

### Constraints
- No auto-apply
- No code modifications
- Suggestions only

---

## 5️⃣ Integration Rules (CRITICAL)

### Editor Integration
- Terminal must:
  - Consume active workspace state
  - Never mutate editor state directly
- Editor must:
  - Remain responsive during execution
  - Be isolated from terminal crashes

---

## 🔐 SECURITY & ISOLATION

### Mandatory Rules
- Each terminal session:
  - Is isolated per workspace
  - Is isolated per user
- No cross-workspace execution
- No cross-user execution
- No access to:
  - GitHub tokens
  - Clerk auth context
  - Internal APIs

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- Persistent terminal sessions
- Background daemons
- Debuggers (breakpoints, stepping)
- Container orchestration UI
- Production deployments
- Server-side secrets
- AI auto-fixing code

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear separation between:
  - Terminal UI
  - Execution backend
  - AI assistance
- Explicit comments explaining:
  - Sandbox strategy
  - Execution limits
  - Security trade-offs

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Users can run project scripts in-browser
2. Terminal output streams reliably
3. Crashes or failures do not affect the editor
4. AI can explain errors and logs
5. No command runs without explicit user action
6. System remains secure and predictable

---

## 🧠 FINAL INSTRUCTION

This phase is about **empowerment without risk**.

Do not:
- Add automation
- Add background agents
- Add deployment features

If something feels powerful but risky, **leave a comment and stop**.
