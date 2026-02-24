# PHASE 5 – Collaboration & Team Workflows Execution Prompt

You are a senior full-stack + distributed systems engineer.

We are implementing:

PHASE 5: Collaboration & Team Workflows

This phase introduces:
- Multi-user workspaces
- Real-time editing
- Role-based access
- Shared AI governance

Do NOT refactor existing workspace architecture.
Extend it cleanly.

--------------------------------------------------
🎯 PHASE GOAL
--------------------------------------------------

Enable team-based development while preserving:
- Security
- Workspace isolation
- AI safety guarantees
- Auditability

This phase must not break single-user mode.

--------------------------------------------------
8.1 User & Workspace Management
--------------------------------------------------

Implement:

1️⃣ Team Entities
- Create Team model:
  - teamId
  - name
  - ownerId
  - createdAt
- Teams contain users.

2️⃣ Membership Model
- Role-based access:
  - OWNER
  - ADMIN
  - EDITOR
  - VIEWER
- Role must be enforced server-side.

3️⃣ Workspace Ownership Update
- Workspace may belong to:
  - Individual user
  - Team
- Workspace access determined by membership role.
- Only OWNER/ADMIN can delete workspace.

4️⃣ API Updates (Hono)
- Add endpoints:
  - Create team
  - Invite member
  - Update role
  - Remove member
- Enforce strict auth (Clerk userId).
- No client-trusted permissions.

--------------------------------------------------
8.2 Real-time Collaboration
--------------------------------------------------

Implement collaborative editing with minimal viable reliability.

1️⃣ Document Sync
- Use WebSocket-based sync layer.
- Apply operational transform (OT) or CRDT (choose minimal viable approach).
- Sync per-file, not entire workspace.

2️⃣ Presence
- Show:
  - Active users
  - Cursor positions
  - Active file
- Presence data must not persist in DB.

3️⃣ Comments & Discussions
- Allow file-level comments.
- Comments stored in DB.
- No threaded discussion complexity.
- No notifications yet.

Constraints:
- Do NOT implement offline-first sync.
- Do NOT implement version history UI.
- Avoid over-engineering.

--------------------------------------------------
8.3 Shared Agents & Audit Logs
--------------------------------------------------

1️⃣ Team-Level Agents
- Agents can run within team workspaces.
- Agent permissions must respect user role.

2️⃣ Shared Prompt Libraries
- Store reusable prompts at team level.
- Allow:
  - Create
  - Edit
  - Delete
  - Reuse
- Scope strictly to team.

3️⃣ AI Action Audit Logs
- Persist:
  - Who triggered AI
  - What action was taken
  - Files modified
  - Timestamp
- Immutable logs.
- No log editing.
- Queryable per workspace.

--------------------------------------------------
🔐 SECURITY REQUIREMENTS
--------------------------------------------------

- All workspace access must validate:
  userId + teamId + role.
- Never trust client role.
- All real-time events must validate membership.
- Audit logs must not be deletable by non-owners.

--------------------------------------------------
🚫 OUT OF SCOPE
--------------------------------------------------

- End-to-end encryption
- Offline collaboration
- Enterprise SSO
- Billing integration
- Slack / GitHub sync
- Complex notification systems
- Version diff history UI

--------------------------------------------------
🧪 QUALITY REQUIREMENTS
--------------------------------------------------

- TypeScript strict
- No `any`
- Clear separation:
  - Realtime layer
  - Permission layer
  - Agent layer
- Add comments explaining:
  - Role enforcement decisions
  - Sync conflict resolution strategy
  - Audit immutability design

--------------------------------------------------
✅ EXPECTED OUTPUT
--------------------------------------------------

1. Teams can be created.
2. Members can collaborate in same workspace.
3. Edits sync in real time.
4. AI actions are logged and auditable.
5. Role-based permissions enforced server-side.
6. Single-user mode remains unaffected.

--------------------------------------------------
FINAL INSTRUCTION
--------------------------------------------------

Do not overbuild enterprise features.

Ship minimal, safe, collaborative foundation.