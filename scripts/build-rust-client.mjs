#!/usr/bin/env node
/**
 * Generate the Rust client's typed surface from the OpenAPI specification.
 *
 * The seven methods this crate started with were written by hand, which meant
 * a route added tomorrow would not reach a Rust caller and no guard would
 * notice — the same defect as every other hand-maintained copy in this
 * repository: the published specification frozen at 1.5.9, the release list
 * stuck at 3.0.1, the manual that described nothing. So the surface is
 * generated, and `--check` fails the build when the file on disk is not what
 * the specification produces.
 *
 * What it emits, into crates/notebooklm-client/src/generated.rs:
 *   - one struct per named component schema, and per inline request body,
 *     query block and nested object, named after the operation that owns it;
 *   - one async method per operation on `Client`, taking its path parameters,
 *     its body and its query block, and returning the `data` the envelope
 *     carries.
 *
 * Usage:
 *   node scripts/build-rust-client.mjs           # write the file
 *   node scripts/build-rust-client.mjs --check   # exit 1 if it would change
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = join(ROOT, 'deployment', 'docs', 'openapi.yaml');
const OUT = join(ROOT, 'crates', 'notebooklm-client', 'src', 'generated.rs');
const OUT_BLOCKING = join(ROOT, 'crates', 'notebooklm-client', 'src', 'blocking.rs');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const pascal = (s) =>
  s
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');

/** Rust keywords a wire name can collide with. */
const KEYWORDS = new Set([
  'type',
  'ref',
  'match',
  'continue',
  'break',
  'self',
  'move',
  'box',
  'final',
  'macro',
]);

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** A field name Rust accepts, plus the serde rename when it differs. */
function fieldName(wire) {
  let name = snake(wire).replace(/[^a-z0-9_]/g, '_');
  if (/^[0-9]/.test(name)) name = `n${name}`;
  if (KEYWORDS.has(name)) name = `${name}_`;
  return name;
}

const structs = new Map();

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
 * Turn a schema into a Rust type, registering a struct for every object.
 * `hint` names the struct when the schema is inline and therefore anonymous.
 */
function rustType(schema, hint, spec, outgoing = false) {
  const { target, name } = deref(schema, spec);
  if (name) return rustType(target, name, spec, outgoing);
  if (!target || Object.keys(target).length === 0) return 'serde_json::Value';

  // `type: [integer, 'null']` is how the specification says "an integer, or
  // absent". Filtering leaves a one-element array, and comparing an array to
  // 'integer' is false — which silently produced an untyped value where the
  // whole point was to keep the integer.
  const t = Array.isArray(target.type) ? target.type.filter((x) => x !== 'null')[0] : target.type;
  const nullable = Array.isArray(target.type) && target.type.includes('null');

  let out;
  if (t === 'string') out = 'String';
  else if (t === 'integer') out = 'i64';
  else if (t === 'number') out = 'f64';
  else if (t === 'boolean') out = 'bool';
  else if (t === 'array')
    out = `Vec<${rustType(target.items ?? {}, `${hint}Item`, spec, outgoing)}>`;
  else if (t === 'object' && target.properties) out = registerStruct(hint, target, spec, outgoing);
  else out = 'serde_json::Value';

  return nullable ? `Option<${out}>` : out;
}

/**
 * `outgoing` marks a struct the caller sends rather than receives, and the two
 * directions want opposite defaults.
 *
 * A field we receive is better non-optional with `serde(default)`: the server
 * sends it in practice, and a caller should not unwrap an Option to read an
 * answer. A field we send must be absent when unset — serialising
 * `notebook_id: ""` asks the server for a notebook named empty string, which
 * is not the same request as not naming one.
 */
function registerStruct(name, schema, spec, outgoing = false) {
  if (structs.has(name)) return name;
  structs.set(name, null); // reserve, so a self-reference terminates
  const required = new Set(schema.required ?? []);
  const fields = [];
  for (const [wire, prop] of Object.entries(schema.properties ?? {})) {
    const field = fieldName(wire);
    let type = rustType(prop, name + pascal(wire), spec, outgoing);
    if (outgoing && !required.has(wire) && !type.startsWith('Option<')) type = `Option<${type}>`;
    const { target } = deref(prop, spec);
    const doc = typeof target?.description === 'string' ? target.description : null;
    fields.push({ wire, field, type, doc, required: required.has(wire) });
  }
  structs.set(name, { name, fields, doc: schema.description ?? null, outgoing });
  return name;
}

function docComment(text, pad) {
  if (!text) return [];
  return String(text)
    .trim()
    .split('\n')
    .map((line) => `${pad}/// ${line.trim()}`.trimEnd());
}

function renderStruct(s) {
  const lines = [];
  lines.push(...docComment(s.doc, ''));
  lines.push('#[derive(Debug, Clone, Default, Serialize, Deserialize)]');
  // `non_exhaustive` is right for what we receive — a field the server adds
  // later must not break a caller's match — and wrong for what the caller
  // sends, because it would stop them building the request at all.
  if (!s.outgoing) lines.push('#[non_exhaustive]');
  lines.push(`pub struct ${s.name} {`);
  for (const f of s.fields) {
    lines.push(...docComment(f.doc, '    '));
    if (f.wire !== f.field) lines.push(`    #[serde(rename = "${f.wire}")]`);
    const optional = f.type.startsWith('Option<');
    lines.push(
      optional
        ? '    #[serde(default, skip_serializing_if = "Option::is_none")]'
        : '    #[serde(default)]'
    );
    lines.push(`    pub ${f.field}: ${f.type},`);
  }
  lines.push('}');
  return lines.join('\n');
}

export function build(spec) {
  structs.clear();
  const calls = [];

  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = item?.[method];
      if (!op?.operationId) continue;
      const id = op.operationId;
      const Op = pascal(id);

      const params = op.parameters ?? [];
      const pathParams = params.filter((p) => p.in === 'path');
      const queryParams = params.filter((p) => p.in === 'query');

      // The response schema wraps the envelope; the caller wants the payload.
      const resSchema = (op.responses?.['200'] ?? op.responses?.['201'])?.content?.[
        'application/json'
      ]?.schema;
      const { target: res, name: resName } = deref(resSchema ?? {}, spec);
      let returns;
      let enveloped = Boolean(res?.properties?.data);
      if (enveloped) {
        returns = rustType(res.properties.data, `${Op}Data`, spec);
      } else {
        // Not enveloped: the body itself is the answer.
        returns = resName ? registerStruct(resName, res, spec) : rustType(res ?? {}, Op, spec);
      }

      let bodyType = null;
      const bodySchema = op.requestBody?.content?.['application/json']?.schema;
      if (bodySchema) {
        const { name } = deref(bodySchema, spec);
        bodyType = name ?? rustType(bodySchema, `${Op}Request`, spec, true);
        if (name) rustType(bodySchema, name, spec, true);
      }

      let queryType = null;
      if (queryParams.length) {
        queryType = `${Op}Query`;
        structs.set(queryType, {
          name: queryType,
          doc: `Query parameters for [\`Client::${id}\`].`,
          fields: queryParams.map((p) => ({
            wire: p.name,
            field: fieldName(p.name),
            type: `Option<${rustType(p.schema ?? { type: 'string' }, queryType + pascal(p.name), spec, true)}>`,
            doc: p.description ?? null,
            required: false,
          })),
        });
      }

      calls.push({
        id,
        Op,
        method: method.toUpperCase(),
        path,
        pathParams: pathParams.map((p) => fieldName(p.name)),
        pathTemplate: path.replace(/\{(\w+)\}/g, (_, n) => `{${fieldName(n)}}`),
        bodyType,
        queryType,
        returns,
        enveloped,
        summary: op.summary ?? null,
        description: op.description ?? null,
      });
    }
  }

  const header = `// @generated by scripts/build-rust-client.mjs from
// deployment/docs/openapi.yaml — do not edit by hand. Run \`npm run rust:sync\`.
//
// A hand-written client stops at the routes someone remembered. This one is
// the specification, so a new operation reaches a Rust caller on the release
// that ships it.

// Field names mirror the wire, and a description only exists where the
// specification carries one — so the missing-docs lint is allowed here and
// nowhere else in the crate.
#![allow(
    missing_docs,
    clippy::too_many_arguments,
    clippy::doc_markdown,
    clippy::struct_excessive_bools
)]

use serde::{Deserialize, Serialize};

use crate::client::Client;
use crate::error::Result;
`;

  const body = [...structs.values()].filter(Boolean).map(renderStruct).join('\n\n');

  const impls = calls
    .map((c) => {
      const args = ['&self'];
      for (const p of c.pathParams) args.push(`${p}: &str`);
      if (c.bodyType) args.push(`body: &${c.bodyType}`);
      if (c.queryType) args.push(`query: &${c.queryType}`);
      const doc = [
        ...docComment(c.summary, '    '),
        ...(c.summary && c.description ? ['    ///'] : []),
        ...docComment(c.description, '    '),
        `    /// `,
        `    /// \`${c.method} ${c.path}\``,
      ];
      const route = c.pathParams.length ? `&format!("${c.pathTemplate}")` : `"${c.pathTemplate}"`;
      // Not every route wears the envelope.
      const send = c.enveloped
        ? c.bodyType
          ? 'self.send_json('
          : 'self.send_empty('
        : 'self.send_raw(';
      return [
        ...doc,
        `    pub async fn ${c.id}(${args.join(', ')}) -> Result<${c.returns}> {`,
        `        ${send}`,
        `            "${c.id}",`,
        `            reqwest::Method::${c.method},`,
        `            ${route},`,
        ...(c.enveloped
          ? [c.bodyType ? '            Some(body),' : '            None::<&()>,']
          : []),
        c.queryType ? `            Some(query),` : `            None::<&()>,`,
        `        )`,
        `        .await`,
        `    }`,
      ].join('\n');
    })
    .join('\n\n');

  const asyncFile = `${header}\n${body}\n\nimpl Client {\n${impls}\n}\n`;

  const blockingHeader = `// @generated by scripts/build-rust-client.mjs — do not edit by hand.
//
// The synchronous twin, for programs with no runtime. It owns a
// current-thread runtime and blocks on the asynchronous calls, which is the
// honest way round: those are the real ones. Do not call these from inside an
// async context — use [\`crate::Client\`] there.

// One import of the generated types rather than ninety names.
#![allow(clippy::too_many_arguments, clippy::doc_markdown, clippy::wildcard_imports)]

use crate::error::{Error, Result};
use crate::generated::*;

/// The blocking twin of [\`crate::Client\`], with the same calls.
#[derive(Debug)]
pub struct Client {
    inner: crate::Client,
    runtime: tokio::runtime::Runtime,
}

impl Client {
    /// A blocking client for a server on the given address.
    pub fn new(base: impl Into<String>) -> Result<Self> {
        Self::from_async(crate::Client::new(base)?)
    }

    /// A blocking client for the usual loopback address and port.
    pub fn local() -> Result<Self> {
        Self::from_async(crate::Client::local()?)
    }

    /// Wrap a configured asynchronous client, so the builder needs no twin.
    pub fn from_async(inner: crate::Client) -> Result<Self> {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(Error::Runtime)?;
        Ok(Self { inner, runtime })
    }
`;

  const blockingImpls = calls
    .map((c) => {
      const args = ['&self'];
      const pass = [];
      for (const p of c.pathParams) {
        args.push(`${p}: &str`);
        pass.push(p);
      }
      if (c.bodyType) {
        args.push(`body: &${c.bodyType}`);
        pass.push('body');
      }
      if (c.queryType) {
        args.push(`query: &${c.queryType}`);
        pass.push('query');
      }
      return [
        `    /// See [\`crate::Client::${c.id}\`].`,
        `    pub fn ${c.id}(${args.join(', ')}) -> Result<${c.returns}> {`,
        `        self.runtime.block_on(self.inner.${c.id}(${pass.join(', ')}))`,
        `    }`,
      ].join('\n');
    })
    .join('\n\n');

  return { asyncFile, blockingFile: `${blockingHeader}\n${blockingImpls}\n}\n` };
}

/**
 * Hand the output to rustfmt before writing or comparing it.
 *
 * Without this, `cargo fmt` reformats what the generator just wrote and
 * `--check` then reports drift on every run — a guard that cries wolf is a
 * guard people switch off.
 */
function formatted(source) {
  try {
    return execFileSync('rustfmt', ['--edition', '2021', '--emit', 'stdout', '--quiet'], {
      input: source,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `rustfmt could not format the generated client, so it cannot be compared ` +
        `against what is on disk: ${error.message}`
    );
  }
}

function main() {
  const spec = parse(readFileSync(SPEC, 'utf-8'));
  const built = build(spec);
  const asyncFile = formatted(built.asyncFile);
  const blockingFile = formatted(built.blockingFile);
  const count = (asyncFile.match(/pub async fn /g) ?? []).length;
  if (process.argv.includes('--check')) {
    for (const [file, expected] of [
      [OUT, asyncFile],
      [OUT_BLOCKING, blockingFile],
    ]) {
      const current = readFileSync(file, 'utf-8').replace(/\r\n/g, '\n');
      if (current !== expected) {
        console.error(`DRIFT: ${file} is not what the specification generates.`);
        console.error('Run: npm run rust:sync');
        process.exit(1);
      }
    }
    console.log(`rust client up to date — ${count} operations`);
    return;
  }
  writeFileSync(OUT, asyncFile);
  writeFileSync(OUT_BLOCKING, blockingFile);
  console.log(`wrote both files — ${count} operations, ${structs.size} types`);
}

if (process.argv[1] && join(process.argv[1]) === fileURLToPath(import.meta.url)) main();
