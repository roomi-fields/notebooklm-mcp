# E2E Tests Cleanup & Restructuring Plan

**Date:** 2025-01-01
**Status:** IN PROGRESS

---

## Current State Analysis

### 1. Test Files Location

| Location                             | Count | Purpose                     | Action      |
| ------------------------------------ | ----- | --------------------------- | ----------- |
| `tests/integration/full-e2e.test.ts` | 1     | **76 E2E tests definition** | PRESERVE    |
| `tests/e2e/*.ps1`                    | 14    | Test scripts                | REVIEW      |
| `tests/e2e/*.md`                     | 5     | Tracking files              | CONSOLIDATE |
| Root `/*.ps1`                        | 99    | Temporary test scripts      | CLEANUP     |

### 2. E2E Tracking Files (tests/e2e/)

| File                     | Content                     | Action          |
| ------------------------ | --------------------------- | --------------- |
| E2E-MATHIEU-EN-FULL.md   | 76 tests tracking (English) | USE AS TEMPLATE |
| E2E-ROM1PEY-EN-FULL.md   | 76 tests tracking           | MERGE           |
| E2E-ROM1PEY-EN-STATUS.md | Status file                 | MERGE           |
| E2E-ROM1PEY-TRACKING.md  | Tracking file               | MERGE           |
| E2E-TEST-REPORT.md       | Report file                 | MERGE           |

### 3. Root .ps1 Files to Clean (99 files)

Categories:

- `t*.ps1` (t9, t10, t20, etc.) - Individual test runs
- `test-*.ps1` - Various test scripts
- `debug-*.ps1` - Debug scripts
- `add-*.ps1` - Add account/notebook scripts
- `create-*.ps1` - Create notebook scripts
- Others

### 4. Notebooks in Local Library (15)

| ID                   | Name                            | Type                       |
| -------------------- | ------------------------------- | -------------------------- |
| notebook-1           | CNV - Communication NonViolente | PRODUCTION (DO NOT DELETE) |
| notebook-2           | Test Notebook Updated           | Test                       |
| e2e-test-notebook    | E2E-Test-Notebook               | Test                       |
| e2e-rom1pey-test     | e2e-rom1pey-test                | Test                       |
| rom1pey-english-test | rom1pey-english-test            | Test                       |
| e2e-rom1pey-english  | e2e-rom1pey-english             | Test (new)                 |
| Various nvc-\*       | Auto-generated CNV notebooks    | PRODUCTION                 |
| guide-therapie-ifs   | IFS therapy guide               | PRODUCTION                 |

---

## Restructuring Plan

### Phase 1: Preserve (DONE)

- [x] Document current state in this file
- [x] Identify 76 tests location: `tests/integration/full-e2e.test.ts`
- [x] Identify best tracking template: `E2E-MATHIEU-EN-FULL.md`

### Phase 2: Consolidate Tracking Files

- [ ] Create single tracking file: `tests/e2e/E2E-TRACKING.md`
- [ ] Archive old tracking files to `tests/e2e/archive/`

### Phase 3: Clean Root .ps1 Files

- [ ] Move useful scripts to `scripts/` or `tests/e2e/`
- [ ] Delete temporary test files
- [ ] Keep only: scripts/, deployment/scripts/, tests/e2e/

### Phase 4: Clean Notebooks

- [ ] List notebooks in each account (via NotebookLM UI)
- [ ] Delete test notebooks except one per account
- [ ] Create shared test notebooks accessible by all 3 accounts

### Phase 5: Update mcp-server Skill

- [ ] Add language troubleshooting section
- [ ] Add notebook management section
- [ ] Add "DO NOT kill user's Chrome" warning
- [ ] Add account-specific notebook ownership info

---

## Account Notebooks Status

### agent-primary@example.com

- Language: French (need to change to English)
- Notebooks: TBD (need to check in NotebookLM UI)
- Role: Primary test account

### agent-secondary@example.com

- Language: French
- Notebooks: TBD
- Role: Secondary test account

### agent-tertiary@example.com

- Language: French
- Notebooks: TBD
- Role: Tertiary test account

---

## Critical Notes

1. **DO NOT delete CNV or IFS notebooks** - These are production/personal
2. **Notebooks are NOT shared by default** - Each account only sees its own notebooks
3. **Language issue**: Changing Google Account language does NOT immediately change NotebookLM UI language (cached in profile)

---

## Next Steps

1. User to confirm which account to use for English tests
2. User to manually check notebook counts in each account
3. Claude to proceed with cleanup after user approval
