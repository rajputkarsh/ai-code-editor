# Phase 4.3 – Contextual AI Chat (Gemini + Inngest) Execution Prompt

You are a **senior full-stack engineer** implementing **Phase 4.3: Contextual AI Chat** for a **Next.js (App Router) web-based code editor**.

This phase adds **AI chat capabilities** using **Google Gemini (Google AI Studio)**.

Follow all existing architectural constraints strictly.

---

## 🎯 PHASE GOAL

Implement a **side-panel AI chat** that:
- Uses Gemini as the LLM provider
- Accepts selected code or file context
- Supports predefined prompt templates
- Produces **non-destructive, read-only responses**

This phase must **not modify code automatically**.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ AI Provider: Gemini (Google AI Studio)

### Requirements
- Use Gemini via Google AI Studio API
- Use **streaming responses**
- Wrap Gemini behind a **provider abstraction**

### Provider Location
/lib/ai/provider/gemini.ts

### Rules
- Do NOT call Gemini directly from UI components
- All calls go through:
  - Server Actions (preferred)
  - OR Hono APIs (if streaming requires it)

---

## 2️⃣ AI Chat UI (Side Panel)

### UI Requirements
- Right-side collapsible panel
- Chat message list (user + AI)
- Input box with send action
- Loading / streaming indicator
- Clear conversation button

### Placement
/app/(editor)/components/ai-chat

### UX Rules
- Chat must not block editor interaction
- Chat state is session-local (no persistence)
- Messages are append-only

---

## 3️⃣ Context Injection

### Supported Context Types
- Selected code (highest priority)
- Active file content
- File metadata:
  - File name
  - Language

### Rules
- Context is injected **explicitly**, never implicitly
- Token usage must be bounded
- If selection exists → ignore full file

---

## 4️⃣ Prompt Templates (Required)

Implement the following **explicit templates**:

### Explain Code
- Goal: explain logic step-by-step
- Must not suggest changes unless asked

### Find Bugs
- Goal: identify potential issues
- Must not rewrite code
- Must explain reasoning

### Optimize Logic
- Goal: suggest improvements
- Suggestions must be descriptive only
- No auto-apply

Templates must:
- Be visible to user
- Be editable before sending

---

## 5️⃣ Server Execution Model

### Interactive AI (NOW)
Use **Server Actions or Hono streaming APIs** for:
- AI chat
- Prompt execution

### Inngest Usage (LIMITED)
- Do NOT use Inngest for live chat
- ONLY scaffold:
  - Event definition
  - Future hook for long-running agent chat (commented)

No background jobs yet.

---

## 6️⃣ Safety & Non-Destructive Rules

- AI responses are **read-only**
- No code changes
- No file writes
- No diff application
- UI must clearly indicate:
  > “AI suggestions are not automatically applied”

---

## 🧠 STATE MANAGEMENT

- Keep chat state local to editor session
- Use typed message interfaces:
  - role: `user | assistant`
  - content: string
  - context metadata (optional)

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- Code auto-modification
- Inline completions
- Agent mode
- Persistence
- GitHub integration
- Token usage analytics
- Billing / limits UI

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Clear separation:
  - UI
  - Prompt logic
  - AI provider
- Comments for:
  - Prompt design decisions
  - Gemini quirks

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Editor shows a side AI chat panel
2. User can select code and ask:
   - Explain
   - Find bugs
   - Optimize
3. Gemini responses stream live
4. No code is modified automatically
5. Architecture is ready for agent mode later

---

## 🧠 FINAL INSTRUCTION

This phase is about **trust and correctness**, not automation.

Implement **only what is required** and leave clear extension points for:
- Agent mode
- Inngest orchestration
