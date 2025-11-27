# Chrome Profile Limitation

## 🚨 Current Limitation (v1.3.2)

**The HTTP server and MCP stdio modes cannot run simultaneously** due to Chrome profile locking.

### Why This Happens

The NotebookLM MCP server uses a persistent Chrome profile to maintain authentication between sessions. This profile is stored at:

```
Windows: C:\Users\<username>\AppData\Local\notebooklm-mcp\Data\chrome_profile
Linux:   ~/.local/share/notebooklm-mcp/chrome_profile
macOS:   ~/Library/Application Support/notebooklm-mcp/chrome_profile
```

**The problem:** Chrome can only open a profile in one instance at a time. When you try to run both:

- HTTP server (via `npm run daemon:start` or `npm run start:http`)
- MCP stdio server (via Claude Desktop, Cursor, etc.)

The second instance will fail to launch Chrome with this error:

```
Error: browserType.launchPersistentContext: Target page, context or browser has been closed
```

### Who Is Affected?

| Scenario             | Affected? | Why                                                |
| -------------------- | --------- | -------------------------------------------------- |
| **Single mode user** | ❌ No     | Only runs one server at a time                     |
| **HTTP-only user**   | ❌ No     | Only uses HTTP server for n8n/Zapier               |
| **MCP-only user**    | ❌ No     | Only uses Claude Desktop/Cursor                    |
| **Dual mode user**   | ✅ Yes    | Wants both HTTP API and Claude Desktop integration |

### Current Workarounds

#### Option A: Use HTTP Server Only

```bash
# Start HTTP server
npm run daemon:start

# Stop MCP stdio server (remove from Claude Desktop config)
# Use HTTP API for all integrations (n8n, Zapier, custom apps)
```

#### Option B: Use MCP Stdio Only

```bash
# Stop HTTP server
npm run daemon:stop

# Use only Claude Desktop/Cursor/Codex integration
```

#### Option C: Switch Between Modes

```bash
# For n8n workflows
npm run daemon:start

# For Claude Desktop work
npm run daemon:stop
# Then restart Claude Desktop
```

## 🔮 Planned Solution (v1.4.0+)

### Option 1: Separate Chrome Profiles by Mode ⭐ (Selected)

**Implementation:** Detect the runtime mode and use different Chrome profiles.

```typescript
// Automatic profile detection based on mode
const getProfilePath = () => {
  const baseDir = getDataDirectory();
  const mode = process.env.MCP_MODE || (process.stdout.isTTY ? 'stdio' : 'http');

  return {
    stdio: path.join(baseDir, 'chrome_profile_stdio'), // For Claude Desktop
    http: path.join(baseDir, 'chrome_profile_http'), // For HTTP server
  }[mode];
};
```

**Benefits:**

- ✅ Both modes can run simultaneously
- ✅ No user configuration needed
- ✅ Separate authentication per mode
- ✅ Simple implementation

**Trade-offs:**

- Each mode needs separate authentication (one-time setup)
- Two Chrome profiles consume more disk space (~100-200MB each)

### Option 2: Shared Session via IPC

**Implementation:** HTTP server becomes the master, stdio clients connect to it.

**Benefits:**

- ✅ Single Chrome instance
- ✅ Shared authentication

**Trade-offs:**

- ❌ Complex architecture
- ❌ HTTP server must be running for stdio to work
- ❌ Requires inter-process communication

### Option 3: Better Error Messages

**Implementation:** Detect profile lock and show helpful error.

**Benefits:**

- ✅ Clear user guidance

**Trade-offs:**

- ❌ Doesn't solve the root problem
- ❌ Users still can't run both modes

## 🛠️ Implementation Plan

### Phase 1: Separate Chrome Profiles (v1.4.0)

**Changes:**

1. Add `MCP_MODE` environment variable detection
2. Create mode-specific profile directories
3. Update authentication flow to use correct profile
4. Update documentation

**Code locations:**

- `src/auth/shared-context-manager.ts` - Profile path logic
- `src/config.ts` - Mode detection
- `src/index.ts` - HTTP server mode flag
- `src/http-wrapper.ts` - HTTP mode environment

**Backwards compatibility:**

- Existing `chrome_profile` directory will be migrated to `chrome_profile_stdio`
- HTTP server will create new `chrome_profile_http`
- Users will need to re-authenticate HTTP mode once

### Phase 2: Migration & Testing

**Migration script:**

```typescript
// Auto-migrate existing profile to stdio mode
if (exists('chrome_profile') && !exists('chrome_profile_stdio')) {
  rename('chrome_profile', 'chrome_profile_stdio');
  log('Migrated existing profile to stdio mode');
}
```

**Testing checklist:**

- [ ] HTTP server starts with separate profile
- [ ] MCP stdio starts with separate profile
- [ ] Both can run simultaneously
- [ ] Authentication works independently in each mode
- [ ] Existing users migrate smoothly
- [ ] Documentation updated

### Phase 3: Documentation Updates

**Files to update:**

- `README.md` - Remove limitation warning
- `deployment/docs/01-INSTALL.md` - Update installation flow
- `deployment/docs/05-TROUBLESHOOTING.md` - Update troubleshooting
- `CHANGELOG.md` - Document breaking changes

## 📝 For Developers

### Testing the Fix Locally

```bash
# Terminal 1: Start HTTP server
MCP_MODE=http npm run start:http

# Terminal 2: Start stdio server (simulate Claude Desktop)
MCP_MODE=stdio node dist/index.js

# Both should start without conflict
```

### Verifying Profile Separation

```bash
# Check both profiles exist
ls -la ~/.local/share/notebooklm-mcp/
# Should show:
# - chrome_profile_http/
# - chrome_profile_stdio/

# Check profile usage
lsof | grep chrome_profile  # Linux/macOS
# or
Get-Process | Where-Object {$_.Path -like "*chrome*"}  # Windows PowerShell
```

## 🤝 Contributing

If you want to implement this feature or have alternative solutions:

1. Open an issue on GitHub describing your approach
2. Reference this document in your PR
3. Include tests for both HTTP and stdio modes running simultaneously
4. Update documentation accordingly

## 📚 Related Issues

- [Issue #XX] Chrome profile conflict between HTTP and stdio modes
- [Issue #YY] Support running multiple MCP server instances

## 🔗 See Also

- [Installation Guide](../deployment/docs/01-INSTALL.md)
- [Troubleshooting Guide](../deployment/docs/05-TROUBLESHOOTING.md)
- [Architecture Overview](../deployment/docs/02-CONFIGURATION.md)
