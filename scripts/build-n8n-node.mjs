#!/usr/bin/env node
/**
 * Generate the n8n community node from the OpenAPI specification.
 *
 * Third client built this way, same reason: a node written by hand covers the
 * routes someone remembered, and an n8n user then cannot reach the one that
 * shipped last week. The node's whole surface — seven resources, 56
 * operations, every parameter — comes out of the specification, and `--check`
 * fails the build when the file on disk is not what it produces.
 *
 * n8n's own contract, which this respects:
 *   - the package is `n8n-nodes-notebooklm` and carries the
 *     `n8n-community-node-package` keyword;
 *   - a verified node has **no runtime dependency**, so the node calls the
 *     server through n8n's own HTTP helper and nothing else;
 *   - one package integrates exactly one service.
 *
 * Usage:
 *   node scripts/build-n8n-node.mjs           # write the file
 *   node scripts/build-n8n-node.mjs --check   # exit 1 if it would change
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = join(ROOT, 'deployment', 'docs', 'openapi.yaml');
const OUT = join(ROOT, 'nodes', 'n8n-nodes-notebooklm', 'nodes', 'NotebookLm', 'NotebookLm.node.ts');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** The specification's tags, as n8n resources. */
const RESOURCES = {
  Health: { value: 'health', name: 'Health' },
  Auth: { value: 'auth', name: 'Authentication' },
  'Q&A': { value: 'qa', name: 'Question' },
  Notebooks: { value: 'notebook', name: 'Notebook' },
  Sessions: { value: 'session', name: 'Session' },
  Sources: { value: 'source', name: 'Source' },
  Content: { value: 'content', name: 'Content' },
};

const camel = (s) =>
  s
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toLowerCase());

/** A human label for a wire name: `notebook_id` becomes `Notebook ID`. */
function label(wire) {
  const words = wire
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return words
    .map((w) => {
      const upper = { id: 'ID', url: 'URL', api: 'API', ms: 'MS', utcp: 'UTCP', json: 'JSON' };
      return upper[w.toLowerCase()] ?? w[0].toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/** A sentence n8n can show under a field, without a trailing full stop rule. */
const describe = (text) => (text ? String(text).replace(/\s+/g, ' ').trim() : '');

function deref(node, spec) {
  if (node && typeof node === 'object' && typeof node.$ref === 'string') {
    const path = node.$ref.replace(/^#\//, '').split('/');
    let target = spec;
    for (const step of path) target = target?.[step];
    if (!target) throw new Error(`${node.$ref} is referenced but not defined.`);
    return target;
  }
  return node;
}

/** An n8n field type, plus how execute() should read the value back. */
function fieldType(schema, spec) {
  const target = deref(schema ?? {}, spec) ?? {};
  const t = Array.isArray(target.type) ? target.type.filter((x) => x !== 'null')[0] : target.type;
  if (t === 'integer' || t === 'number') return { type: 'number', kind: 'number' };
  if (t === 'boolean') return { type: 'boolean', kind: 'boolean' };
  if (t === 'array') return { type: 'string', kind: 'list' };
  if (t === 'object') return { type: 'json', kind: 'json' };
  return { type: 'string', kind: 'string' };
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export function build(spec) {
  const operations = [];

  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = item?.[method];
      if (!op?.operationId) continue;
      const tag = (op.tags ?? ['Health'])[0];
      const resource = RESOURCES[tag];
      if (!resource) throw new Error(`${op.operationId} carries the unknown tag ${tag}`);

      const params = op.parameters ?? [];
      const bodySchema = deref(op.requestBody?.content?.['application/json']?.schema, spec);
      const required = new Set(bodySchema?.required ?? []);

      const fields = [];
      for (const p of params.filter((x) => x.in === 'path')) {
        fields.push({
          wire: p.name,
          where: 'path',
          required: true,
          ...fieldType(p.schema ?? { type: 'string' }, spec),
          description: describe(p.description),
        });
      }
      for (const [wire, prop] of Object.entries(bodySchema?.properties ?? {})) {
        fields.push({
          wire,
          where: 'body',
          required: required.has(wire),
          ...fieldType(prop, spec),
          description: describe(deref(prop, spec)?.description),
        });
      }
      for (const p of params.filter((x) => x.in === 'query')) {
        fields.push({
          wire: p.name,
          where: 'query',
          required: false,
          ...fieldType(p.schema ?? { type: 'string' }, spec),
          description: describe(p.description),
        });
      }

      // The response envelope: two routes answer with their own document.
      const res = deref(
        (op.responses?.['200'] ?? op.responses?.['201'])?.content?.['application/json']?.schema,
        spec
      );

      operations.push({
        id: op.operationId,
        resource: resource.value,
        method: method.toUpperCase(),
        path,
        fields,
        enveloped: Boolean(res?.properties?.data),
        summary: describe(op.summary) || op.operationId,
        description: describe(op.description),
      });
    }
  }

  // One property per (name, type) pair, shown for every operation that has it.
  // Two operations sharing `notebookId` must not produce two fields with the
  // same name — n8n keys parameters by name, and the second would shadow the
  // first in every expression.
  const properties = new Map();
  for (const op of operations) {
    for (const f of op.fields) {
      const base = camel(f.wire);
      let key = `${base}|${f.type}|${f.required}`;
      let name = base;
      // A name reused with a different type or requirement gets its own field.
      if (![...properties.keys()].includes(key) && [...properties.values()].some((p) => p.name === base)) {
        name = `${base}${f.type[0].toUpperCase()}${f.type.slice(1)}${f.required ? 'Required' : ''}`;
        key = `${name}|${f.type}|${f.required}`;
      }
      const existing = properties.get(key);
      const entry = existing ?? {
        name,
        wire: f.wire,
        where: f.where,
        type: f.type,
        kind: f.kind,
        required: f.required,
        description: f.description,
        shown: [],
      };
      entry.shown.push({ resource: op.resource, operation: op.id });
      if (!entry.description && f.description) entry.description = f.description;
      properties.set(key, entry);
    }
  }

  const byResource = new Map();
  for (const op of operations) {
    if (!byResource.has(op.resource)) byResource.set(op.resource, []);
    byResource.get(op.resource).push(op);
  }

  const routeLines = operations.map((op) => {
    const fields = (where) =>
      op.fields
        .filter((f) => f.where === where)
        .map((f) => {
          const prop = [...properties.values()].find(
            (p) => p.wire === f.wire && p.shown.some((s) => s.operation === op.id)
          );
          return `{ name: '${esc(prop.name)}', wire: '${esc(f.wire)}', kind: '${f.kind}', required: ${f.required} }`;
        })
        .join(', ');
    return (
      `  '${op.resource}:${op.id}': {\n` +
      `    method: '${op.method}',\n` +
      `    path: '${esc(op.path)}',\n` +
      `    pathParams: [${fields('path')}],\n` +
      `    body: [${fields('body')}],\n` +
      `    query: [${fields('query')}],\n` +
      `    enveloped: ${op.enveloped},\n` +
      `  },`
    );
  });

  const resourceOptions = [...byResource.keys()]
    .map((value) => {
      const name = Object.values(RESOURCES).find((r) => r.value === value).name;
      return `        { name: '${esc(name)}', value: '${esc(value)}' },`;
    })
    .join('\n');

  const operationProperties = [...byResource.entries()]
    .map(([resource, ops]) => {
      const options = ops
        .map(
          (op) =>
            `        {\n` +
            `          name: '${esc(label(op.id))}',\n` +
            `          value: '${esc(op.id)}',\n` +
            `          action: '${esc(op.summary)}',\n` +
            `          description: '${esc(op.description || op.summary)}',\n` +
            `        },`
        )
        .join('\n');
      return (
        `  {\n` +
        `    displayName: 'Operation',\n` +
        `    name: 'operation',\n` +
        `    type: 'options',\n` +
        `    noDataExpression: true,\n` +
        `    displayOptions: { show: { resource: ['${resource}'] } },\n` +
        `    default: '${esc(ops[0].id)}',\n` +
        `    options: [\n${options}\n    ],\n` +
        `  },`
      );
    })
    .join('\n');

  const fieldProperties = [...properties.values()]
    .map((p) => {
      const resources = [...new Set(p.shown.map((s) => s.resource))];
      const ops = [...new Set(p.shown.map((s) => s.operation))];
      const def =
        p.type === 'number' ? '0' : p.type === 'boolean' ? 'false' : p.type === 'json' ? "'{}'" : "''";
      const hint =
        p.kind === 'list'
          ? (p.description ? `${p.description}. ` : '') + 'Comma-separated'
          : p.description;
      return (
        `  {\n` +
        `    displayName: '${esc(label(p.wire))}',\n` +
        `    name: '${esc(p.name)}',\n` +
        `    type: '${p.type}',\n` +
        `    default: ${def},\n` +
        (p.required ? `    required: true,\n` : '') +
        (hint ? `    description: '${esc(hint)}',\n` : '') +
        `    displayOptions: {\n` +
        `      show: {\n` +
        `        resource: [${resources.map((r) => `'${esc(r)}'`).join(', ')}],\n` +
        `        operation: [${ops.map((o) => `'${esc(o)}'`).join(', ')}],\n` +
        `      },\n` +
        `    },\n` +
        `  },`
      );
    })
    .join('\n');

  return `// @generated by scripts/build-n8n-node.mjs from deployment/docs/openapi.yaml
// — do not edit by hand. Run \`npm run n8n:sync\`.
//
// A node written by hand covers the routes someone remembered. This one is the
// specification, so an operation added upstream reaches an n8n workflow on the
// release that ships it.

import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

type FieldKind = 'string' | 'number' | 'boolean' | 'list' | 'json';

interface Field {
  name: string;
  wire: string;
  kind: FieldKind;
  required: boolean;
}

interface Route {
  method: IHttpRequestMethods;
  path: string;
  pathParams: Field[];
  body: Field[];
  query: Field[];
  /** Two routes answer with their own document rather than success + data. */
  enveloped: boolean;
}

const ROUTES: Record<string, Route> = {
${routeLines.join('\n')}
};

export class NotebookLm implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'NotebookLM',
    name: 'notebookLm',
    icon: 'file:notebookLm.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{ $parameter["operation"] }}',
    description:
      'Gemini Notebook (formerly NotebookLM): citation-backed answers, passage retrieval and Studio generation, through a local server',
    defaults: { name: 'NotebookLM' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: 'notebookLmApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        default: 'qa',
        options: [
${resourceOptions}
        ],
      },
${operationProperties}
${fieldProperties}
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        const route = ROUTES[\`\${resource}:\${operation}\`];
        if (route === undefined) {
          throw new NodeOperationError(
            this.getNode(),
            \`\${operation} is not an operation of \${resource}\`,
            { itemIndex: i }
          );
        }

        const read = (field: Field): unknown => {
          const raw = this.getNodeParameter(field.name, i, undefined) as unknown;
          if (raw === undefined || raw === null || raw === '') return undefined;
          if (field.kind === 'list') {
            return String(raw)
              .split(',')
              .map((part) => part.trim())
              .filter((part) => part.length > 0);
          }
          if (field.kind === 'json') {
            return typeof raw === 'string' ? (JSON.parse(raw) as IDataObject) : raw;
          }
          return raw;
        };

        let url = route.path;
        for (const field of route.pathParams) {
          const value = read(field);
          if (value === undefined) {
            throw new NodeOperationError(this.getNode(), \`\${field.wire} is required\`, {
              itemIndex: i,
            });
          }
          url = url.replace(\`{\${field.wire}}\`, encodeURIComponent(String(value)));
        }

        const body: IDataObject = {};
        for (const field of route.body) {
          const value = read(field);
          // An unset optional field is left out rather than sent empty:
          // \`notebook_id: ""\` asks the server for a notebook named empty
          // string, which is not the same request as not naming one.
          if (value !== undefined) body[field.wire] = value as IDataObject[string];
          else if (field.required) {
            throw new NodeOperationError(this.getNode(), \`\${field.wire} is required\`, {
              itemIndex: i,
            });
          }
        }

        const qs: IDataObject = {};
        for (const field of route.query) {
          const value = read(field);
          if (value !== undefined) qs[field.wire] = value as IDataObject[string];
        }

        const credentials = await this.getCredentials('notebookLmApi');
        const response = (await this.helpers.httpRequestWithAuthentication.call(
          this,
          'notebookLmApi',
          {
            method: route.method,
            baseURL: String(credentials.baseUrl ?? 'http://127.0.0.1:3000').replace(/\\/$/, ''),
            url,
            ...(Object.keys(body).length > 0 ? { body } : {}),
            ...(Object.keys(qs).length > 0 ? { qs } : {}),
            json: true,
          }
        )) as IDataObject;

        // The envelope carries the refusal, so the HTTP status is not
        // consulted: a refused call answers 4xx *and* success: false, and the
        // body is the half that says why.
        let payload: IDataObject = response;
        if (route.enveloped) {
          if (response.success !== true) {
            throw new NodeOperationError(
              this.getNode(),
              String(response.error ?? 'the server refused the request'),
              { itemIndex: i }
            );
          }
          payload = (response.data ?? {}) as IDataObject;
        }

        out.push({ json: payload, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw error;
      }
    }

    return [out];
  }
}
`;
}

/**
 * Hand the output to prettier before writing or comparing it.
 *
 * Without this the commit hook reformats what the generator just wrote, and
 * `--check` then reports drift on every run — a guard that cries wolf is a
 * guard people switch off. Same reason the Rust generator pipes through
 * rustfmt.
 */
function formatted(source) {
  try {
    return execFileSync('npx', ['prettier', '--parser', 'typescript'], {
      input: source,
      encoding: 'utf-8',
      cwd: ROOT,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `prettier could not format the generated node, so it cannot be compared ` +
        `against what is on disk: ${error.message}`
    );
  }
}

function main() {
  const spec = parse(readFileSync(SPEC, 'utf-8'));
  const source = formatted(build(spec));
  const count = (source.match(/^  '[a-z]+:[a-z_]+': \{$/gm) ?? []).length;
  if (process.argv.includes('--check')) {
    const current = readFileSync(OUT, 'utf-8').replace(/\r\n/g, '\n');
    if (current !== source) {
      console.error(`DRIFT: ${OUT} is not what the specification generates.`);
      console.error('Run: npm run n8n:sync');
      process.exit(1);
    }
    console.log(`n8n node up to date — ${count} operations`);
    return;
  }
  writeFileSync(OUT, source);
  console.log(`wrote ${OUT} — ${count} operations`);
}

if (process.argv[1] && join(process.argv[1]) === fileURLToPath(import.meta.url)) main();
