// tsc copies no assets, and an n8n node with no icon shows a blank square.
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/nodes/NotebookLm', { recursive: true });
cpSync('nodes/NotebookLm/notebookLm.svg', 'dist/nodes/NotebookLm/notebookLm.svg');
console.log('icon copied into dist');
