# Contributing Guide

Thank you for your interest in contributing to NotebookLM MCP HTTP Server!

---

## How to Contribute

### 1. Report a Bug

Before creating an issue:

- Check if the bug hasn't already been reported
- Consult the [troubleshooting guide](./deployment/docs/05-TROUBLESHOOTING.md)

**To create an issue, include:**

```markdown
## Environment

- OS: Windows 10/11 (Linux/macOS = experimental support)
- Node.js version: (node --version)
- npm version: (npm --version)

## Description

[Clear description of the problem]

## Steps to Reproduce

1. Start the server with: ...
2. Call the endpoint: ...
3. Observe the error: ...

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Logs
```

[Relevant server logs]

```

## Resolution Attempts
[What you've already tried]
```

### 2. Propose an Enhancement

**For a new feature:**

1. Open a **Discussion** (not an Issue) to discuss it first
2. Explain the problem it solves
3. Describe your proposed solution
4. Wait for feedback before implementing

**Examples of good proposals:**

- "Add support for X authentication type"
- "Improve performance of Y"
- "Add endpoint for Z"

### 3. Submit Code

#### Git Workflow

```bash
# 1. Fork the project on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/notebooklm-mcp.git
cd notebooklm-mcp

# 3. Create a branch for your feature
git checkout -b feature/my-new-feature

# 4. Make your changes
# ... code ...

# 5. Test your changes
npm run build
npm run start:http
# Test manually with curl or n8n

# 6. Commit
git add .
git commit -m "feat: short description of the feature"

# 7. Push to your fork
git push origin feature/my-new-feature

# 8. Open a Pull Request on GitHub
```

#### Commit Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add endpoint /notebooks/:id/sources
fix: fix timeout on Windows
docs: improve n8n guide
refactor: simplify session manager
chore: update dependencies
```

#### Code Standards

**TypeScript:**

- Use strict types (`strict: true`)
- No `any` unless absolutely necessary
- Comment complex functions

**Style:**

- Indentation: 2 spaces
- Quotes: single `'`
- Semicolons: yes
- Follow existing project style

**Logs:**

```typescript
import { log } from './utils/logger.js';

log.success('✅ Operation successful');
log.info('ℹ️ Information');
log.warning('⚠️ Warning');
log.error('❌ Error');
log.dim('... secondary details');
```

#### Automated Tests (Recommended)

Before submitting, run the test suite:

```bash
# 1. Clean build
npm run build

# 2. Start the server
npm run start:http

# 3. In another terminal, run tests
.\deployment\scripts\test-api.ps1        # Complete tests (10 tests)
.\deployment\scripts\test-errors.ps1     # Error tests (12 tests)

# 4. Verify: all tests pass ✅
```

**Documentation:** [Test Scripts](./deployment/scripts/README.md)

#### Manual Tests (Alternative)

If you can't use PowerShell scripts:

```bash
# 1. Clean build
npm run build

# 2. Test health check
curl http://localhost:3000/health

# 3. Test ask question
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"test","notebook_id":"parents-numerique"}'

# 4. Check server logs
# No TypeScript errors
# No unexpected warnings
```

### 4. Improve Documentation

**Documentation is highly appreciated!**

- Fix typos
- Clarify confusing sections
- Add missing examples
- Translate to other languages

**Documentation files:**

- `README.md` - Complete overview (merged MCP + HTTP)
- `deployment/QUICK-START.md` - Quick guide
- `deployment/docs/*.md` - Detailed guides (01-06)
- `deployment/docs/README.md` - Navigation index
- `deployment/scripts/README.md` - Test scripts guide

---

## Project Structure

```
notebooklm-mcp/
├── src/
│   ├── http-wrapper.ts       # HTTP REST API entry point
│   ├── index.ts              # MCP stdio entry point
│   ├── auth/
│   │   └── auth-manager.ts   # Google authentication management
│   ├── session/
│   │   ├── session-manager.ts  # Browser session pool
│   │   └── browser-session.ts  # Individual session
│   ├── tools/
│   │   └── index.ts          # MCP tool handlers
│   ├── library/
│   │   └── notebook-library.ts # Notebook library
│   └── utils/
│       ├── logger.ts         # Colored logs
│       └── page-utils.ts     # Playwright utilities
├── deployment/
│   ├── README.md
│   ├── docs/                 # Complete documentation
│   └── scripts/              # PowerShell scripts
└── Data/                     # Runtime data (gitignored)
```

---

## Contribution Areas

### Easy for Beginners

- Fix typos
- Improve log messages
- Add examples in docs
- Test on different OS

### Intermediate Level

- Add automated tests
- Improve error handling
- Optimize performance
- Add HTTPS/TLS support

### Advanced Level

- Add authentication strategies (JWT, OAuth)
- Multi-user support
- Response caching
- Monitoring/metrics

---

## Code of Conduct

**Be respectful and constructive:**

✅ Accepted:

- Questions, even basic ones
- Constructive criticism
- Improvement suggestions
- Requests for clarification

❌ Not accepted:

- Offensive comments
- Spam or self-promotion
- Unrelated requests

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

---

## Questions?

- Open a [GitHub Discussion](https://github.com/roomi-fields/notebooklm-mcp/discussions)
- Consult the [documentation](./deployment/docs/)
- Read [existing issues](https://github.com/roomi-fields/notebooklm-mcp/issues)

---

**Thank you for contributing!** 🙏
