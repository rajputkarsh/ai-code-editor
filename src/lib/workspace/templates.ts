import { VirtualFileSystem } from './vfs';
import type { WorkspaceProjectType, WorkspaceTemplateType } from './types';

export interface TemplateInitializationResult {
  projectType: WorkspaceProjectType;
}

function createViteReactPackageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName.toLowerCase().replace(/\s+/g, '-'),
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
      devDependencies: {
        vite: '^7.1.0',
        '@vitejs/plugin-react': '^5.0.0',
      },
    },
    null,
    2
  );
}

/**
 * Initializes template files in the current workspace VFS.
 * Kept modular so future templates can be added without changing callers.
 */
export function initializeWorkspaceTemplate(
  vfs: VirtualFileSystem,
  projectName: string,
  template: WorkspaceTemplateType
): TemplateInitializationResult {
  const rootId = vfs.getRootId();

  if (template === 'react-vite') {
    const srcId = vfs.createFolder(rootId, 'src');

    vfs.createFile(rootId, 'package.json', createViteReactPackageJson(projectName));
    vfs.createFile(
      rootId,
      'vite.config.ts',
      `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`
    );
    vfs.createFile(
      rootId,
      'index.html',
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
    );
    vfs.createFile(
      srcId,
      'main.tsx',
      `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
    );
    vfs.createFile(
      srcId,
      'App.tsx',
      `export default function App() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>${projectName}</h1>
      <p>Your Vite + React workspace is ready.</p>
    </main>
  );
}
`
    );
    vfs.createFile(
      rootId,
      'tsconfig.json',
      `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`
    );
    vfs.createFile(
      rootId,
      'README.md',
      `# ${projectName}

Minimal React + Vite template.

## Scripts

- npm run dev
- npm run build
- npm run preview
`
    );

    return {
      projectType: 'vite-react',
    };
  }

  return {
    projectType: 'vite-react',
  };
}
