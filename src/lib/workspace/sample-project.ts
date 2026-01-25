/**
 * Sample Project Generator
 * Creates sample workspaces for testing and demo purposes
 */

import { VirtualFileSystem } from './vfs';
import { Workspace, WorkspaceMetadata } from './types';

/**
 * Create a sample React/TypeScript project
 */
export function createSampleReactProject(): Workspace {
  const vfs = new VirtualFileSystem();
  const rootId = vfs.getRootId();

  // Create folder structure
  const srcId = vfs.createFolder(rootId, 'src');
  const componentsId = vfs.createFolder(srcId, 'components');
  const publicId = vfs.createFolder(rootId, 'public');

  // Create files
  vfs.createFile(
    rootId,
    'package.json',
    JSON.stringify(
      {
        name: 'sample-react-app',
        version: '1.0.0',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
      },
      null,
      2
    )
  );

  vfs.createFile(
    rootId,
    'README.md',
    `# Sample React App

A sample React application for testing the code editor.

## Getting Started

1. Install dependencies: \`npm install\`
2. Start dev server: \`npm run dev\`
`
  );

  vfs.createFile(
    srcId,
    'App.tsx',
    `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>Hello from Sample React App</h1>
      <p>This is a sample project created in the code editor.</p>
    </div>
  );
}

export default App;
`
  );

  vfs.createFile(
    srcId,
    'index.tsx',
    `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
  );

  vfs.createFile(
    componentsId,
    'Button.tsx',
    `import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return (
    <button onClick={onClick} className="btn">
      {label}
    </button>
  );
};
`
  );

  vfs.createFile(publicId, 'index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sample React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`);

  const metadata: WorkspaceMetadata = {
    id: crypto.randomUUID(),
    name: 'Sample React App',
    source: 'manual',
    createdAt: new Date(),
    lastOpenedAt: new Date(),
  };

  return {
    metadata,
    vfs: vfs.getStructure(),
  };
}

/**
 * Create a simple JavaScript project
 */
export function createSampleJavaScriptProject(): Workspace {
  const vfs = new VirtualFileSystem();
  const rootId = vfs.getRootId();

  vfs.createFile(
    rootId,
    'index.js',
    `// Simple JavaScript Project

function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));

module.exports = { greet };
`
  );

  vfs.createFile(
    rootId,
    'utils.js',
    `// Utility functions

function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };
`
  );

  vfs.createFile(
    rootId,
    'README.md',
    `# Sample JavaScript Project

A simple JavaScript project for testing.

## Usage

\`\`\`bash
node index.js
\`\`\`
`
  );

  const metadata: WorkspaceMetadata = {
    id: crypto.randomUUID(),
    name: 'Sample JavaScript Project',
    source: 'manual',
    createdAt: new Date(),
    lastOpenedAt: new Date(),
  };

  return {
    metadata,
    vfs: vfs.getStructure(),
  };
}


