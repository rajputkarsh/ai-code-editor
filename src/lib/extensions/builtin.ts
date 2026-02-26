import { ExtensionDefinition } from './api';

export const builtInExtensions: ExtensionDefinition[] = [
  {
    id: 'ext.react-helper',
    name: 'React Helper',
    version: '1.0.0',
    permissionScope: ['register_commands', 'run_ai_action', 'read_workspace'],
    commands: [
      { id: 'react.generate-component', title: 'React: Generate Component', when: 'command_palette' },
      { id: 'react.optimize-hooks', title: 'React: Optimize Hooks', when: 'context_menu' },
    ],
    activate: async (context) => {
      context.log('React Helper activated');
      context.registerCommand(
        { id: 'react.generate-component', title: 'React: Generate Component', when: 'command_palette' },
        async () => {
          context.log('React component generation requested');
        }
      );
    },
    onWorkspaceChange: async (context, workspaceId) => {
      context.log(`Workspace switched: ${workspaceId ?? 'none'}`);
    },
  },
  {
    id: 'ext.node-helper',
    name: 'Node Helper',
    version: '1.0.0',
    permissionScope: ['register_commands', 'read_workspace'],
    commands: [{ id: 'node.add-script', title: 'Node: Add package script', when: 'command_palette' }],
    activate: async (context) => {
      context.log('Node Helper activated');
      context.registerCommand(
        { id: 'node.add-script', title: 'Node: Add package script', when: 'command_palette' },
        async () => {
          context.log('Node script helper command invoked');
        }
      );
    },
    onFileSave: async (context, filePath) => {
      if (filePath.endsWith('package.json')) {
        context.log('Detected package.json save');
      }
    },
  },
  {
    id: 'ext.git-workflow-helper',
    name: 'Git Workflow Helper',
    version: '1.0.0',
    permissionScope: ['register_commands', 'propose_write'],
    commands: [{ id: 'git.prepare-pr', title: 'Git: Prepare PR Draft', when: 'command_palette' }],
    activate: async (context) => {
      context.log('Git Workflow Helper activated');
      context.registerCommand(
        { id: 'git.prepare-pr', title: 'Git: Prepare PR Draft', when: 'command_palette' },
        async () => {
          context.log('PR preparation helper invoked');
        }
      );
    },
  },
];
