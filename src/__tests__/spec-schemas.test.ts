/**
 * Every operation must say what it answers.
 *
 * For most of this project's life the published specification typed 6 of its
 * 56 responses, and the six it did type were wrong: the health report claimed
 * an uptime and a version it has never sent, and the answer route claimed
 * citations shaped `id`/`source`/`excerpt` when the server sends
 * `marker`/`number`/`sourceText`.
 *
 * The cost was invisible from inside the repository, because our guards
 * counted routes rather than reading them. A generated client — Ruby, Python,
 * Go, any of them — compiled, called the right address, and threw the body
 * away: 50 of 56 methods returned nothing at all. The UTCP manual, which
 * derives its outputs from the same place, described nothing either.
 *
 * So: a response without a schema fails the build, and a manual that points
 * outside itself fails it too.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

type Operation = {
  operationId?: string;
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
};

const spec = parse(read('deployment/docs/openapi.yaml')) as {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
};

const operations = Object.values(spec.paths).flatMap((item) =>
  Object.values(item).filter((op): op is Operation => Boolean(op?.operationId))
);

const okResponse = (op: Operation) => op.responses?.['200'] ?? op.responses?.['201'];

describe('the published specification', () => {
  it('declares every operation', () => {
    expect(operations.length).toBe(56);
  });

  it.each(operations.map((op) => [op.operationId as string, op] as const))(
    '%s says what it answers',
    (_name, op) => {
      const schema = okResponse(op)?.content?.['application/json']?.schema;
      expect(schema).toBeDefined();
    }
  );

  it('keeps no schema that nothing references', () => {
    const body = read('deployment/docs/openapi.yaml');
    const unreferenced = Object.keys(spec.components.schemas).filter(
      (name) => !body.includes(`#/components/schemas/${name}'`)
    );
    // A schema nobody points at is a shape nobody maintains, and the two we
    // had were both wrong by the time anyone looked.
    expect(unreferenced).toEqual([]);
  });
});

describe('the UTCP manual it generates', () => {
  const manual = read('deployment/docs/utcp.json');
  const parsed = JSON.parse(manual) as {
    tools: {
      name: string;
      inputs?: { properties?: unknown };
      outputs?: { properties?: unknown };
    }[];
  };

  it('resolves every reference, because its reader has no components to follow', () => {
    expect(manual).not.toContain('$ref');
  });

  it.each(parsed.tools.map((t) => [t.name, t] as const))('%s describes its output', (_n, tool) => {
    expect(tool.outputs?.properties).toBeDefined();
  });
});
