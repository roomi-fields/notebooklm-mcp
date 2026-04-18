# E2E Tests FULL - account-a Account (English UI)

**Date:** 2025-12-31
**Account:** your-account-a@example.com (English UI)
**Notebook:** A CREER
**Mode:** FULL (76 tests)

---

## Summary

| Category                   | Tests  | Passed | Failed | Status      |
| -------------------------- | ------ | ------ | ------ | ----------- |
| Health & Auth              | 3      | 0      | 0      | PENDING     |
| Notebook Library           | 7      | 0      | 0      | PENDING     |
| Ask Question               | 4      | 0      | 0      | PENDING     |
| Session Reset              | 1      | 0      | 0      | PENDING     |
| Content Listing            | 1      | 0      | 0      | PENDING     |
| Add Sources                | 8      | 0      | 0      | PENDING     |
| Content Generation         | 9      | 0      | 0      | PENDING     |
| Audio Overview             | 1      | 0      | 0      | PENDING     |
| Content Download           | 7      | 0      | 0      | PENDING     |
| Auto-Discover              | 2      | 0      | 0      | PENDING     |
| Session Management         | 2      | 0      | 0      | PENDING     |
| Notes Management           | 3      | 0      | 0      | PENDING     |
| Notebook CRUD              | 3      | 0      | 0      | PENDING     |
| Account Management         | 2      | 0      | 0      | PENDING     |
| Error Handling             | 3      | 0      | 0      | PENDING     |
| FULL: Video Options        | 9      | 0      | 0      | PENDING     |
| FULL: Infographic Options  | 2      | 0      | 0      | PENDING     |
| FULL: Report Options       | 2      | 0      | 0      | PENDING     |
| FULL: Presentation Options | 5      | 0      | 0      | PENDING     |
| FULL: Common Options       | 4      | 0      | 0      | PENDING     |
| FULL: Source Selection     | 1      | 0      | 0      | PENDING     |
| **TOTAL**                  | **76** | **0**  | **0**  | **PENDING** |

---

## QUICK MODE Tests (54 tests)

### 1. Health & Auth (3 tests)

| #   | Test               | Status  | Duration | Notes |
| --- | ------------------ | ------- | -------- | ----- |
| 1   | Server running     | PENDING |          |       |
| 2   | Authenticated      | PENDING |          |       |
| 3   | Full health status | PENDING |          |       |

### 2. Notebook Library (7 tests)

| #   | Test                      | Status  | Duration | Notes |
| --- | ------------------------- | ------- | -------- | ----- |
| 4   | List notebooks            | PENDING |          |       |
| 5   | Test notebook configured  | PENDING |          |       |
| 6   | Get notebook details      | PENDING |          |       |
| 7   | Activate notebook         | PENDING |          |       |
| 8   | Get library statistics    | PENDING |          |       |
| 9   | Search notebooks by topic | PENDING |          |       |
| 10  | Update notebook           | PENDING |          |       |

### 3. Ask Question (4 tests)

| #   | Test                        | Status  | Duration | Notes |
| --- | --------------------------- | ------- | -------- | ----- |
| 11  | Simple question             | PENDING |          |       |
| 12  | Specific question           | PENDING |          |       |
| 13  | Session context (follow-up) | PENDING |          |       |
| 14  | Source citations            | PENDING |          |       |

### 4. Session Reset (1 test)

| #   | Test                            | Status  | Duration | Notes |
| --- | ------------------------------- | ------- | -------- | ----- |
| 15  | Reset session and clear history | PENDING |          |       |

### 5. Content Listing (1 test)

| #   | Test                     | Status  | Duration | Notes |
| --- | ------------------------ | ------- | -------- | ----- |
| 16  | List sources in notebook | PENDING |          |       |

### 6. Add Sources (8 tests)

| #   | Test                            | Status  | Duration | Notes |
| --- | ------------------------------- | ------- | -------- | ----- |
| 17  | Add text source                 | PENDING |          |       |
| 18  | Add URL source                  | PENDING |          |       |
| 19  | Add YouTube source              | PENDING |          |       |
| 20  | Reject invalid source type      | PENDING |          |       |
| 21  | Reject file without path        | PENDING |          |       |
| 22  | Reject google_drive without url | PENDING |          |       |
| 23  | Delete source by name           | PENDING |          |       |
| 24  | Add and delete source           | PENDING |          |       |

### 7. Content Generation (9 tests)

| #   | Test                             | Status  | Duration | Notes |
| --- | -------------------------------- | ------- | -------- | ----- |
| 25  | Generate report                  | PENDING |          |       |
| 26  | Generate presentation            | PENDING |          |       |
| 27  | Generate data table              | PENDING |          |       |
| 28  | Generate infographic             | PENDING |          |       |
| 29  | Generate video                   | PENDING |          |       |
| 30  | Reject invalid content type      | PENDING |          |       |
| 31  | Reject removed types             | PENDING |          |       |
| 32  | Reject video_style for non-video | PENDING |          |       |
| 33  | Generate audio_overview          | PENDING |          |       |

### 8. Content Download (7 tests)

| #   | Test                         | Status  | Duration | Notes |
| --- | ---------------------------- | ------- | -------- | ----- |
| 34  | Download audio               | PENDING |          |       |
| 35  | Export presentation          | PENDING |          |       |
| 36  | Export data_table            | PENDING |          |       |
| 37  | Download infographic         | PENDING |          |       |
| 38  | Download video               | PENDING |          |       |
| 39  | Reject invalid download type | PENDING |          |       |
| 40  | Reject missing content_type  | PENDING |          |       |

### 9. Auto-Discover (2 tests)

| #   | Test                   | Status  | Duration | Notes |
| --- | ---------------------- | ------- | -------- | ----- |
| 41  | Auto-discover metadata | PENDING |          |       |
| 42  | Reject without URL     | PENDING |          |       |

### 10. Session Management (2 tests)

| #   | Test                 | Status  | Duration | Notes |
| --- | -------------------- | ------- | -------- | ----- |
| 43  | List active sessions | PENDING |          |       |
| 44  | Close a session      | PENDING |          |       |

### 11. Notes Management (3 tests)

| #   | Test                   | Status  | Duration | Notes |
| --- | ---------------------- | ------- | -------- | ----- |
| 45  | Create a note          | PENDING |          |       |
| 46  | Save chat to note      | PENDING |          |       |
| 47  | Convert note to source | PENDING |          |       |

### 12. Notebook CRUD (3 tests)

| #   | Test                         | Status  | Duration | Notes |
| --- | ---------------------------- | ------- | -------- | ----- |
| 48  | Create notebook in Google    | PENDING |          |       |
| 49  | Update notebook metadata     | PENDING |          |       |
| 50  | Delete notebook from library | PENDING |          |       |

### 13. Account Management (2 tests)

| #   | Test                   | Status  | Duration | Notes       |
| --- | ---------------------- | ------- | -------- | ----------- |
| 51  | Account info in health | PENDING |          |             |
| 52  | Re-auth (SKIP)         | SKIP    |          | Destructive |

### 14. Error Handling (3 tests)

| #   | Test                | Status  | Duration | Notes |
| --- | ------------------- | ------- | -------- | ----- |
| 53  | Missing question    | PENDING |          |       |
| 54  | Invalid notebook ID | PENDING |          |       |
| 55  | Malformed JSON      | PENDING |          |       |

---

## FULL MODE Additional Tests (22 tests)

### 15. FULL: Video Options (9 tests)

| #   | Test                        | Status  | Duration | Notes |
| --- | --------------------------- | ------- | -------- | ----- |
| 56  | video_format=brief          | PENDING |          |       |
| 57  | video_format=explainer      | PENDING |          |       |
| 58  | video_style=classroom       | PENDING |          |       |
| 59  | video_style=documentary     | PENDING |          |       |
| 60  | video_style=animated        | PENDING |          |       |
| 61  | video_style=corporate       | PENDING |          |       |
| 62  | video_style=cinematic       | PENDING |          |       |
| 63  | video_style=minimalist      | PENDING |          |       |
| 64  | video format+style combined | PENDING |          |       |

### 16. FULL: Infographic Options (2 tests)

| #   | Test                          | Status  | Duration | Notes |
| --- | ----------------------------- | ------- | -------- | ----- |
| 65  | infographic_format=horizontal | PENDING |          |       |
| 66  | infographic_format=vertical   | PENDING |          |       |

### 17. FULL: Report Options (2 tests)

| #   | Test                   | Status  | Duration | Notes |
| --- | ---------------------- | ------- | -------- | ----- |
| 67  | report_format=summary  | PENDING |          |       |
| 68  | report_format=detailed | PENDING |          |       |

### 18. FULL: Presentation Options (5 tests)

| #   | Test                                  | Status  | Duration | Notes |
| --- | ------------------------------------- | ------- | -------- | ----- |
| 69  | presentation_style=detailed_slideshow | PENDING |          |       |
| 70  | presentation_style=presenter_notes    | PENDING |          |       |
| 71  | presentation_length=short             | PENDING |          |       |
| 72  | presentation_length=default           | PENDING |          |       |
| 73  | presentation style+length combined    | PENDING |          |       |

### 19. FULL: Common Options (4 tests)

| #   | Test                                    | Status  | Duration | Notes |
| --- | --------------------------------------- | ------- | -------- | ----- |
| 74  | report with custom_instructions         | PENDING |          |       |
| 75  | presentation with language=fr           | PENDING |          |       |
| 76  | audio_overview with custom_instructions | PENDING |          |       |
| 77  | data_table with custom_instructions     | PENDING |          |       |

### 20. FULL: Source Selection (1 test)

| #   | Test                          | Status  | Duration | Notes |
| --- | ----------------------------- | ------- | -------- | ----- |
| 78  | report using specific sources | PENDING |          |       |

---

## Execution Log

_Starting tests..._

---
