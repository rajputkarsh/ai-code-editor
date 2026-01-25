# Phase 1.4 – Authentication & Identity Foundation (Clerk) Execution Prompt

You are a **senior full-stack engineer** implementing **Phase 1.4: Authentication & Identity Foundation** for a **Next.js (App Router) web-based code editor**.

This phase uses **Clerk** for authentication and identity management.

The goal is to establish **reliable user identity and route protection** without impacting editor, AI, or workspace logic.

---

## 🎯 PHASE GOAL

Introduce authentication such that:
- Users can sign in using SSO
- A stable `userId` is available server-side
- Protected routes cannot be accessed anonymously
- Core editor logic remains auth-agnostic

This phase must create a **clean identity boundary** for all future phases.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Authentication Provider: Clerk

### Requirements
- Use **Clerk** as the authentication provider
- Enable SSO-based authentication:
  - GitHub (required)
  - Google (optional, but supported)
- Use Clerk’s **Next.js App Router integration**

### Constraints
- No custom auth implementation
- No passwords managed by us
- No email magic links (unless enabled by Clerk defaults)

---

## 2️⃣ Clerk Setup & Configuration

### Tasks
- Install Clerk SDK for Next.js
- Configure:
  - Clerk middleware
  - Clerk provider at app root
- Environment variables:
  - `CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`

### Rules
- All auth config must be centralized
- No auth logic inside editor components

---

## 3️⃣ User Identity Model

### Requirements
- Use Clerk’s `userId` as the **canonical user identifier**
- Do NOT create a custom user table yet
- Identity must be accessible in:
  - Server Actions
  - Hono APIs
  - Middleware

### Helper Pattern
- Create a server-side helper to fetch:
  - `userId`
  - basic user metadata (optional)
- Do not expose Clerk SDK directly everywhere

---

## 4️⃣ Route Protection

### Protected Routes
| Route | Access |
|---|---|
| `/editor` | Authenticated users only |
| `/api/*` | Authenticated users only |
| `/` | Public |

### Implementation Rules
- Use Clerk middleware for protection
- Redirect unauthenticated users to sign-in
- Avoid duplicating auth checks in components

---

## 5️⃣ Minimal Auth UI

### Required Screens
- Sign in
- Sign out

### UI Rules
- Use Clerk-provided components
- Minimal styling
- No onboarding flow
- No account settings page yet

---

## 6️⃣ Auth Boundary Rules (CRITICAL)

### Editor Isolation
- Editor components must:
  - Never import Clerk directly
  - Never check auth state themselves
- Editor should assume:
  > “If rendered, the user is authenticated”

### Server-Side Access
- Auth data accessed only via:
  - Server Actions
  - API handlers
  - Middleware

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- Workspace persistence
- Billing or subscriptions
- Feature gating
- Roles or permissions
- User profile editing
- Account deletion

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict
- No `any`
- Auth logic centralized
- Clear comments explaining:
  - Why Clerk is isolated
  - How `userId` flows server-side

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. Users can sign in via Clerk (SSO)
2. `/editor` is fully protected
3. Server-side code can reliably access `userId`
4. Editor logic has zero auth coupling
5. Foundation is ready for workspace persistence

---

## 🧠 FINAL INSTRUCTION

This phase exists to **eliminate assumptions** in future phases.

Do not add persistence, billing, or feature gating.

If something feels “useful later,” leave a comment — do not implement it now.