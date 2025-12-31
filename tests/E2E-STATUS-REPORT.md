# NotebookLM MCP HTTP Server - E2E Test Status Report

**Date:** 2025-12-31 02:00
**Account:** rpmonster (test account)
**Server Version:** 1.4.2
**Test File:** `tests/integration/full-e2e.test.ts`

---

## Test Modes

| Mode                | Tests | Description                         |
| ------------------- | ----- | ----------------------------------- |
| **QUICK** (default) | 54    | Smoke tests - one test per function |
| **FULL**            | 76    | All option combinations             |

---

## Executive Summary (QUICK Mode)

| Category           | Tests  | Status              |
| ------------------ | ------ | ------------------- |
| Health & Auth      | 3      | PASS                |
| Notebook Library   | 7      | PASS                |
| Ask Question       | 4      | PASS                |
| Session Reset      | 1      | PASS                |
| Content Listing    | 1      | PASS                |
| Add Sources        | 8      | PASS                |
| Content Generation | 9      | PASS                |
| Audio Overview     | 1      | PASS                |
| Content Download   | 7      | PASS                |
| Auto-Discover      | 2      | PASS                |
| Session Management | 2      | PASS                |
| Notes Management   | 3      | PASS                |
| Notebook CRUD      | 3      | PASS                |
| Account Management | 2      | PASS\*              |
| Error Handling     | 3      | PASS                |
| **QUICK TOTAL**    | **54** | **53 PASS, 1 SKIP** |

\*Account rotation (`/re-auth`) is skipped to avoid changing active account during tests.

---

## FULL Mode - Additional Tests (22 tests)

| Category             | Tests  | Options Tested                                                                 |
| -------------------- | ------ | ------------------------------------------------------------------------------ |
| Video Formats        | 2      | `brief`, `explainer`                                                           |
| Video Styles         | 6      | `classroom`, `documentary`, `animated`, `corporate`, `cinematic`, `minimalist` |
| Video Combo          | 1      | format + style combined                                                        |
| Infographic Formats  | 2      | `horizontal`, `vertical`                                                       |
| Report Formats       | 2      | `summary`, `detailed`                                                          |
| Presentation Styles  | 2      | `detailed_slideshow`, `presenter_notes`                                        |
| Presentation Lengths | 2      | `short`, `default`                                                             |
| Presentation Combo   | 1      | style + length combined                                                        |
| Custom Instructions  | 3      | audio_overview, data_table, presentation                                       |
| Language Option      | 1      | `fr`                                                                           |
| Source Selection     | 1      | specific sources array                                                         |
| **FULL ADDITIONS**   | **22** |                                                                                |

**FULL MODE TOTAL: 76 tests**

---

## Test Commands

```bash
# QUICK mode (default) - Fast smoke tests
NBLM_INTEGRATION_TESTS=true npm test -- --testPathPatterns=full-e2e --runInBand

# FULL mode - All option combinations (slow, ~30+ minutes)
NBLM_INTEGRATION_TESTS=true TEST_MODE=full npm test -- --testPathPatterns=full-e2e --runInBand

# Run specific category
NBLM_INTEGRATION_TESTS=true npm test -- --testPathPatterns=full-e2e --testNamePattern="Health|Library" --runInBand
```

---

## Test Coverage by Endpoint

### Health & Authentication (3 tests)

| Endpoint  | Method | Test                |
| --------- | ------ | ------------------- |
| `/health` | GET    | PASS                |
| `/health` | GET    | PASS (full status)  |
| `/health` | GET    | PASS (account info) |

### Notebook Library (7 tests)

| Endpoint                  | Method | Test              |
| ------------------------- | ------ | ----------------- |
| `/notebooks`              | GET    | PASS              |
| `/notebooks`              | POST   | PASS (via create) |
| `/notebooks/search`       | GET    | PASS              |
| `/notebooks/stats`        | GET    | PASS              |
| `/notebooks/:id`          | GET    | PASS              |
| `/notebooks/:id`          | PUT    | PASS              |
| `/notebooks/:id/activate` | PUT    | PASS              |

### Ask Question (4 tests)

| Test Case                   | Status |
| --------------------------- | ------ |
| Simple question             | PASS   |
| Specific question           | PASS   |
| Session context (follow-up) | PASS   |
| Source citations            | PASS   |

### Content Sources (8 tests)

| Endpoint           | Method | Test                            |
| ------------------ | ------ | ------------------------------- |
| `/content/sources` | POST   | PASS (text)                     |
| `/content/sources` | POST   | PASS (url)                      |
| `/content/sources` | POST   | PASS (youtube)                  |
| `/content/sources` | POST   | PASS (invalid type)             |
| `/content/sources` | POST   | PASS (file without path)        |
| `/content/sources` | POST   | PASS (google_drive without url) |
| `/content/sources` | DELETE | PASS (by name)                  |
| `/content/sources` | DELETE | PASS (add+delete)               |

### Content Generation (9 tests - QUICK)

| Content Type           | Status |
| ---------------------- | ------ |
| `report`               | PASS   |
| `presentation`         | PASS   |
| `data_table`           | PASS   |
| `infographic`          | PASS   |
| `video`                | PASS   |
| `audio_overview`       | PASS   |
| Invalid type           | PASS   |
| Removed types          | PASS   |
| video_style validation | PASS   |

### Content Generation Options (FULL MODE ONLY)

#### Video Options (9 tests)

| Option         | Values                                                                         | Tests |
| -------------- | ------------------------------------------------------------------------------ | ----- |
| `video_format` | `brief`, `explainer`                                                           | 2     |
| `video_style`  | `classroom`, `documentary`, `animated`, `corporate`, `cinematic`, `minimalist` | 6     |
| Combined       | format + style                                                                 | 1     |

#### Infographic Options (2 tests)

| Option               | Values                   |
| -------------------- | ------------------------ |
| `infographic_format` | `horizontal`, `vertical` |

#### Report Options (2 tests)

| Option          | Values                |
| --------------- | --------------------- |
| `report_format` | `summary`, `detailed` |

#### Presentation Options (5 tests)

| Option                | Values                                  | Tests |
| --------------------- | --------------------------------------- | ----- |
| `presentation_style`  | `detailed_slideshow`, `presenter_notes` | 2     |
| `presentation_length` | `short`, `default`                      | 2     |
| Combined              | style + length                          | 1     |

#### Common Options (4 tests)

| Option                | Content Types Tested                     |
| --------------------- | ---------------------------------------- |
| `custom_instructions` | audio_overview, data_table, presentation |
| `language`            | presentation (`fr`)                      |
| `sources`             | report (source selection)                |

Note: `report` does not support `custom_instructions` - it uses `report_format` and `language` only.

### Content Download (7 tests)

| Content Type         | Status |
| -------------------- | ------ |
| `audio_overview`     | PASS   |
| `presentation`       | PASS   |
| `data_table`         | PASS   |
| `infographic`        | PASS   |
| `video`              | PASS   |
| Invalid type         | PASS   |
| Missing content_type | PASS   |

### Notes Management (3 tests)

| Endpoint                          | Method | Test |
| --------------------------------- | ------ | ---- |
| `/content/notes`                  | POST   | PASS |
| `/content/chat-to-note`           | POST   | PASS |
| `/content/notes/:title/to-source` | POST   | PASS |

### Session Management (2 tests)

| Endpoint              | Method | Test                 |
| --------------------- | ------ | -------------------- |
| `/sessions`           | GET    | PASS                 |
| `/sessions/:id`       | DELETE | PASS                 |
| `/sessions/:id/reset` | POST   | PASS (in reset test) |

### Auto-Discover (2 tests)

| Endpoint                   | Method | Test               |
| -------------------------- | ------ | ------------------ |
| `/notebooks/auto-discover` | POST   | PASS               |
| `/notebooks/auto-discover` | POST   | PASS (missing url) |

### Notebook CRUD (3 tests)

| Endpoint            | Method | Test |
| ------------------- | ------ | ---- |
| `/notebooks/create` | POST   | PASS |
| `/notebooks/:id`    | PUT    | PASS |
| `/notebooks/:id`    | DELETE | PASS |

### Error Handling (3 tests)

| Test Case           | Status |
| ------------------- | ------ |
| Missing question    | PASS   |
| Invalid notebook ID | PASS   |
| Malformed JSON      | PASS   |

---

## Test Notebooks

| Name              | Purpose     |
| ----------------- | ----------- |
| CNV (notebook-1)  | READ ONLY   |
| IFS (notebook-2)  | READ ONLY   |
| E2E-Test-Notebook | Write tests |

---

## Multi-Account Configuration

| Account         | Status       |
| --------------- | ------------ |
| mathieudumont31 | Rate limited |
| rpmonster       | Active       |
| rom1pey         | Available    |

---

_Report updated: 2025-12-31 02:00_
