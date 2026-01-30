# AI-Powered Web Code Editor (Cursor-like)
## Discover & Scope Document

---

## 1. Product Vision & Objectives

### 1.1 Vision
Build a **browser-based, AI-first code editor** that enables developers to:
- Write, refactor, and debug code faster
- Collaborate with autonomous AI agents
- Perform safe, explainable, multi-file code changes
- Work directly with real GitHub repositories

The product should feel like **Cursor in the browser**, with strong emphasis on:
- Trust in AI actions
- Project-wide context awareness
- Real-world Git workflows

---

### 1.2 Core Objectives
- Move beyond autocomplete into **agent-driven development**
- Enable **project-level AI reasoning**
- Integrate deeply with **GitHub workflows**
- Maintain transparency, safety, and reversibility

---

## 2. Target Users & Personas

### 2.1 Primary Personas
1. Professional Developers (Frontend, Backend, Full-stack)
2. Startup Engineers & Indie Hackers
3. Learners & Self-taught Developers

---

### 2.2 User Problems
- AI tools lack repository-wide context
- Multi-file refactors are slow and risky
- Git workflows break development flow
- AI changes are hard to trust
- Context switching between tools reduces productivity

---

## 3. High-Level Architecture (Proposed)

### 3.1 Technology Stack
- Frontend: Next.js (App Router)
- Code Editor: Monaco Editor
- Backend: Node.js / Edge Functions
- AI Layer: LLM APIs + Agent Orchestration
- Version Control: GitHub API
- Storage: IndexedDB + Cloud Sync
- Auth: OAuth (GitHub, Email)
- Security: Sandboxed execution, permissioned AI

---

## 4. Phase-wise Scope

---

# PHASE 1: Discovery & Editor Foundation (MVP)

### Goal
Deliver a functional **web-based code editor** with basic AI assistance.

---

### 4.1 Core Editor
- Monaco Editor integration
- Syntax highlighting (JS, TS, Python, HTML, CSS)
- File explorer (create, rename, delete)
- Tabs and split views
- In-file search

---

### 4.2 Project Workspace
- Import project via ZIP
- Virtual file system
- Project metadata handling

---

### 4.3 AI Chat (Contextual)
- Side-panel AI chat
- Send selected code or file context
- Prompt templates:
  - Explain code
  - Find bugs
  - Optimize logic
- AI responses are non-destructive

---

### 4.4 Non-functional Scope
- Responsive UI
- Fast editor load
- Token usage limits

---

### Deliverables
- Browser-based editor
- AI chat with contextual understanding
- Local single-user workspace

---

# PHASE 1.4: Authentication & Identity Foundation (Clerk)

### Goal
Establish **secure authentication and user identity** as foundational infrastructure using **Clerk**, without impacting core editor, AI, or workspace logic.

This phase exists to:
- Remove identity-related assumptions from future phases
- Provide a stable `userId` for persistence, billing, and collaboration
- Centralize access control and route protection

---

## 1.4.1 Authentication Provider

### Provider
- **Clerk** as the authentication and identity provider

### Supported Sign-in Methods
- GitHub SSO (required)
- Google SSO (optional, enabled via Clerk)

### Explicit Constraints
- No custom authentication logic
- No password management by the application
- No email magic links beyond Clerk defaults

---

## 1.4.2 Clerk Setup & Configuration

### Scope
- Integrate Clerk with Next.js App Router
- Configure Clerk middleware
- Provide Clerk context at the application root

### Environment Configuration
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

All authentication configuration must be centralized.

---

## 1.4.3 User Identity Model

### Canonical User Identifier
- Use Clerk-provided `userId` as the **single source of truth** for user identity

### Scope
- No custom user database table
- User record created implicitly on first login
- Identity accessible server-side via:
  - Server Actions
  - Hono APIs
  - Middleware

---

## 1.4.4 Route Protection & Access Control

### Access Rules

| Route | Access Level |
|---|---|
| `/` | Public |
| `/editor` | Authenticated users only |
| `/api/*` | Authenticated users only (except future webhooks) |

### Implementation
- Middleware-based route protection
- Centralized authorization logic
- Predictable redirect behavior for unauthenticated users

---

## 1.4.5 Authentication Boundaries

### Editor Isolation Rules
- Editor components must not:
  - Import Clerk directly
  - Contain authentication logic
- Editor assumes:
  > “If rendered, the user is authenticated”

### Server-Side Access
- Authentication data accessed only via:
  - Server Actions
  - API handlers
  - Middleware helpers

---

## 1.4.6 Minimal Authentication UI

### Scope
- Sign-in
- Sign-out

### Constraints
- Use Clerk-provided UI components
- Minimal styling
- No onboarding flow
- No account settings UI

---

## 1.4.7 Non-Goals

This phase explicitly does **not** include:
- Workspace persistence
- Billing or subscriptions
- Feature gating
- Role-based access control
- User profile editing
- Account deletion
- Team or organization management

---

## Phase Exit Criteria

This phase is considered complete when:
1. Users can authenticate via Clerk SSO
2. Protected routes are inaccessible without login
3. A stable `userId` is available server-side
4. Editor logic remains auth-agnostic
5. Identity foundation is ready for persistence and billing

---

# PHASE 1.5: Workspace Persistence & Cloud Sync

### Goal
Enable users to **save, restore, and sync workspaces** across sessions and devices, independent of GitHub, while keeping the editor fast and predictable.

This phase establishes **workspace persistence** as product infrastructure and must **not leak into core editor logic**.

---

## 4.5 Workspace Persistence

### Scope
Persist the following workspace state:
- File tree structure
- File contents
- Open tabs
- Active file & cursor position
- Editor layout (single / split)

### Behavior
- Workspace state is restored automatically on reload or login
- Each user has one or more named workspaces
- Workspace ownership is tied to authenticated user

---

## 4.6 Storage Strategy (Initial)

### Architecture
- Backend-managed persistence
- Database for workspace metadata
- Database or object storage for file contents

### Notes
- Optimize for simplicity over scale initially
- Large files and binary assets are out of scope

---

## 4.7 Autosave & Draft Recovery

### Autosave
- Autosave triggered on file edit
- Debounced writes to reduce load
- Last-known-good state always stored

### Draft Recovery
- Restore unsaved changes after:
  - Page reload
  - Browser crash
  - Network failure

---

## 4.8 Cross-Device Sync

### Scope
- User logs in on a new device
- Most recent workspace state is loaded
- Single source of truth per workspace

### Explicitly Out of Scope
- Real-time multi-device sync
- Conflict resolution UI

---

## 4.9 GitHub Interoperability Rules

### GitHub-Linked Projects
- GitHub remains the source of truth
- Local changes tracked separately
- No automatic push to GitHub

### Non-GitHub Projects
- Cloud workspace is the source of truth

---

## 4.10 API & Security Considerations

### APIs
- Implemented via Hono
- Authenticated access only
- Workspace-scoped permissions

### Security
- Per-user data isolation
- Plan-based limits:
  - Workspace count
  - Storage size

---

## 4.11 Non-Goals

This phase explicitly does **not** include:
- Offline-first synchronization
- Version history or time-travel UI
- Merge conflict handling
- Real-time collaboration

---

## Phase Exit Criteria

This phase is considered complete when:
1. Workspace state persists across reloads
2. Users can resume work on another device
3. Autosave prevents data loss
4. Storage and workspace limits are enforceable

---

# PHASE 2: Inline AI & GitHub Foundations

### Goal
Introduce **inline AI coding** and **GitHub repository connectivity**.

---

### 5.1 Inline AI Capabilities
- Inline AI completions
- Keyboard-triggered suggestions
- Accept / reject interactions

---

### 5.2 AI Code Actions
- Right-click AI actions:
  - Refactor function
  - Convert to TypeScript
  - Add comments
  - Improve performance
- Diff preview before apply

---

### 5.3 Explain & Trace
- Explain this file
- Explain this function
- Step-by-step logic explanation

---

### 5.4 Prompt History
- Saved prompts
- Re-run previous actions

---

### 5.5 GitHub Authentication
- OAuth-based GitHub login
- Permission scopes:
  - Read-only
  - Read & Write
- Repo access management

---

### 5.6 Repository Import & Sync
- Import repositories via GitHub picker
- Public repo URL import
- Branch selection
- Shallow clone support

---

### 5.7 Git Awareness in Editor
- Modified / added / deleted file indicators
- Diff vs HEAD
- Local change tracking

---

### Deliverables
- Repo-connected workspace
- Inline AI UX
- Safe, visible code modifications

---

# PHASE 2.5: Multi-Workspace Management

### Goal
Enable users to **create, switch, organize, and manage multiple workspaces** in a predictable and scalable way, without impacting editor performance or AI workflows.

This phase formalizes the concept of **workspaces as first-class entities** and prepares the product for:
- Power users
- GitHub + non-GitHub projects
- Teams (future)
- Billing limits (future)

---

## 2.5.1 Workspace Lifecycle Management

### Scope
Allow authenticated users to:
- Create a new workspace
- Rename an existing workspace
- Delete a workspace
- Switch between workspaces

### Rules
- Each workspace has:
  - Unique workspace ID
  - Human-readable name
  - Creation timestamp
  - Last opened timestamp
- Deleting a workspace is permanent (no recovery UI)

---

## 2.5.2 Workspace Types

### Supported Types
- **Cloud Workspace**
  - Source of truth: application backend
- **GitHub-Linked Workspace**
  - Source of truth: GitHub repository
  - Local changes tracked separately

Workspace type must be:
- Explicit
- Immutable after creation

---

## 2.5.3 Workspace Selector UI

### Scope
- Workspace selector accessible from editor shell
- Displays:
  - Workspace name
  - Workspace type (Cloud / GitHub)
  - Last opened time

### Behavior
- Switching workspace:
  - Persists current workspace state
  - Loads selected workspace state
- No page reload required

### Constraints
- Minimal UI
- No drag-and-drop ordering
- No search (yet)

---

## 2.5.4 Active Workspace Semantics

### Rules
- Only **one workspace is active** at a time
- All editor, AI, and Git operations are scoped to:
  - Active workspace
- Active workspace ID must be:
  - Available server-side
  - Explicitly passed to APIs

---

## 2.5.5 Backend & Data Model

### Scope
- Workspace metadata stored per user
- APIs to:
  - List user workspaces
  - Create workspace
  - Update workspace metadata
  - Delete workspace
  - Set active workspace

### Constraints
- Implemented via Hono
- Authenticated access only
- Strict ownership checks

---

## 2.5.6 Limits & Future Billing Hooks

### Initial Limits (Infrastructure Only)
- Maximum number of workspaces per user
- Limits enforced server-side

### Notes
- No billing UI
- No plan enforcement UI
- Limit logic must be easy to connect to billing later

---

## 2.5.7 Non-Goals

This phase explicitly does **not** include:
- Workspace sharing
- Team workspaces
- Workspace templates
- Archiving or soft delete
- Workspace cloning
- Billing UI or upgrades

---

## Phase Exit Criteria

This phase is considered complete when:
1. Users can create and delete multiple workspaces
2. Users can switch workspaces without losing state
3. Each workspace is isolated and correctly scoped
4. GitHub and Cloud workspaces behave predictably
5. Workspace limits are enforceable server-side

---

# PHASE 3: Agent Mode + GitHub Operations

### Goal
Enable **autonomous AI agents** capable of executing **multi-file, repo-level tasks**.

---

### 6.1 Agent Mode
- Toggle Chat Mode / Agent Mode
- Agent step-by-step execution plan
- Human approval checkpoints

---

### 6.2 Agent Permissions
- Explicit permission levels:
  - Read files
  - Modify working tree
  - Commit changes
  - Create branches
  - Open Pull Requests
- Permission grant per task

---

### 6.3 Multi-file Agent Execution
- Repository-wide analysis
- Planned file impact list
- Incremental change application
- Full diff review

---

### 6.4 GitHub Actions by Agent
- Auto-create feature branches
- AI-generated commit messages
- Open Pull Requests
- AI-generated PR descriptions

---

### Deliverables
- Cursor-like Agent Mode
- Transparent AI reasoning
- Safe AI-driven Git operations

---

# PHASE 4: Terminal, Execution & Debugging

### Goal
Enable **full-stack development inside the browser**.

---

### 7.1 Web Terminal
- Sandboxed terminal environment
- npm / yarn / pnpm support
- Script execution

---

### 7.2 AI + Terminal
- Explain command failures
- Log summarization
- Fix suggestions

---

### 7.3 Debug Assistance
- Stack trace analysis
- Root cause detection
- Suggested code fixes

---

### Deliverables
- Runnable projects
- AI-assisted debugging
- Near local-dev experience

---

# PHASE 2.8: Live Preview Inside the Editor

### Goal
Enable developers to **see real-time output of their code** directly inside the editor, creating a tight **edit → preview → iterate** loop without leaving the application.

This phase focuses on **developer feedback**, not production deployment.

---

## 4.5 Live Preview Capabilities

### Scope
- Render application output inside the editor UI
- Preview updates automatically when code changes
- Support common frontend project types

### Supported Preview Types (Initial)
- Static HTML / CSS / JS
- React-based frontend apps (client-side only)
- Basic framework dev servers (Next.js / Vite) via sandboxed execution

---

## 4.5.2 Preview Architecture

### Rendering Strategy
- Preview runs in an **isolated iframe**
- No direct DOM access between editor and preview
- Clear boundary between:
  - Editor runtime
  - Preview runtime

### Source of Truth
- Preview always reflects the **active workspace**
- Unsaved changes must be previewed (optimistic)

---

## 4.5.3 Preview Controls

### UI Controls
- Toggle preview on/off
- Refresh preview manually
- Switch between:
  - Code-only view
  - Split view (editor + preview)

### Behavior
- Preview must never block editor interaction
- Errors in preview must not crash the editor

---

## 4.5.4 Error Handling & Feedback

### Scope
- Capture runtime errors from preview
- Display errors in:
  - Preview panel
  - Inline error overlay (read-only)

### Constraints
- Errors are descriptive, not prescriptive
- No automatic code fixes in this phase

---

## 4.5.5 Security & Isolation

### Rules
- Preview execution must be sandboxed
- No access to:
  - User credentials
  - Auth tokens
  - Host environment
- Network access restricted (initially)

---

## 4.5.6 Performance Constraints

### Requirements
- Fast startup time for preview
- Debounced rebuilds on file change
- No full reloads unless required

---

## 4.5.7 Integration Rules

### Editor Integration
- Preview consumes workspace state
- Preview does NOT:
  - Modify files
  - Trigger AI actions
  - Interact with GitHub directly

### AI Interaction (Deferred)
- AI may reference preview output in later phases
- No AI-driven preview analysis in this phase

---

## 4.5.8 Non-Goals

This phase explicitly does **not** include:
- Production builds
- Deployment or hosting
- Server-side rendering previews
- Mobile preview modes
- Real device emulation
- Collaborative preview sessions

---

## Phase Exit Criteria

This phase is considered complete when:
1. Users can see a live preview inside the editor
2. Preview updates reliably on code changes
3. Editor and preview remain isolated
4. Errors are visible but non-intrusive
5. Preview does not impact editor performance

# PHASE 5: Collaboration & Team Workflows

### Goal
Support **team-based development and shared AI workflows**.

---

### 8.1 User & Workspace Management
- User accounts
- Workspace ownership
- Role-based access

---

### 8.2 Real-time Collaboration
- Multi-user editing
- Presence indicators
- Comments & discussions

---

### 8.3 Shared Agents & Audits
- Team-level agents
- Shared prompt libraries
- AI action audit logs

---

### Deliverables
- Team-ready editor
- Enterprise-friendly AI governance

---

# PHASE 6: Advanced AI & Platform Expansion

### Goal
Position the product as an **extensible AI development platform**.

---

### 9.1 Custom Agents
- User-defined agent workflows
- Tool & permission configuration
- Agent personas

---

### 9.2 Model & Cost Control
- Model selection per task
- Token usage dashboards
- Cost controls

---

### 9.3 Plugin & Extension System
- Custom editor commands
- Framework-specific helpers
- Internal tooling support

---

### Deliverables
- Platform extensibility
- Power-user & enterprise features

---

## 10. Out of Scope (Initial)
- Native desktop apps
- Mobile editor
- Offline-first execution
- Advanced profiling tools

---

## 11. Success Metrics
- AI suggestion acceptance rate
- Agent task completion rate
- Time saved per task
- PR creation velocity
- User retention (DAU/WAU)

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|----|----|
| AI hallucinations | Diff previews + approvals |
| High LLM costs | Token budgeting |
| Latency | Streaming + caching |
| Trust issues | Explainable agent plans |
| Git misuse | Permission-based agent actions |

---

## 13. Summary

This product is **not just an editor with AI** —  
It is an **AI-native development environment** where:
- AI understands the full repository
- Agents operate transparently
- GitHub workflows are first-class
- Developers stay in flow

---

# PHASE 7: Productization, Authentication & Monetization

### Goal
Convert the editor from a **developer tool** into a **secure, monetizable product** without impacting core editor, AI, or agent architecture.

This phase is intentionally **last** to ensure:
- Core value is proven before monetization
- Authentication does not pollute editor logic
- Billing logic remains isolated and replaceable

---

## 7.1 Public Homepage (Marketing Layer)

### Scope
- Public landing page at `/`
- No authentication required

### Features
- Hero section with clear value proposition
- High-level feature highlights:
  - AI-powered code editor
  - Agent-based development
  - GitHub integration
- Pricing teaser (no checkout)
- Primary CTAs:
  - “Sign in”
  - “Start coding”

### Technical Notes
- Built using Next.js Server Components
- SEO-optimized metadata
- Minimal styling (no design system yet)

---

## 7.2 Authentication & Access Control

### Authentication Strategy
- OAuth-first (GitHub)
- Email-based authentication (optional, later)

### Scope
- User sign-in / sign-up
- Session management
- User identity persistence

### Route Protection Rules

| Route | Access Level |
|---|---|
| `/` | Public |
| `/editor` | Authenticated users only |
| `/api/*` | Authenticated (except webhooks) |

### Technical Notes
- Middleware-based route protection
- Centralized auth logic
- Editor remains auth-agnostic internally

---

## 7.3 Subscription & Billing

### Subscription Tiers (Initial)

**Free**
- Limited AI usage
- Single workspace
- No agent mode

**Pro**
- Higher AI limits
- Agent mode enabled
- GitHub repository integration

**Team (Future)**
- Shared workspaces
- Shared agents
- Audit logs

---

### Billing Scope
- Stripe integration
- Monthly subscriptions only
- Plan-based feature flags

### Explicitly Out of Scope
- Usage-based billing
- Trials or coupons
- Annual plans
- Invoices / enterprise billing

---

## 7.4 Feature Gating & Entitlements

### Gated Capabilities
- Agent mode access
- AI token limits
- GitHub private repository access
- Team features

### Enforcement Points
- Server Actions
- Hono middleware
- UI-level guards

### Design Principle
All gating must be:
- Server-enforced
- Deterministic
- Easy to audit

---

## 7.5 User Account & Settings

### Scope
- Profile details
- Connected GitHub account
- Current subscription plan
- Billing portal link

---

## 7.6 Non-Goals

This phase explicitly does **not** include:
- Advanced onboarding flows
- Referral programs
- Enterprise SSO
- Analytics dashboards
- Usage metering

---

## Phase Exit Criteria

This phase is considered complete when:
1. Public homepage is live
2. Editor routes are protected
3. Users can subscribe to a paid plan
4. Features are gated by plan
5. Billing is production-safe

---

## Strategic Note

This phase exists to **wrap value**, not to create it.

Core differentiation remains:
- AI agents
- Repository awareness
- Developer flow

Monetization must never compromise these foundations.

---

# PHASE 8: Keyboard Shortcuts & Power User Productivity

### Goal
Enable **keyboard-first workflows** that match or closely approximate the productivity experience of **VS Code / Cursor**, without overcomplicating the UI.

This phase focuses on **speed, muscle memory, and discoverability** for advanced users.

---

## 8.1 Global Keyboard Shortcut System

### Scope
- Centralized keyboard shortcut manager
- Support platform-aware shortcuts:
  - macOS
  - Windows
  - Linux
- Shortcut handling must:
  - Respect focused context
  - Avoid browser-level conflicts
  - Be easily extensible

---

## 8.2 Core Editor Shortcuts (MVP Parity)

### File & Navigation
- Open file (`Cmd/Ctrl + P`)
- Quick file search by name
- Close current file
- Switch between open tabs
- Move between split editors

---

### Editing
- Rename symbol (`F2`)
- Find in file (`Cmd/Ctrl + F`)
- Replace in file (`Cmd/Ctrl + H`)
- Go to line (`Cmd/Ctrl + G`)
- Comment / uncomment line

---

### File Explorer
- Create new file
- Create new folder
- Rename file
- Delete file
- Focus file explorer

---

## 8.3 Command Palette

### Scope
- Command palette inspired by VS Code / Cursor
- Fuzzy-searchable commands
- Keyboard-driven invocation (`Cmd/Ctrl + Shift + P`)

### Commands (Initial)
- Open file
- Toggle split view
- Rename file
- Search in file
- Toggle editor focus

---

## 8.4 Shortcut Discoverability

### Scope
- Tooltips displaying shortcuts
- Inline hints in menus
- Command palette shows shortcuts

---

## 8.5 Customization (Optional / Deferred)

### Future Scope (Not in MVP)
- User-defined shortcut remapping
- Export / import shortcuts
- Preset profiles (VS Code-like)

---

## 8.6 Technical Notes

- Leverage Monaco Editor’s built-in keybinding system where applicable
- Custom shortcuts layered on top for:
  - File explorer
  - Command palette
  - App-level actions
- Keyboard handling must be:
  - Deterministic
  - Non-blocking
  - Accessible

---

## 8.7 Non-Goals

This phase explicitly does **not** include:
- Macro recording
- Vim / Emacs keybindings
- Plugin-based shortcut injection
- Accessibility shortcuts beyond basics

---

## Phase Exit Criteria

This phase is complete when:
1. Core editor actions are fully keyboard-accessible
2. Command palette is functional and discoverable
3. File and editor navigation can be done without mouse
4. Shortcut behavior is consistent with VS Code expectations


End of Document