#!/usr/bin/env node
/**
 * Build the UTCP manual from the OpenAPI specification.
 *
 * UTCP has no protocol server: a client reads a manual and then calls the
 * native API directly. A client can also convert our OpenAPI document itself
 * — but only operations carrying an `operationId` survive that conversion,
 * and the converter understands `apiKey`, `basic` and `oauth2` security
 * schemes, not the `http`/`bearer` one we declare. Auto-conversion therefore
 * produces a manual whose every call is unauthenticated.
 *
 * So we publish our own manual, generated from the same specification, with
 * the key declared the way the reference client actually implements it:
 * `auth_type: "api_key"` in the `X-API-Key` header, which our server already
 * accepts alongside the bearer form.
 *
 * Field names are taken from the reference client's source
 * (universal-tool-calling-protocol/python-utcp, MIT), not from the prose
 * docs: the RFC Draft 1.0.0 and the published docs disagree on them. Ground
 * truth, read 2026-11-06:
 *   core/src/utcp/data/utcp_manual.py        → utcp_version, manual_version, tools
 *   core/src/utcp/data/tool.py               → name, description, inputs, outputs,
 *                                              tags, tool_call_template
 *   core/src/utcp/data/call_template.py      → call_template_type discriminator
 *   .../http/src/utcp_http/http_call_template.py → url, http_method, body_field,
 *                                              header_fields, content_type
 *   core/src/utcp/data/auth_implementations/api_key_auth.py
 *                                            → auth_type/api_key/var_name/location
 *
 * `--check` regenerates and fails on any difference, so the manual cannot
 * drift behind the specification.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = join(ROOT, 'deployment', 'docs', 'openapi.yaml');
const OUT = join(ROOT, 'deployment', 'docs', 'utcp.json');

/**
 * Base the manual's URLs on a placeholder rather than a real address. The
 * server rewrites it per request from the address the caller reached it on,
 * so one published manual serves a loopback install and a reverse-proxied
 * one alike. A client reading the static file still gets a working default.
 */
export const BASE_PLACEHOLDER = 'http://localhost:3000';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** The manual's one-line description of a tool. */
function describe(op) {
  const summary = typeof op.summary === 'string' ? op.summary.trim() : '';
  if (summary) return summary;
  const long = typeof op.description === 'string' ? op.description.trim() : '';
  return long.split('\n')[0] ?? '';
}

/** The JSON Schema of an operation's request body, if it declares one. */
function bodySchema(op) {
  const json = op.requestBody?.content?.['application/json'];
  return json?.schema ?? null;
}

/**
 * An operation's inputs, in the shape the client expects.
 *
 * Path and query parameters become named properties. A request body becomes a
 * single `body` property holding its whole schema — that is what
 * `body_field` points at, and it is how the reference converter does it too,
 * so an agent still reads the real field names from the nested schema.
 */
function inputsOf(op) {
  const properties = {};
  const required = [];
  const headerFields = [];

  for (const p of op.parameters ?? []) {
    if (p.in === 'header') {
      headerFields.push(p.name);
      continue;
    }
    if (p.in !== 'path' && p.in !== 'query') continue;
    properties[p.name] = { ...(p.schema ?? { type: 'string' }), description: p.description };
    if (p.description === undefined) delete properties[p.name].description;
    if (p.required) required.push(p.name);
  }

  const body = bodySchema(op);
  if (body) {
    properties.body = body;
    if (op.requestBody.required) required.push('body');
  }

  const inputs = { type: 'object', properties };
  if (required.length) inputs.required = required;
  return { inputs, headerFields, hasBody: Boolean(body) };
}

/** The successful response's schema, when the specification gives one. */
/**
 * Resolve every `$ref` against the specification's own components.
 *
 * A manual is a standalone document: it carries no components section, so a
 * reference that leaves the specification is a reference its reader cannot
 * follow. Shipping one looked fine in the file and described nothing at all.
 *
 * Cycles are broken with a plain object rather than by recursing forever —
 * none exist today, and a schema that referred to itself would otherwise hang
 * the release instead of failing it.
 */
function deref(node, spec, seen = new Set()) {
  if (Array.isArray(node)) return node.map((n) => deref(n, spec, seen));
  if (!node || typeof node !== 'object') return node;

  if (typeof node.$ref === 'string') {
    const path = node.$ref.replace(/^#\//, '').split('/');
    if (seen.has(node.$ref)) return { type: 'object' };
    let target = spec;
    for (const step of path) target = target?.[step];
    if (target === undefined) {
      throw new Error(
        `${node.$ref} is referenced but not defined, so the manual would describe nothing there.`
      );
    }
    const next = new Set(seen);
    next.add(node.$ref);
    const { $ref, ...siblings } = node;
    return { ...deref(target, spec, next), ...deref(siblings, spec, next) };
  }

  const out = {};
  for (const [key, value] of Object.entries(node)) out[key] = deref(value, spec, seen);
  return out;
}

function outputsOf(op, spec) {
  const responses = op.responses ?? {};
  const ok = responses['200'] ?? responses['201'] ?? responses.default;
  const schema = ok?.content?.['application/json']?.schema;
  return schema ? deref(schema, spec) : { type: 'object' };
}

export function buildManual(spec, version) {
  const tools = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = item?.[method];
      if (!op) continue;
      if (!op.operationId) {
        throw new Error(
          `${method.toUpperCase()} ${path} has no operationId. A UTCP client drops an unnamed ` +
            `operation outright, so an unnamed route is an invisible one.`
        );
      }
      const { inputs, headerFields, hasBody } = inputsOf(op);
      const template = {
        name: op.operationId,
        call_template_type: 'http',
        http_method: method.toUpperCase(),
        url: `${BASE_PLACEHOLDER}${path}`,
        content_type: 'application/json',
        auth: {
          auth_type: 'api_key',
          // A literal `${VAR}` is how the client asks for a value from the
          // environment. Writing the key itself here would publish it.
          api_key: '${NOTEBOOKLM_API_KEY}',
          var_name: 'X-API-Key',
          location: 'header',
        },
      };
      if (hasBody) template.body_field = 'body';
      if (headerFields.length) template.header_fields = headerFields;

      tools.push({
        name: op.operationId,
        description: describe(op),
        tags: op.tags ?? [],
        // The request body is a reference too, and a manual carries no
        // components for its reader to follow.
        inputs: deref(inputs, spec),
        outputs: outputsOf(op, spec),
        tool_call_template: template,
      });
    }
  }

  const names = tools.map((t) => t.name);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate) throw new Error(`Two operations are both named ${duplicate}.`);

  return { utcp_version: '1.0.0', manual_version: version, tools };
}

/**
 * Only when run as a command. The build rules above are imported by tests,
 * which must not read or rewrite the published manual as a side effect.
 */
function main() {
  const spec = parse(readFileSync(SPEC, 'utf-8'));
  const manual = buildManual(spec, spec.info.version);
  const serialized = JSON.stringify(manual, null, 2) + '\n';

  if (process.argv.includes('--check')) {
    const current = readFileSync(OUT, 'utf-8').replace(/\r\n/g, '\n');
    if (current !== serialized) {
      console.error('DRIFT: deployment/docs/utcp.json is not what the specification generates.');
      console.error('Run `npm run utcp:sync` and commit the result.');
      process.exit(1);
    }
    console.log(
      `utcp manual up to date \u2014 ${manual.tools.length} tools, version ${spec.info.version}`
    );
  } else {
    writeFileSync(OUT, serialized);
    console.log(`wrote ${OUT} \u2014 ${manual.tools.length} tools, version ${spec.info.version}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
