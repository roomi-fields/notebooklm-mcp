---
title: NotebookLM in n8n — HTTP workflows with citations
description: Integrate NotebookLM into n8n workflows via the HTTP REST API. Webhook examples, scheduled queries, Slack integration, content generation flows, citation-backed responses.
keywords:
  [
    notebooklm n8n,
    n8n notebooklm integration,
    n8n http request notebooklm,
    notebooklm workflow automation,
    zapier notebooklm,
  ]
---

# n8n Integration - NotebookLM MCP HTTP Server

> Complete guide for integrating NotebookLM into your n8n workflows

---

## 🎯 Overview

This guide shows you how to query NotebookLM from n8n to create powerful automation workflows.

**What you'll learn:**

- HTTP Request node configuration
- Complete workflow examples
- Error handling
- Best practices

---

## 📋 Prerequisites

1. ✅ NotebookLM MCP HTTP server running on your Windows PC
2. ✅ n8n installed (Docker, npm, or cloud)
3. ✅ Network: Windows PC and n8n server can communicate

---

## 🔧 Basic Configuration

### Step 1: Find the Server IP

On the Windows PC where the server is running:

```powershell
ipconfig
```

Note the **IPv4** (e.g., `192.168.1.52`)

### Step 2: Test the Connection

From the n8n server:

```bash
curl http://192.168.1.52:3000/health
```

If it works, proceed to step 3. Otherwise, see [Troubleshooting](#-troubleshooting).

### Step 3: Create the HTTP Request Node in n8n

1. **Add a node** "HTTP Request"
2. **Configure:**
   - **Method:** `POST`
   - **URL:** `http://192.168.1.52:3000/ask`
   - **Authentication:** None
   - **Send Body:** Yes
   - **Body Content Type:** JSON
   - **Specify Body:** Using Fields Below

3. **Body Parameters (Add Field):**
   - `question` → Type: String → Value: `{{ $json.query }}`
   - `notebook_id` → Type: String → Value: `parents-numerique`

---

## 📚 Example Workflows

### Workflow 1: Webhook → NotebookLM → Response

**Use case:** REST API that queries NotebookLM

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ Webhook      │────▶│ HTTP Request   │────▶│ Respond      │
│ (Trigger)    │     │ (NotebookLM)   │     │ to Webhook   │
└──────────────┘     └────────────────┘     └──────────────┘
```

**Webhook Configuration:**

- Method: POST
- Path: `/ask-notebooklm`

**HTTP Request Configuration:**

- URL: `http://192.168.1.52:3000/ask`
- Body:
  ```json
  {
    "question": "{{ $json.body.question }}",
    "notebook_id": "{{ $json.body.notebook_id }}"
  }
  ```

**Respond Configuration:**

- Response Code: 200
- Response Body:
  ```json
  {
    "answer": "{{ $json.data.answer }}",
    "session_id": "{{ $json.data.session_id }}"
  }
  ```

**Test:**

```bash
curl -X POST http://n8n-server:5678/webhook/ask-notebooklm \
  -H "Content-Type: application/json" \
  -d '{"question":"Test","notebook_id":"parents-numerique"}'
```

---

### Workflow 2: Schedule → NotebookLM → Email

**Use case:** Automatic daily report

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ Schedule     │────▶│ HTTP Request   │────▶│ Send Email   │
│ (Cron)       │     │ (NotebookLM)   │     │              │
└──────────────┘     └────────────────┘     └──────────────┘
```

**Schedule Configuration:**

- Trigger Times: Cron Expression
- Expression: `0 9 * * 1-5` (9am Monday to Friday)

**HTTP Request Configuration:**

- URL: `http://192.168.1.52:3000/ask`
- Body:
  ```json
  {
    "question": "Quels sont les principaux conseils pour les parents?",
    "notebook_id": "parents-numerique"
  }
  ```

**Email Configuration:**

- To: `team@example.com`
- Subject: `Rapport Parents & Numérique - {{ $now.format('DD/MM/YYYY') }}`
- Text: `{{ $json.data.answer }}`

---

### Workflow 3: Form Submit → NotebookLM → Slack

**Use case:** Slack bot that answers questions

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ Slack        │────▶│ HTTP Request   │────▶│ Slack        │
│ (Trigger)    │     │ (NotebookLM)   │     │ (Send Msg)   │
└──────────────┘     └────────────────┘     └──────────────┘
```

**Slack Trigger Configuration:**

- Event: App Mention
- Workspace: Your workspace

**HTTP Request Configuration:**

- URL: `http://192.168.1.52:3000/ask`
- Body:
  ```json
  {
    "question": "{{ $json.event.text }}",
    "notebook_id": "parents-numerique"
  }
  ```

**Slack Send Configuration:**

- Channel: `{{ $json.event.channel }}`
- Text: `{{ $('HTTP Request').item.json.data.answer }}`

---

## 🔐 Security in n8n

### Option 1: IP Whitelisting (Recommended)

On the Windows PC, only allow the n8n IP:

```powershell
New-NetFirewallRule `
  -DisplayName "NotebookLM (n8n only)" `
  -Direction Inbound `
  -LocalPort 3000 `
  -Protocol TCP `
  -Action Allow `
  -RemoteAddress 192.168.1.100  # n8n IP
```

### Option 2: API Key

If you have enabled the API key (see [02-CONFIGURATION.md](./02-CONFIGURATION.md)):

**In the HTTP Request node, add a Header:**

- Name: `Authorization`
- Value: `Bearer votre-api-key-secrete`

---

## 🎨 Best Practices

### 1. Error Handling

Add an "Error Trigger" node after HTTP Request:

```
HTTP Request ──✓──▶ Success Path
             └─✗──▶ Error Trigger ──▶ Send Error Notification
```

**Error Trigger Configuration:**

- Error Message: `{{ $json.error }}`
- Action: Send notification, log, retry, etc.

### 2. Timeout

NotebookLM can take 30-60 seconds. Configure the timeout:

**HTTP Request → Settings:**

- Timeout: `120000` (120 seconds)

### 3. Rate Limiting

Free NotebookLM = 50 requests/day. Add a counter:

```
┌────────────┐     ┌──────────────┐     ┌────────────┐
│ Check      │────▶│ HTTP Request │────▶│ Increment  │
│ Counter    │     │              │     │ Counter    │
└────────────┘     └──────────────┘     └────────────┘
```

### 4. Reusing Sessions

For follow-up questions, pass the `session_id`:

**First question:**

```json
{
  "question": "Quels conseils pour gérer le temps d'écran?"
}
```

**Follow-up questions:**

```json
{
  "question": "Donne-moi un exemple",
  "session_id": "{{ $('HTTP Request 1').item.json.data.session_id }}"
}
```

---

## 📊 Useful Variables in n8n

| Variable                                      | Description         | Example       |
| --------------------------------------------- | ------------------- | ------------- |
| `{{ $json.data.answer }}`                     | NotebookLM response | Response text |
| `{{ $json.data.session_id }}`                 | Session ID          | "9a580eee"    |
| `{{ $json.data.session_info.message_count }}` | Message count       | 3             |
| `{{ $json.success }}`                         | Success/failure     | true/false    |
| `{{ $json.error }}`                           | Error message       | "Timeout..."  |

---

## 🐛 Troubleshooting

### Problem 1: "ECONNREFUSED"

**Cause:** n8n cannot reach the server

**Solutions:**

1. Verify the server is running: `curl http://192.168.1.52:3000/health`
2. Check the IP (not `localhost` from remote n8n!)
3. Check Windows firewall

### Problem 2: "Timeout"

**Cause:** NotebookLM response too long

**Solutions:**

1. Increase timeout HTTP Request → Settings → Timeout: 120000
2. Verify NotebookLM responds: test with curl

### Problem 3: "403 Forbidden"

**Cause:** Invalid or missing API key

**Solutions:**

1. Check Authorization header
2. Check the API key value

### Problem 4: Empty Responses

**Cause:** Invalid `notebook_id` or notebook not configured

**Solutions:**

1. List notebooks: `GET /notebooks`
2. Use the correct ID or complete URL

---

## 📖 Advanced Examples

### Multi-Notebook Workflow

Query multiple notebooks based on topic:

```
Webhook ──▶ Switch ──┬──▶ HTTP (Notebook Parents)
                     ├──▶ HTTP (Notebook Génétique)
                     └──▶ HTTP (Notebook Shakespeare)
```

**Switch Configuration:**

- Mode: Rules
- Rules:
  - If `{{ $json.topic }}` equals "parents-numerique" → Output 1
  - If `{{ $json.topic }}` equals "genetique-sante" → Output 2
  - Otherwise → Output 3

### Workflow with Validation

Validate the question before querying NotebookLM:

```
Webhook ──▶ Validate ──✓──▶ HTTP Request ──▶ Response
                      └─✗──▶ Error Response
```

**Validate Configuration (Function node):**

```javascript
if (!items[0].json.question || items[0].json.question.length < 3) {
  throw new Error('Question trop courte');
}
return items;
```

---

## 🎓 Resources

- **API Documentation:** [03-API.md](./03-API.md)
- **Configuration:** [02-CONFIGURATION.md](./02-CONFIGURATION.md)
- **Troubleshooting:** [05-TROUBLESHOOTING.md](./05-TROUBLESHOOTING.md)
- **n8n Community:** https://community.n8n.io/

---

**n8n integration complete!** ✅
