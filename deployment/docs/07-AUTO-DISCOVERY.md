# Auto-Discovery Pattern

Auto-discovery lets the server ask NotebookLM to summarize a notebook and generate lightweight metadata for local matching.

This is useful when an AI orchestrator needs to decide which notebook to query before spending a rate-limited NotebookLM request on a deeper question.

---

## Progressive Disclosure Model

### Level 0 - Local metadata registry

Lightweight metadata is stored in `library.json`.

This gives:

- fast startup
- local filtering without NotebookLM requests
- a compact index of notebook descriptions, tags, and names

### Level 1 - Local matching

The orchestrator matches a task against metadata.

Example:

- task: `gmail automation`
- likely match: notebook tags such as `gmail`, `n8n`, `automation`

This step is local and does not spend NotebookLM quota.

### Level 2 - Deep notebook query

After choosing the best notebook, the agent runs a real NotebookLM query for precise answers.

This step is rate-limited and should happen only after local matching narrows the scope.

---

## What Auto-Discovery Generates

The server prompts NotebookLM to return structured JSON such as:

```json
{
  "name": "n8n-workflows-api",
  "description": "Complete n8n API documentation covering workflow creation and node configuration.",
  "tags": ["n8n", "api", "workflows", "automation", "webhooks", "nodes"]
}
```

Validation goals:

- `name` should be kebab-case
- `description` should stay short
- `tags` should be relevant and compact

---

## Why This Helps AI Agents

Benefits:

- fewer wasted NotebookLM calls
- faster notebook selection
- better default routing for multi-notebook libraries
- easier "find the right notebook first" behavior for MCP clients and HTTP orchestrators

---

## Typical Workflow

1. add a notebook URL to the local library
2. call auto-discovery
3. store the generated metadata locally
4. match future tasks against the metadata
5. query the selected notebook only when needed

---

## Testing Auto-Discovery

Use your own accessible notebook URL.

Example:

```powershell
.\deployment\scripts\test-auto-discovery.ps1 -NotebookUrl "https://notebooklm.google.com/notebook/<your-notebook-id>"
```

You can also provide multiple notebook URLs through the environment for batch testing:

```powershell
$env:AUTO_DISCOVERY_NOTEBOOKS = "https://notebooklm.google.com/notebook/<id-1>,https://notebooklm.google.com/notebook/<id-2>"
.\deployment\scripts\test-auto-discovery.ps1 -TestAll
```

Expected results:

- the endpoint returns success
- the generated name is valid
- the description is short
- relevant tags are produced
- the notebook is added to the local library

---

## Common Failure Modes

### Invalid metadata format

NotebookLM returned something that does not satisfy the expected schema.

Typical next step:

- retry the request
- inspect the generated response
- tighten validation or prompt wording if needed

### Notebook is inaccessible

Typical causes:

- bad URL
- wrong signed-in account
- notebook permissions do not match the active account

Typical next step:

- verify the notebook manually in Chrome
- rerun auth if necessary

### NotebookLM times out

Typical causes:

- slow NotebookLM response
- transient UI delay
- stale session/auth

Typical next step:

- retry after confirming `/health`
- rerun auth if `authenticated` is false

---

## Relationship To MCP Skills

Auto-discovery is not the same thing as bundling static docs in a repo.

Difference:

- local skills/docs are free to inspect
- NotebookLM queries are remote and rate-limited
- auto-discovery helps reduce those remote calls by caching lightweight metadata locally

---

## Future Extensions

Possible next steps:

- refresh metadata when notebook contents change
- add semantic matching on top of tags/descriptions
- surface "related notebooks" from local usage analytics
