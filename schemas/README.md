# JSON Schemas

Local copies of JSON Schemas published by this project. Each file's canonical,
immutable `$id` URL lives at `https://schemas.roomi-fields.com/`.

The version in this directory is the **source of truth** for what the schema
declares; the published copy is built from it.

## Schemas

| File                                           | Canonical URL                                                                                        | Description                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`nblm-answer-v1.json`](./nblm-answer-v1.json) | [schemas.roomi-fields.com/nblm-answer-v1.json](https://schemas.roomi-fields.com/nblm-answer-v1.json) | Sidecar payload produced by `/batch-to-vault`: one NotebookLM answer with citations, source excerpts and session metadata. |

## Conventions

- `$id` URLs are immutable. Breaking changes publish a new file (`…-v2.json`).
- Draft: JSON Schema 2020-12.
- License: MIT.

## Publishing flow

The `nblm-answer-v1.json` file is mirrored as a static asset on the public
site at [schemas.roomi-fields.com/nblm-answer-v1.json](https://schemas.roomi-fields.com/nblm-answer-v1.json). When updating
the schema:

1. Edit the file in this directory.
2. Update the inline reference in [`deployment/docs/14-RTFM-INTEGRATION.md`](../deployment/docs/14-RTFM-INTEGRATION.md) so it stays in sync.
3. Republish the asset to `schemas.roomi-fields.com`.
4. If the change is breaking, do **not** mutate the existing file — bump to
   `nblm-answer-v2.json` and publish alongside.

The runtime constant `NBLM_ANSWER_SCHEMA_URL` in
[`src/utils/vault-writer.ts`](../src/utils/vault-writer.ts) points at the
published canonical URL.
