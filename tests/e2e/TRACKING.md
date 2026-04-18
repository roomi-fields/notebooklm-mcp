# E2E Tests Tracking

**Last Updated:** 2026-01-01
**Test Files Location:** `tests/e2e/tests/`

---

## Latest Run Results

**Date:** 2026-01-01
**Mode:** FULL
**Language:** EN
**Account:** account-c
**Duration:** 3224.805 s (~54 minutes)

```
Test Suites: 11 passed, 11 total
Tests:       1 skipped, 75 passed, 76 total
```

---

## Quick Reference

| Mode  | Tests | Description                           |
| ----- | ----- | ------------------------------------- |
| QUICK | 55    | Smoke tests - one option per function |
| FULL  | 76    | All option combinations               |

## Run Commands

```bash
# Quick mode (default)
./tests/e2e/run-e2e.sh

# Full mode
./tests/e2e/run-e2e.sh --mode=full

# With language
./tests/e2e/run-e2e.sh --lang=en

# Specific account
./tests/e2e/run-e2e.sh --account=account-c

# Specific test file
./tests/e2e/run-e2e.sh --test=03

# Combined
./tests/e2e/run-e2e.sh --mode=full --lang=en --account=account-c
```

---

## Test Status Summary

| File                        | Category             | Tests            | Status        |
| --------------------------- | -------------------- | ---------------- | ------------- |
| 01-health.test.ts           | Health & Auth        | T01-T03          | PASS          |
| 02-notebooks.test.ts        | Notebook Library     | T04-T10          | PASS          |
| 03-ask.test.ts              | Ask Question         | T11-T14          | PASS          |
| 04-session.test.ts          | Session Management   | T15, T43-T44     | PASS          |
| 05-sources.test.ts          | Sources Management   | T16-T24          | PASS          |
| 06-content-generate.test.ts | Content Generation   | T25-T33          | PASS          |
| 07-content-download.test.ts | Content Download     | T34-T40          | PASS          |
| 08-notes.test.ts            | Notes Management     | T45-T47          | PASS          |
| 09-notebook-crud.test.ts    | CRUD & Auto-Discover | T41-T42, T48-T52 | PASS (1 skip) |
| 10-errors.test.ts           | Error Handling       | T53-T55          | PASS          |
| 11-full-options.test.ts     | FULL Mode Options    | T56-T76          | PASS          |

---

## Detailed Test List

### QUICK Mode Tests (55 tests)

#### 01 - Health & Auth (3 tests)

| ID  | Test               | Status | Notes |
| --- | ------------------ | ------ | ----- |
| T01 | Server running     | PASS   |       |
| T02 | Authenticated      | PASS   |       |
| T03 | Full health status | PASS   |       |

#### 02 - Notebook Library (7 tests)

| ID  | Test                     | Status | Notes |
| --- | ------------------------ | ------ | ----- |
| T04 | List notebooks           | PASS   |       |
| T05 | Test notebook configured | PASS   |       |
| T06 | Get notebook details     | PASS   |       |
| T07 | Activate notebook        | PASS   |       |
| T08 | Get library statistics   | PASS   |       |
| T09 | Search notebooks         | PASS   |       |
| T10 | Update notebook          | PASS   |       |

#### 03 - Ask Question (4 tests)

| ID  | Test              | Status | Notes   |
| --- | ----------------- | ------ | ------- |
| T11 | Simple question   | PASS   | 37864ms |
| T12 | Specific question | PASS   | 37708ms |
| T13 | Session context   | PASS   | 46650ms |
| T14 | Source citations  | PASS   | 37233ms |

#### 04 - Session Management (3 tests)

| ID  | Test          | Status | Notes   |
| --- | ------------- | ------ | ------- |
| T15 | Reset session | PASS   | 96049ms |
| T43 | List sessions | PASS   |         |
| T44 | Close session | PASS   | 71852ms |

#### 05 - Sources Management (9 tests)

| ID  | Test                      | Status | Notes    |
| --- | ------------------------- | ------ | -------- |
| T16 | List sources              | PASS   | 152168ms |
| T17 | Add text source           | PASS   | 41371ms  |
| T18 | Add URL source            | PASS   | 38356ms  |
| T19 | Add YouTube source        | PASS   | 38831ms  |
| T20 | Reject invalid type       | PASS   |          |
| T21 | Reject file without path  | PASS   |          |
| T22 | Reject gdrive without url | PASS   |          |
| T23 | Delete source by name     | PASS   |          |
| T24 | Add and delete source     | PASS   | 40273ms  |

#### 06 - Content Generation (9 tests)

| ID  | Test                             | Status | Notes    |
| --- | -------------------------------- | ------ | -------- |
| T25 | Generate report                  | PASS   | 31434ms  |
| T26 | Generate presentation            | PASS   | 31002ms  |
| T27 | Generate data table              | PASS   | 31684ms  |
| T28 | Generate infographic             | PASS   | 120326ms |
| T29 | Generate video                   | PASS   | 120339ms |
| T30 | Reject invalid type              | PASS   |          |
| T31 | Reject removed types             | PASS   |          |
| T32 | Reject video_style for non-video | PASS   |          |
| T33 | Generate audio_overview          | PASS   | 120285ms |

#### 07 - Content Download (7 tests)

| ID  | Test                 | Status | Notes   |
| --- | -------------------- | ------ | ------- |
| T34 | Download audio       | PASS   | 20952ms |
| T35 | Export presentation  | PASS   | 21760ms |
| T36 | Export data_table    | PASS   | 20668ms |
| T37 | Download infographic | PASS   | 20706ms |
| T38 | Download video       | PASS   | 21093ms |
| T39 | Reject invalid type  | PASS   |         |
| T40 | Reject missing type  | PASS   |         |

#### 08 - Notes Management (3 tests)

| ID  | Test                   | Status | Notes   |
| --- | ---------------------- | ------ | ------- |
| T45 | Create note            | PASS   | 29349ms |
| T46 | Save chat to note      | PASS   | 40066ms |
| T47 | Convert note to source | PASS   | 31073ms |

#### 09 - CRUD & Auto-Discover (7 tests)

| ID  | Test                   | Status | Notes       |
| --- | ---------------------- | ------ | ----------- |
| T41 | Auto-discover metadata | PASS   | 120333ms    |
| T42 | Reject without URL     | PASS   |             |
| T48 | Create notebook        | PASS   | 10522ms     |
| T49 | Update notebook        | PASS   |             |
| T50 | Delete notebook        | PASS   |             |
| T51 | Account info in health | PASS   |             |
| T52 | Re-auth (SKIP)         | SKIP   | Destructive |

#### 10 - Error Handling (3 tests)

| ID  | Test                | Status | Notes |
| --- | ------------------- | ------ | ----- |
| T53 | Missing question    | PASS   |       |
| T54 | Invalid notebook ID | PASS   |       |
| T55 | Malformed JSON      | PASS   |       |

---

### FULL Mode Additional Tests (21 tests)

#### 11 - Video Options (9 tests)

| ID  | Test                    | Status | Notes    |
| --- | ----------------------- | ------ | -------- |
| T56 | video_format=brief      | PASS   | 120297ms |
| T57 | video_format=explainer  | PASS   | 120288ms |
| T58 | video_style=classroom   | PASS   | 120342ms |
| T59 | video_style=documentary | PASS   | 120344ms |
| T60 | video_style=animated    | PASS   | 120310ms |
| T61 | video_style=corporate   | PASS   | 120335ms |
| T62 | video_style=cinematic   | PASS   | 120327ms |
| T63 | video_style=minimalist  | PASS   | 120327ms |
| T64 | format+style combined   | PASS   | 120308ms |

#### 11 - Infographic Options (2 tests)

| ID  | Test              | Status | Notes    |
| --- | ----------------- | ------ | -------- |
| T65 | format=horizontal | PASS   | 120309ms |
| T66 | format=vertical   | PASS   | 120327ms |

#### 11 - Report Options (2 tests)

| ID  | Test            | Status | Notes   |
| --- | --------------- | ------ | ------- |
| T67 | format=summary  | PASS   | 31060ms |
| T68 | format=detailed | PASS   | 31424ms |

#### 11 - Presentation Options (5 tests)

| ID  | Test                     | Status | Notes   |
| --- | ------------------------ | ------ | ------- |
| T69 | style=detailed_slideshow | PASS   | 31389ms |
| T70 | style=presenter_notes    | PASS   | 31004ms |
| T71 | length=short             | PASS   | 31060ms |
| T72 | length=default           | PASS   | 31183ms |
| T73 | style+length combined    | PASS   | 31389ms |

#### 11 - Common Options (3 tests)

| ID  | Test                         | Status | Notes    |
| --- | ---------------------------- | ------ | -------- |
| T74 | report + custom_instructions | PASS   |          |
| T75 | presentation + language=fr   | PASS   | 31479ms  |
| T76 | audio + custom_instructions  | PASS   | 120240ms |

---

## Execution Log

### 2026-01-01 - FULL EN account-c

- **Result:** 75 passed, 1 skipped
- **Duration:** 54 minutes
- **Notes:** All tests passed with English UI selectors

---

## Notes

- Tests T01-T10 and T30-T32, T39-T40, T53-T55 don't require NotebookLM API calls (validation tests)
- Tests requiring API calls should be run carefully due to rate limits
- Each account has 50 queries/day limit
- Video/Audio/Infographic tests timeout at 120s (normal behavior)
