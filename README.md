# AI Code Editor - Foundation

This repository is the foundation for a web-based AI code editor. It uses Next.js (App Router), TypeScript, and Hono for the API layer.

**Current Phase**: Phase 4.2 - Project Workspace ✅ Complete

## 🏗 Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (Strict Mode)
- **API**: Hono (mounted at `/api`)
- **Validation**: Zod
- **Styling**: CSS Modules (Vanilla) / Global CSS

### Folder Structure
- `src/app`: Next.js App Router pages and API routes
- `src/lib/hono`: Hono application setup and routes
- `src/lib/config`: Environment and app configuration
- `src/actions`: Next.js Server Actions
- `src/components`: React components

## 🚦 Hono vs Server Actions

We use a hybrid approach for backend logic:

| Feature | Use **Hono** (`/api`) | Use **Server Actions** (`/actions`) |
|---------|-----------------------|-------------------------------------|
| **Use Case** | REST APIs, Webhooks, Public endpoints | Form submissions, Mutations, UI-bound logic |
| **Routing** | Explicit (`app.get('/path')`) | Implicit (function exports) |
| **Middlewares** | Yes (Logging, Auth, etc.) | Limited |
| **streaming** | Yes (Standard Web API) | Yes (React Streams) |

### When to use what?
- **Use Hono** when you need a traditional API endpoint (e.g., for GitHub webhooks, or external integrations).
- **Use Server Actions** for handling user interactions within the Next.js UI (e.g., submitting a form, clicking a button).

## 🚀 Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   Copy `.env.example` to `.env.local`
   ```bash
   cp .env.example .env.local
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

## 🧪 Verification
- Health Check: `http://localhost:3000/api/health`
- Editor: `http://localhost:3000/editor`

## 📦 Phase 4.2 - Project Workspace

### Features Implemented
- ✅ Virtual File System (VFS) - Framework-agnostic in-memory file system
- ✅ ZIP Import - Upload and extract ZIP files in the browser
- ✅ Project Metadata - Track workspace ID, name, source, and timestamps
- ✅ React Integration - Context providers for workspace management
- ✅ Import UI - Drag & drop interface for importing projects

### Quick Start
1. Navigate to `http://localhost:3000/editor`
2. Look for "Import Project from ZIP" section
3. Upload a ZIP file (click or drag & drop)
4. Your project files will appear in the file explorer

### Documentation
- **[Implementation Details](./PHASE_4.2_IMPLEMENTATION.md)** - Technical deep dive
- **[Testing Guide](./TESTING_GUIDE.md)** - How to test all features
- **[API Reference](./WORKSPACE_API_REFERENCE.md)** - Complete API documentation
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Overview and metrics

### Module Location
```
src/lib/workspace/     # Framework-agnostic VFS
src/app/(editor)/      # React components and stores
```
