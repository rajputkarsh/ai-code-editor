# Phase 4.1 – Core Editor Execution Prompt

You are a **senior frontend engineer** implementing **Phase 4.1: Core Editor** for a **Next.js (App Router) web-based code editor**.

Follow the existing repository architecture and constraints strictly.

---

## 🎯 PHASE GOAL

Implement the **core in-browser code editor experience**, including:
- Monaco Editor integration
- Syntax highlighting
- File explorer
- Tabs & split views
- In-file search

This phase must be **fully functional**, but **not over-engineered**.

---

## 🧱 SCOPE (ONLY THIS PHASE)

### 1. Monaco Editor Integration
- Use `@monaco-editor/react`
- Editor must:
  - Load dynamically (no SSR issues)
  - Support multiple languages
  - Be reusable as a component

- Place editor components under: /app/(editor)/components/editor
### 2. Language & Syntax Highlighting
Enable syntax highlighting for:
- JavaScript
- TypeScript
- Python
- HTML
- CSS

Language must be:
- Auto-detected by file extension
- Explicitly set on editor mount

---

### 3. File Explorer
Implement a **basic file explorer UI** with:
- Folder & file tree
- Actions:
- Create file
- Rename file
- Delete file
- State-driven (no backend yet)
- File system lives **in memory** for now



- Place file explorer components under: /app/(editor)/components/file-explorer

---

### 4. Tabs & Split Views
Implement:
- Multiple open file tabs
- Switch between tabs
- Close tabs
- Simple horizontal split view (max 2 editors)

No persistence required yet.

---

### 5. In-File Search
- Implement search within the current file
- Use Monaco’s built-in find widget
- Keyboard shortcut support (`Ctrl/Cmd + F`)

---

## 🧠 STATE MANAGEMENT RULES

- Use React state (no Redux / Zustand yet)
- Keep state colocated
- Use clear, typed interfaces for:
  - File
  - Folder
  - Editor tab
  - Editor pane

---

## 🎨 UI & UX CONSTRAINTS

- Minimal, clean UI
- Functional > beautiful
- No design system yet
- Use basic CSS or existing global styles
- Avoid premature styling decisions

---

## 🚫 OUT OF SCOPE (DO NOT IMPLEMENT)

- GitHub integration
- Persistence (IndexedDB / backend)
- AI features
- Authentication
- Collaboration
- Drag & drop
- File icons library

---

## 🧪 QUALITY REQUIREMENTS

- TypeScript strict compliance
- No `any`
- Clear component boundaries
- Comments where logic is non-obvious
- No dead code

---

## ✅ EXPECTED OUTPUT

At the end of this phase, I should be able to:
1. Open `/editor`
2. See a file explorer on the left
3. Create and open files
4. Edit files with syntax highlighting
5. Switch tabs
6. Split editor view
7. Search within a file

---

## 🧠 FINAL INSTRUCTION

Do **not** jump ahead to future phases.

Implement **only what is required for Phase 4.1** and explain any trade-offs briefly in comments if needed.


