#!/usr/bin/env node
/**
 * Generate the Ruby gem's surface from the OpenAPI specification.
 *
 * Same reasoning as the Rust generator next to it: a hand-written client
 * stops at the routes someone remembered, and every hand-maintained copy in
 * this repository has drifted at least once — the published specification
 * frozen at 1.5.9, the release list stuck at 3.0.1, the manual that described
 * nothing. So the surface is generated, and `--check` fails the build when
 * the file on disk is not what the specification produces.
 *
 * What it emits, into gems/notebooklm/lib/notebooklm/generated.rb:
 *   - one class per received shape, with a documented reader for every field
 *     the specification describes, named after the operation that owns it;
 *   - one method per operation, taking its path parameters, its body fields
 *     and its query parameters as keyword arguments, and returning the shape
 *     the envelope carries.
 *
 * Usage:
 *   node scripts/build-ruby-client.mjs           # write the file
 *   node scripts/build-ruby-client.mjs --check   # exit 1 if it would change
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = join(ROOT, 'deployment', 'docs', 'openapi.yaml');
const OUT = join(ROOT, 'gems', 'notebooklm', 'lib', 'notebooklm', 'generated.rb');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const pascal = (s) =>
  s
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');

const snake = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');

/** Ruby keywords and Object methods a wire name must not shadow. */
const RESERVED = new Set([
  'class',
  'def',
  'end',
  'if',
  'then',
  'else',
  'begin',
  'next',
  'break',
  'retry',
  'return',
  'self',
  'nil',
  'true',
  'false',
  'and',
  'or',
  'not',
  'do',
  'while',
  'until',
  'for',
  'in',
  'yield',
  'super',
  'alias',
  'undef',
  'module',
  'hash',
  'method',
  'send',
  'class_name',
  'raw',
  'to_h',
  'inspect',
  'freeze',
  'display',
]);

/** A reader name Ruby accepts and that shadows nothing. */
function fieldName(wire) {
  let name = snake(wire);
  if (!name) name = 'value';
  if (/^[0-9]/.test(name)) name = `n${name}`;
  if (RESERVED.has(name)) name = `${name}_value`;
  return name;
}

const shapes = new Map();

function deref(node, spec) {
  if (node && typeof node === 'object' && typeof node.$ref === 'string') {
    const path = node.$ref.replace(/^#\//, '').split('/');
    let target = spec;
    for (const step of path) target = target?.[step];
    if (!target) throw new Error(`${node.$ref} is referenced but not defined.`);
    return { target, name: path[path.length - 1] };
  }
  return { target: node, name: null };
}

/**
 * Describe a received schema: the YARD type to document, and the shape class
 * to coerce into, if any. `hint` names the class when the schema is inline
 * and therefore anonymous.
 */
function received(schema, hint, spec) {
  const { target, name } = deref(schema, spec);
  if (name) return received(target, name, spec);
  if (!target || Object.keys(target).length === 0) return { doc: 'Object', klass: null };

  // `type: [integer, 'null']` is how the specification says "an integer, or
  // absent". Filtering leaves a one-element array, so take its first entry —
  // comparing an array to 'integer' is false, and silently produced an
  // untyped value where the whole point was to keep the integer.
  const t = Array.isArray(target.type) ? target.type.filter((x) => x !== 'null')[0] : target.type;
  // A field the specification marks as possibly absent is documented as such,
  // rather than leaving the reader to discover the nil at runtime.
  const orNil = Array.isArray(target.type) && target.type.includes('null') ? ', nil' : '';

  if (t === 'string') return { doc: `String${orNil}`, klass: null };
  if (t === 'integer') return { doc: `Integer${orNil}`, klass: null };
  if (t === 'number') return { doc: `Float${orNil}`, klass: null };
  if (t === 'boolean') return { doc: `Boolean${orNil}`, klass: null };
  if (t === 'array') {
    const item = received(target.items ?? {}, `${hint}Item`, spec);
    return { doc: `Array<${item.doc}>`, klass: item.klass, array: true };
  }
  if (t === 'object' && target.properties) {
    const klass = registerShape(hint, target, spec);
    return { doc: klass, klass };
  }
  return { doc: 'Object', klass: null };
}

function registerShape(name, schema, spec) {
  if (shapes.has(name)) return name;
  shapes.set(name, null); // reserve, so a self-reference terminates
  const fields = [];
  for (const [wire, prop] of Object.entries(schema.properties ?? {})) {
    const { target } = deref(prop, spec);
    const info = received(prop, name + pascal(wire), spec);
    fields.push({
      wire,
      field: fieldName(wire),
      doc: info.doc,
      klass: info.klass,
      array: Boolean(info.array),
      description: typeof target?.description === 'string' ? target.description : null,
    });
  }
  shapes.set(name, { name, fields, description: schema.description ?? null });
  return name;
}

/** The YARD type for something the caller sends. */
function sent(schema, spec) {
  const { target } = deref(schema ?? {}, spec);
  const t = Array.isArray(target?.type) ? target.type.filter((x) => x !== 'null')[0] : target?.type;
  if (t === 'string') return 'String';
  if (t === 'integer') return 'Integer';
  if (t === 'number') return 'Float';
  if (t === 'boolean') return 'Boolean';
  if (t === 'array') return `Array<${sent(target.items ?? {}, spec)}>`;
  if (t === 'object') return 'Hash';
  return 'Object';
}

function comment(text, pad) {
  if (!text) return [];
  return String(text)
    .trim()
    .split('\n')
    .map((line) => `${pad}# ${line.trim()}`.trimEnd());
}

function renderShape(s) {
  const lines = [];
  lines.push(...comment(s.description ?? `The \`${s.name}\` shape.`, '  '));
  lines.push(`  class ${s.name} < Model`);
  for (const f of s.fields) {
    lines.push(...comment(f.description, '    '));
    lines.push(`    # @return [${f.doc}]`);
    const args = [`:${f.field}`, `'${f.wire}'`];
    if (f.klass) args.push(`type: '${f.klass}'`);
    if (f.array) args.push('array: true');
    lines.push(`    field ${args.join(', ')}`);
  }
  if (s.fields.length === 0) {
    lines.push('    # The specification documents no field on this shape yet; the body is');
    lines.push('    # still readable with `[]` and `to_h`.');
  }
  lines.push('  end');
  return lines.join('\n');
}

export function build(spec) {
  shapes.clear();
  const calls = [];

  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = item?.[method];
      if (!op?.operationId) continue;
      const id = op.operationId;
      const Op = pascal(id);

      const params = op.parameters ?? [];
      const taken = new Set();
      const argOf = (wire) => {
        let name = fieldName(wire);
        while (taken.has(name)) name = `${name}_`;
        taken.add(name);
        return name;
      };

      const pathParams = params
        .filter((p) => p.in === 'path')
        .map((p) => ({
          wire: p.name,
          arg: argOf(p.name),
          doc: sent(p.schema ?? { type: 'string' }, spec),
          description: p.description ?? null,
        }));

      // The response schema wraps the envelope; the caller wants the payload.
      const resSchema = (op.responses?.['200'] ?? op.responses?.['201'])?.content?.[
        'application/json'
      ]?.schema;
      const { target: res, name: resName } = deref(resSchema ?? {}, spec);
      const enveloped = Boolean(res?.properties?.data);
      let returns;
      if (enveloped) {
        returns = received(res.properties.data, `${Op}Data`, spec);
      } else if (resName) {
        // Not enveloped: the body itself is the answer.
        const klass = registerShape(resName, res, spec);
        returns = { doc: klass, klass };
      } else {
        returns = received(res ?? {}, Op, spec);
      }

      const bodySchema = op.requestBody?.content?.['application/json']?.schema;
      const { target: bodyTarget } = deref(bodySchema ?? {}, spec);
      const bodyRequired = new Set(bodyTarget?.required ?? []);
      const bodyFields = Object.entries(bodyTarget?.properties ?? {}).map(([wire, prop]) => {
        const { target } = deref(prop, spec);
        return {
          wire,
          arg: argOf(wire),
          doc: sent(prop, spec),
          description: target?.description ?? null,
          required: bodyRequired.has(wire),
        };
      });

      const queryFields = params
        .filter((p) => p.in === 'query')
        .map((p) => ({
          wire: p.name,
          arg: argOf(p.name),
          doc: sent(p.schema ?? { type: 'string' }, spec),
          description: p.description ?? null,
        }));

      calls.push({
        id,
        method,
        path,
        pathParams,
        bodyFields,
        queryFields,
        returns,
        enveloped,
        summary: op.summary ?? null,
        description: op.description ?? null,
      });
    }
  }

  const header = `# frozen_string_literal: true

# @generated by scripts/build-ruby-client.mjs from deployment/docs/openapi.yaml
# — do not edit by hand. Run \`npm run ruby:sync\`.
#
# A hand-written client stops at the routes someone remembered. This one is
# the specification, so a new operation reaches a Ruby caller on the release
# that ships it.

module NotebookLM`;

  const shapeSource = [...shapes.values()].filter(Boolean).map(renderShape).join('\n\n');

  const methodSource = calls
    .map((c) => {
      const required = [
        ...c.pathParams.map((p) => ({ ...p, required: true })),
        ...c.bodyFields.filter((f) => f.required),
      ];
      const optional = [...c.bodyFields.filter((f) => !f.required), ...c.queryFields];
      const signature = [
        ...required.map((p) => `${p.arg}:`),
        ...optional.map((p) => `${p.arg}: nil`),
      ];

      const doc = [
        ...comment(c.summary, '    '),
        ...(c.summary && c.description ? ['    #'] : []),
        ...comment(c.description, '    '),
        '    #',
        `    # \`${c.method.toUpperCase()} ${c.path}\``,
        '    #',
      ];
      const documented = [
        ...c.pathParams.map((p) => ({ ...p, required: true })),
        ...c.bodyFields,
        ...c.queryFields,
      ];
      for (const p of documented) {
        const type = p.required ? p.doc : `${p.doc}, nil`;
        const tail = p.description ? ` ${String(p.description).replace(/\s+/g, ' ').trim()}` : '';
        doc.push(`    # @param ${p.arg} [${type}]${tail}`);
      }
      doc.push(`    # @return [${c.returns.doc}]`);
      doc.push('    # @raise [NotebookLM::Refused] when the server declines the request');

      const body = [];
      const route = c.path.includes('{')
        ? `"${c.path.replace(/\{(\w+)\}/g, (_, n) => {
            const p = c.pathParams.find((x) => x.wire === n);
            return `#{${p ? p.arg : fieldName(n)}}`;
          })}"`
        : `'${c.path}'`;

      if (c.bodyFields.length) {
        body.push('      body = {}');
        for (const f of c.bodyFields) {
          body.push(
            f.required
              ? `      body['${f.wire}'] = ${f.arg}`
              : `      body['${f.wire}'] = ${f.arg} unless ${f.arg}.nil?`
          );
        }
      }
      if (c.queryFields.length) {
        body.push('      query = {}');
        for (const f of c.queryFields) {
          body.push(`      query['${f.wire}'] = ${f.arg} unless ${f.arg}.nil?`);
        }
      }

      const args = [`'${c.id}'`, `:${c.method}`, route];
      if (c.bodyFields.length) args.push('body: body');
      if (c.queryFields.length) args.push('query: query');
      if (!c.enveloped) args.push('enveloped: false');

      body.push(`      payload = call(${args.join(', ')})`);
      if (c.returns.klass && c.returns.array) {
        body.push(`      Array(payload).map { |item| ${c.returns.klass}.new(item) }`);
      } else if (c.returns.klass) {
        body.push(`      ${c.returns.klass}.new(payload)`);
      } else {
        body.push('      payload');
      }

      const open = signature.length
        ? `    def ${c.id}(${signature.join(', ')})`
        : `    def ${c.id}`;
      return [...doc, open, ...body, '    end'].join('\n');
    })
    .join('\n\n');

  const operations = `  # Every operation of the server's REST API.
  #
  # Included into {Client}, so these are called on a client rather than used
  # directly. They are listed here so that the documentation of the plumbing
  # and the documentation of the API stay separate things.
  module Operations
    # Every operation id, in specification order. The server exposes
    # ${calls.length} of them.
    OPERATION_IDS = %w[
${calls.map((c) => `      ${c.id}`).join('\n')}
    ].freeze

${methodSource}
  end

  class Client
    include Operations
  end
end
`;

  return `${header}\n${shapeSource}\n\n${operations}`;
}

function main() {
  const spec = parse(readFileSync(SPEC, 'utf-8'));
  const source = build(spec);
  const count = (source.match(/^    def /gm) ?? []).length;
  if (process.argv.includes('--check')) {
    const current = readFileSync(OUT, 'utf-8').replace(/\r\n/g, '\n');
    if (current !== source) {
      console.error(`DRIFT: ${OUT} is not what the specification generates.`);
      console.error('Run: npm run ruby:sync');
      process.exit(1);
    }
    console.log(`ruby client up to date — ${count} operations`);
    return;
  }
  writeFileSync(OUT, source);
  console.log(`wrote ${OUT} — ${count} operations, ${shapes.size} shapes`);
}

if (process.argv[1] && join(process.argv[1]) === fileURLToPath(import.meta.url)) main();
