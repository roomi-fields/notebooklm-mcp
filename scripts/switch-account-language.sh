#!/bin/bash
# Switch Account Language Script
#
# Refreshes one account profile after the user changes the Google Account
# language. This script is intentionally generic: you provide the account ID,
# repo root, and optionally the NotebookLM data directory.

set -euo pipefail

ACCOUNT_ID=""
LANG=""
SHOW_BROWSER=""
REPO_ROOT=""
DATA_PATH="${NOTEBOOKLM_DATA_PATH:-}"

usage() {
  echo "Switch Account Language Script"
  echo ""
  echo "Prerequisite:"
  echo "  Change the Google Account language first:"
  echo "  https://myaccount.google.com/language"
  echo ""
  echo "Usage:"
  echo "  ./scripts/switch-account-language.sh --account-id=account-0000000000001 --lang=en --repo-root=/absolute/path/to/notebooklm-mcp"
  echo ""
  echo "Options:"
  echo "  --account-id=ID   Account directory ID under Data/accounts/ (required)"
  echo "  --lang=LANG       Target UI locale: en|fr (required)"
  echo "  --repo-root=PATH  Repo root containing package.json (required unless run there)"
  echo "  --data-path=PATH  NotebookLM data directory override"
  echo "  --show            Show browser during re-authentication"
  echo "  --help            Show this help"
}

for arg in "$@"; do
  case $arg in
    --account-id=*)
      ACCOUNT_ID="${arg#*=}"
      ;;
    --lang=*)
      LANG="${arg#*=}"
      ;;
    --repo-root=*)
      REPO_ROOT="${arg#*=}"
      ;;
    --data-path=*)
      DATA_PATH="${arg#*=}"
      ;;
    --show)
      SHOW_BROWSER="--show"
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $arg"
      usage
      exit 1
      ;;
  esac
done

if [ -z "$ACCOUNT_ID" ]; then
  echo "ERROR: --account-id is required"
  usage
  exit 1
fi

if [ -z "$LANG" ]; then
  echo "ERROR: --lang is required"
  usage
  exit 1
fi

if [ "$LANG" != "en" ] && [ "$LANG" != "fr" ]; then
  echo "ERROR: --lang must be en or fr"
  exit 1
fi

if [ -z "$REPO_ROOT" ]; then
  if [ -f "./package.json" ]; then
    REPO_ROOT="$(pwd)"
  else
    echo "ERROR: --repo-root is required unless you run the script from the repo root"
    exit 1
  fi
fi

if [ ! -f "$REPO_ROOT/package.json" ]; then
  echo "ERROR: package.json not found in repo root: $REPO_ROOT"
  exit 1
fi

if [ -z "$DATA_PATH" ]; then
  if [ -n "${LOCALAPPDATA:-}" ]; then
    DATA_PATH="${LOCALAPPDATA}/notebooklm-mcp/Data"
  else
    echo "ERROR: data path not set. Use --data-path or NOTEBOOKLM_DATA_PATH."
    exit 1
  fi
fi

echo "Switching account language"
echo "  account-id: $ACCOUNT_ID"
echo "  locale:     $LANG"
echo "  repo-root:  $REPO_ROOT"
echo "  data-path:  $DATA_PATH"
echo ""

echo "Step 1/5: Stopping repo-related Node processes..."
cmd.exe /c "taskkill /F /IM node.exe" 2>/dev/null || true
sleep 1

echo "Step 2/5: Removing cached profile for the selected account..."
ACCOUNT_PROFILE="$DATA_PATH/accounts/$ACCOUNT_ID/profile"
if [ -d "$ACCOUNT_PROFILE" ]; then
  rm -rf "$ACCOUNT_PROFILE"
  echo "  Removed $ACCOUNT_PROFILE"
else
  echo "  No account profile found to remove"
fi

echo "Step 3/5: Re-authenticating the selected account..."
cmd.exe /c "cd /d $REPO_ROOT && npm run accounts test $ACCOUNT_ID -- $SHOW_BROWSER"

echo "Step 4/5: Syncing the refreshed profile into the active data path..."
if [ -f "$DATA_PATH/accounts/$ACCOUNT_ID/browser_state/state.json" ]; then
  mkdir -p "$DATA_PATH/browser_state"
  cp "$DATA_PATH/accounts/$ACCOUNT_ID/browser_state/state.json" "$DATA_PATH/browser_state/state.json"
  echo "  Synced browser_state/state.json"
else
  echo "  WARNING: browser_state/state.json not found for $ACCOUNT_ID"
fi

rm -rf "$DATA_PATH/chrome_profile" 2>/dev/null || true
if [ -d "$DATA_PATH/accounts/$ACCOUNT_ID/profile" ]; then
  cp -r "$DATA_PATH/accounts/$ACCOUNT_ID/profile" "$DATA_PATH/chrome_profile"
  echo "  Synced chrome_profile/"
else
  echo "  WARNING: refreshed profile not found for $ACCOUNT_ID"
fi

echo "Step 5/5: Restarting the HTTP server with the requested locale..."
cmd.exe /c "cd /d $REPO_ROOT && set NOTEBOOKLM_UI_LOCALE=$LANG&& start /B node dist/http-wrapper.js" >/dev/null
sleep 4

echo ""
echo "Health check:"
cmd.exe /c "curl -s http://127.0.0.1:3000/health" || true
