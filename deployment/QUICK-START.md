# Quick Start Guide - 5 Minutes ⚡

> For busy users already familiar with Node.js and npm

---

## ✅ Prerequisites

- Windows 10/11 (64-bit)
- Node.js 20+ and npm 10+ installed
- Google account with NotebookLM access

**Note:** This package is optimized for Windows only.

---

## 🚀 Installation in 5 Steps

### 1. Clone and Install (2 min)

```powershell
cd D:\
git clone <repo-url> notebooklm-http
cd notebooklm-http
npm install
npm run build
```

### 2. Configure Authentication (1 min)

```powershell
npm run setup-auth
```

- Chrome opens
- Log in to Google
- Go to https://notebooklm.google.com
- Close Chrome
- ✅ Auth saved!

### 3. Start the Server (30 sec)

```powershell
npm run start:http
```

### 4. Test (30 sec)

New terminal:

```powershell
curl http://localhost:3000/health
```

### 5. Use (1 min)

```powershell
curl -X POST http://localhost:3000/ask `
  -H "Content-Type: application/json" `
  -d '{"question":"Test","notebook_id":"your-id"}'
```

---

## 🎯 n8n Configuration

1. **HTTP Request node** in n8n
2. **URL:** `http://<PC-IP>:3000/ask`
3. **Method:** POST
4. **Body:**
   ```json
   {
     "question": "{{ $json.query }}",
     "notebook_id": "your-id"
   }
   ```

---

## 📖 Complete Documentation

- Detailed installation: [docs/01-INSTALL.md](./docs/01-INSTALL.md)
- Complete overview: [root README.md](../README.md)
- API: [docs/03-API.md](./docs/03-API.md)
- n8n: [docs/04-N8N-INTEGRATION.md](./docs/04-N8N-INTEGRATION.md)
- Troubleshooting: [docs/05-TROUBLESHOOTING.md](./docs/05-TROUBLESHOOTING.md)

---

## 🐛 Common Issues

| Problem              | Solution                                                      |
| -------------------- | ------------------------------------------------------------- |
| Port 3000 occupied   | `netstat -ano \| findstr :3000` then `taskkill /PID <pid> /F` |
| Session expires      | `npm run setup-auth`                                          |
| "Target page closed" | Stop all node.exe processes and restart                       |

---

**✅ That's it! You're all set!**
