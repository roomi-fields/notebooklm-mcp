# NotebookLM MCP HTTP Server - E2E Test Report

**Generated:** 2025-12-30 15:14:30
**Duration:** 1150.58 seconds
**Base URL:** http://localhost:3000

## Summary

| Metric       | Value |
| ------------ | ----- |
| Total Tests  | 21    |
| Passed       | 16    |
| Failed       | 3     |
| Errors       | 2     |
| Success Rate | 76.2% |

## Test Results by Category

### ❌ (16/21)

| Test | Method | Endpoint | Status | Duration | Error |
|------|--------|----------|--------|----------|-------|| Health Check | GET | `/health` | ✅ PASS | 2196ms | - |
| List Notebooks | GET | `/notebooks` | ✅ PASS | 11ms | - |
| Get Library Stats | GET | `/notebooks/stats` | ✅ PASS | 3ms | - |
| Search Notebooks | GET | `/notebooks/search` | ✅ PASS | 4ms | - |
| Get Notebook by ID | GET | `/notebooks/notebook-2` | ✅ PASS | 3ms | - |
| Add Notebook | POST | `/notebooks` | ✅ PASS | 23266ms | - |
| Update Notebook | PUT | `/notebooks/notebook-2` | ✅ PASS | 8ms | - |
| Activate Notebook | PUT | `/notebooks/notebook-2/activate` | ✅ PASS | 5ms | - |
| List Sessions | GET | `/sessions` | ✅ PASS | 3ms | - |
| Ask Question | POST | `/ask` | ✅ PASS | 64450ms | - |
| List Content | GET | `/content` | ✅ PASS | 89311ms | - |
| Add Text Source | POST | `/content/sources` | ❌ ERROR | 60108ms | Le délai d'attente de l'opération a expiré.... |
| Create Note | POST | `/content/notes` | ⚠️ FAIL | 27886ms | Expected success=True, got False... |
| Save Chat to Note | POST | `/content/chat-to-note` | ⚠️ FAIL | 27721ms | Expected success=True, got False... |
| Audio Overview | POST | `/content/generate` | ❌ ERROR | 300017ms | La demande a été abandonnée : Le délai d'attente d... |
| Report (Summary) | POST | `/content/generate` | ✅ PASS | 106244ms | - |
| Presentation | POST | `/content/generate` | ✅ PASS | 111995ms | - |
| Data Table | POST | `/content/generate` | ✅ PASS | 87423ms | - |
| Infographic | POST | `/content/generate` | ✅ PASS | 109047ms | - |
| Video | POST | `/content/generate` | ✅ PASS | 118503ms | - |
| Download Audio | GET | `/content/download` | ⚠️ FAIL | 21863ms | Expected success=True, got False... |

## Endpoint Coverage

### Authentication Endpoints

| Endpoint        | Method | Tested | Notes                       |
| --------------- | ------ | ------ | --------------------------- |
| `/health`       | GET    | ✅     | Basic health check          |
| `/setup-auth`   | POST   | ⏭️     | Skipped (destructive)       |
| `/de-auth`      | POST   | ⏭️     | Skipped (destructive)       |
| `/re-auth`      | POST   | ⏭️     | Skipped (would change auth) |
| `/cleanup-data` | POST   | ⏭️     | Skipped (destructive)       |

### Notebook Library Endpoints

| Endpoint                   | Method | Tested | Notes                   |
| -------------------------- | ------ | ------ | ----------------------- |
| `/notebooks`               | GET    | ✅     | List all notebooks      |
| `/notebooks`               | POST   | ✅     | Add notebook to library |
| `/notebooks/search`        | GET    | ✅     | Search by query         |
| `/notebooks/stats`         | GET    | ✅     | Library statistics      |
| `/notebooks/:id`           | GET    | ✅     | Get notebook details    |
| `/notebooks/:id`           | PUT    | ✅     | Update notebook         |
| `/notebooks/:id`           | DELETE | ⏭️     | Skipped (cleanup after) |
| `/notebooks/:id/activate`  | PUT    | ✅     | Set active notebook     |
| `/notebooks/auto-discover` | POST   | ⏭️     | Requires valid URL      |

### Session Endpoints

| Endpoint              | Method | Tested | Notes                   |
| --------------------- | ------ | ------ | ----------------------- |
| `/sessions`           | GET    | ✅     | List active sessions    |
| `/sessions/:id/reset` | POST   | ⏭️     | Skipped (needs session) |
| `/sessions/:id`       | DELETE | ⏭️     | Skipped (needs session) |

### Content Management Endpoints

| Endpoint                          | Method | Tested | Notes               |
| --------------------------------- | ------ | ------ | ------------------- |
| `/ask`                            | POST   | ✅     | Ask question        |
| `/content`                        | GET    | ✅     | List content        |
| `/content/sources`                | POST   | ✅     | Add source          |
| `/content/sources/:id`            | DELETE | ⏭️     | Cleanup after       |
| `/content/sources`                | DELETE | ⏭️     | Cleanup after       |
| `/content/notes`                  | POST   | ✅     | Create note         |
| `/content/chat-to-note`           | POST   | ✅     | Save chat to note   |
| `/content/notes/:title/to-source` | POST   | ⏭️     | Needs existing note |

### Content Generation (Studio)

| Content Type     | Format Options       | Tested | Notes            |
| ---------------- | -------------------- | ------ | ---------------- |
| `audio_overview` | language             | ✅     | Audio podcast    |
| `presentation`   | style, length        | ✅     | Google Slides    |
| `report`         | summary, detailed    | ✅     | Text report      |
| `data_table`     | -                    | ✅     | Google Sheets    |
| `infographic`    | horizontal, vertical | ✅     | PNG image        |
| `video`          | style, format        | ✅     | Video generation |

### Content Download/Export

| Content Type     | Export Type   | Tested | Notes            |
| ---------------- | ------------- | ------ | ---------------- |
| `audio_overview` | File download | ✅     | WAV/MP3          |
| `presentation`   | Google Slides | ⏭️     | Opens in browser |
| `data_table`     | Google Sheets | ⏭️     | Opens in browser |
| `infographic`    | PNG download  | ⏭️     | File download    |
| `video`          | File download | ⏭️     | MP4              |

## Failed Tests Details

### ❌ Add Text Source

- **Endpoint:** POST /content/sources
- **Status:** ERROR
- **Error:** Le délai d'attente de l'opération a expiré.

### ❌ Create Note

- **Endpoint:** POST /content/notes
- **Status:** FAIL
- **Error:** Expected success=True, got False

### ❌ Save Chat to Note

- **Endpoint:** POST /content/chat-to-note
- **Status:** FAIL
- **Error:** Expected success=True, got False

### ❌ Audio Overview

- **Endpoint:** POST /content/generate
- **Status:** ERROR
- **Error:** La demande a été abandonnée : Le délai d'attente de l'opération a expiré..

### ❌ Download Audio

- **Endpoint:** GET /content/download
- **Status:** FAIL
- **Error:** Expected success=True, got False

---

_Report generated by comprehensive-e2e-test.ps1_
