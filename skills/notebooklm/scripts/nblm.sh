#!/usr/bin/env bash
#
# nblm.sh — thin REST client for the NotebookLM MCP server
# (@roomi-fields/notebooklm-mcp HTTP API).
#
# It never starts a server itself; it talks to one already running at
# NOTEBOOKLM_SERVER_URL (default http://localhost:3000). Use `health` first to
# confirm reachability + auth, and `auth` once to log in.
#
# Usage:
#   nblm.sh health
#   nblm.sh auth
#   nblm.sh notebooks
#   nblm.sh ask "<question>" [notebook_id]
#   nblm.sh search "<query>" <notebook_id> [limit]
#   nblm.sh generate <notebook_id> <audio|report|video|infographic|presentation|data_table|flashcards|quiz|mind_map>
#
set -euo pipefail

BASE="${NOTEBOOKLM_SERVER_URL:-${MCP_HTTP_URL:-http://localhost:3000}}"
BASE="${BASE%/}"
PKG="@roomi-fields/notebooklm-mcp"

_json() { # JSON-encode a single string argument
  python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"
}

_req() { # method path [json-body]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$BASE$path" -H 'Content-Type: application/json' -d "$body"
  else
    curl -fsS -X "$method" "$BASE$path"
  fi
}

_need_server() {
  if ! curl -fsS "$BASE/health" >/dev/null 2>&1; then
    echo "No NotebookLM server reachable at $BASE." >&2
    echo "Start one first (from a clone: 'npm run start:http'), or set NOTEBOOKLM_SERVER_URL." >&2
    echo "If the notebooklm MCP tools are available in this session, prefer those instead." >&2
    exit 3
  fi
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  health)
    curl -fsS "$BASE/health" || { echo "unreachable at $BASE" >&2; exit 3; }
    ;;
  auth)
    # One-time interactive Google login (opens a visible Chrome window).
    exec npx -y -p "$PKG" notebooklm-mcp-setup-auth "$@"
    ;;
  notebooks)
    _need_server
    _req GET /notebooks
    ;;
  ask)
    _need_server
    q="${1:?usage: ask \"<question>\" [notebook_id]}"; nb="${2:-}"
    if [ -n "$nb" ]; then
      _req POST /ask "$(printf '{"question":%s,"notebook_id":%s,"source_format":"json"}' "$(_json "$q")" "$(_json "$nb")")"
    else
      _req POST /ask "$(printf '{"question":%s,"source_format":"json"}' "$(_json "$q")")"
    fi
    ;;
  search)
    # Retrieval, not generation: returns the indexed passages themselves and
    # costs no chat quota. Prefer it over `ask` when you want the evidence.
    _need_server
    q="${1:?usage: search \"<query>\" <notebook_id> [limit]}"; nb="${2:?notebook_id}"; lim="${3:-10}"
    _req POST "/notebooks/$nb/search" \
      "$(printf '{"query":%s,"limit":%s}' "$(_json "$q")" "$lim")"
    ;;
  generate)
    _need_server
    nb="${1:?notebook_id}"; type="${2:?content type}"
    case "$type" in
      flashcards|quiz)
        _req POST /content/study-aid "$(printf '{"notebook_id":%s,"kind":%s}' "$(_json "$nb")" "$(_json "$type")")" ;;
      mind_map|mindmap)
        _req POST /content/mind-map "$(printf '{"notebook_id":%s}' "$(_json "$nb")")" ;;
      *)
        _req POST /content/generate "$(printf '{"notebook_id":%s,"content_type":%s}' "$(_json "$nb")" "$(_json "$type")")" ;;
    esac
    ;;
  help|*)
    sed -n '3,20p' "$0"
    ;;
esac
