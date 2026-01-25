# Phase 4.2 – Project Workspace Execution Prompt

You are a **senior full-stack engineer** implementing **Phase 4.2: Project Workspace** for a **Next.js (App Router) web-based code editor**.

This phase focuses on **project-level state and virtual file system foundations** that the editor will operate on.

Follow existing repository structure and constraints strictly.

---

## 🎯 PHASE GOAL

Implement a **project workspace layer** that:
- Can import a project via ZIP
- Maintains a virtual file system in memory
- Tracks basic project metadata

This workspace will be consumed by the editor, file explorer, and future GitHub / persistence layers.

---

## 🧱 SCOPE (ONLY THIS PHASE)

---

## 1️⃣ Project Import (ZIP)

### Requirements
- Allow user to upload a `.zip` file
- Extract contents in-browser
- Populate virtual file system from ZIP structure

### Constraints
- No backend persistence
- No GitHub integration
- Assume trusted input (basic validation only)

### UX
- Simple “Import Project” action
- Loading state during extraction
- Error handling for invalid ZIPs

---

## 2️⃣ Virtual File System (VFS)

### Requirements
Implement an **in-memory virtual file system** that supports:
- Nested folders and files
- File content as string
- Basic operations:
  - Read file
  - Write file
  - Create file
  - Rename file
  - Delete file
  - List directory contents

### Design Rules
- VFS must be **framework-agnostic**
- No DOM or UI dependencies
- Must be usable by:
  - File Explorer
  - Editor
  - Future GitHub sync
  - Future persistence layer

### Location
Place VFS logic under:

/lib/workspace

---

## 3️⃣ Project Metadata

### Required Metadata
Track the following:
- Project ID (UUID)
- Project name
- Import source (ZIP / future GitHub)
- Created timestamp
- Last opened timestamp

### Behavior
- Metadata stored alongside workspace state
- Metadata accessible via workspace context

---

## 🧠 STATE MANAGEMENT RULES

- Use React context to expose:
  - Workspace
  - VFS operations
  - Metadata
- Avoid global stores
- Keep state colocated and typed

---

## 🎨 UI CONSTRAINTS

- Minimal UI
- No design system
- No drag & drop
- No persistence UI

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- Saving to backend
- IndexedDB / localStorage
- GitHub repositories
- Authentication
- AI features
- Collaboration

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict mode
- No `any`
- Clean interfaces:
  - FileNode
  - DirectoryNode
  - Workspace
- Comments for non-obvious logic
- No dead code

---

## ✅ EXPECTED OUTPUT

At the end of this phase:
1. A project can be imported via ZIP
2. Files and folders appear in the file explorer
3. Editor reads/writes from VFS
4. Project metadata is available
5. Workspace layer is reusable for future phases

---

## 🧠 FINAL INSTRUCTION

Do **not** add persistence, GitHub logic, or editor features beyond what is required.

This phase is **pure foundation** — optimize for clarity and extensibility.