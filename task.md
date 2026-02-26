# PHASE 7 – Productization, Authentication & Monetization

You are a senior SaaS platform engineer.

We are implementing:

PHASE 7: Productization, Authentication & Monetization

This phase must:
- Wrap value, not modify core value
- Keep editor + AI architecture untouched
- Isolate authentication and billing logic
- Enforce server-side entitlements

Do NOT refactor editor internals.
Do NOT pollute AI/agent logic with auth conditionals.
All gating must be layered and replaceable.

--------------------------------------------------
🎯 PHASE GOAL
--------------------------------------------------

Convert the platform from a dev tool into a secure SaaS product with:

- Public marketing layer
- OAuth authentication
- Subscription billing
- Feature gating
- Account management

--------------------------------------------------
7.1 Public Homepage (Marketing Layer)
--------------------------------------------------

Implement:

1️⃣ Public Landing Page at `/`
- Hero section
- Feature highlights:
    - AI-powered code editor
    - Agent-based development
    - GitHub integration
- Pricing teaser (no checkout yet)
- Primary CTAs:
    - Sign In
    - Start Coding

2️⃣ Technical Constraints
- Use Next.js Server Components
- Add SEO metadata
- No design system
- Keep styling minimal

Do NOT require authentication for `/`.

--------------------------------------------------
7.2 Authentication & Access Control
--------------------------------------------------

Authentication Strategy:
- OAuth-first (GitHub)
- Email login optional (future)

Implementation:

1️⃣ Integrate authentication provider (Clerk or existing auth system).
2️⃣ Implement centralized auth middleware.
3️⃣ Protect routes using middleware:

| Route       | Access Level |
|------------|-------------|
| `/`        | Public      |
| `/editor`  | Auth only   |
| `/api/*`   | Auth only   |
| `/webhooks`| Public      |

4️⃣ Session Handling
- Persist user identity
- Store userId in DB
- Do NOT pass auth logic into editor components

Editor must remain auth-agnostic.

--------------------------------------------------
7.3 Subscription & Billing (Stripe)
--------------------------------------------------

Implement Stripe monthly subscription flow.

1️⃣ Plans

Free:
- Limited AI usage
- Single workspace
- Agent mode disabled

Pro:
- Higher AI limits
- Agent mode enabled
- GitHub integration enabled

Team (future placeholder only)

2️⃣ Stripe Integration
- Create checkout session
- Handle success/cancel redirects
- Implement webhook handler:
    - subscription.created
    - subscription.updated
    - subscription.deleted

3️⃣ Persist subscription status in DB:
- userId
- plan
- stripeCustomerId
- stripeSubscriptionId
- status

4️⃣ No usage-based billing.
5️⃣ No annual plans.
6️⃣ No coupon system.

Keep billing logic isolated under `/billing` module.

--------------------------------------------------
7.4 Feature Gating & Entitlements
--------------------------------------------------

Implement centralized entitlement layer.

1️⃣ Define feature flags:

- canUseAgentMode
- maxAiTokensPerMonth
- canAccessPrivateRepos
- maxWorkspaces
- canUseTeamFeatures

2️⃣ Entitlements must be:
- Server-enforced
- Deterministic
- Based on subscription plan

3️⃣ Enforcement points:
- Hono middleware
- Server Actions
- API endpoints

4️⃣ UI should reflect disabled state but must NOT be sole enforcement layer.

Do NOT:
- Add plan checks inside core editor logic.
- Add Stripe logic inside AI engine.

All gating must go through EntitlementService.

--------------------------------------------------
7.5 User Account & Settings
--------------------------------------------------

Create `/settings` page with:

- Profile info
- Connected GitHub account
- Current plan
- Billing portal link (Stripe customer portal)

Do NOT implement advanced onboarding.

--------------------------------------------------
🔐 SECURITY RULES
--------------------------------------------------

- Never trust client plan.
- Always validate entitlement server-side.
- Stripe webhook must verify signature.
- No direct Stripe calls from client without server validation.

--------------------------------------------------
🚫 NON-GOALS
--------------------------------------------------

- Enterprise SSO
- Usage-based billing
- Referral systems
- Analytics dashboards
- Trials/coupons

--------------------------------------------------
🧪 QUALITY REQUIREMENTS
--------------------------------------------------

- TypeScript strict
- No any
- Clear separation of modules:

    /auth
    /billing
    /entitlements
    /marketing
    /editor (unchanged)

- Add comments explaining:
    - Why editor remains auth-agnostic
    - Why entitlements are centralized
    - Why billing is isolated

--------------------------------------------------
✅ PHASE EXIT CRITERIA
--------------------------------------------------

1. Public homepage live.
2. Editor protected behind authentication.
3. Users can subscribe to Pro.
4. Features gated by plan.
5. Stripe webhook safely updates subscription state.
6. Core AI/editor architecture remains untouched.

--------------------------------------------------
FINAL INSTRUCTION
--------------------------------------------------

This phase wraps value — it does not create value.

Protect:
- Developer flow
- AI architecture
- Agent safety model

Monetization must never compromise platform integrity.