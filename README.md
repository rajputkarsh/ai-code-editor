# AI Code Editor - Foundation

This repository is the foundation for a web-based AI code editor. It uses Next.js (App Router), TypeScript, and Hono for the API layer.

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
