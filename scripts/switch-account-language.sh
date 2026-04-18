#!/bin/bash
# Switch Account Language Script
#
# This script automates the process of switching an account to a new language.
# It deletes the Chrome profile cache and re-authenticates to get a fresh profile
# with the new language settings from Google Account.
#
# PREREQUISITE: You must first change the language in Google Account settings:
# https://myaccount.google.com/language
#
# Usage:
#   ./switch-account-language.sh --account=account-a --lang=en
#   ./switch-account-language.sh --account=account-b --lang=fr
#   ./switch-account-language.sh --account=account-c --lang=en --show

set -e

# Default values
ACCOUNT=""
LANG=""
SHOW_BROWSER=""

# Account configurations — edit for your own accounts
declare -A ACCOUNT_IDS=(
  ["account-a"]="account-0000000000001"
  ["account-b"]="account-0000000000002"
  ["account-c"]="account-0000000000003"
)

declare -A ACCOUNT_EMAILS=(
  ["account-a"]="your-account-a@example.com"
  ["account-b"]="your-account-b@example.com"
  ["account-c"]="your-account-c@example.com"
)

# Data path — override via NOTEBOOKLM_DATA_PATH env var
DATA_PATH="${NOTEBOOKLM_DATA_PATH:-/mnt/c/Users/$USER/AppData/Local/notebooklm-mcp/Data}"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --account=*)
      ACCOUNT="${arg#*=}"
      ;;
    --lang=*)
      LANG="${arg#*=}"
      ;;
    --show)
      SHOW_BROWSER="--show"
      ;;
    --help)
      echo "Switch Account Language Script"
      echo ""
      echo "PREREQUISITE: Change language in Google Account first:"
      echo "  https://myaccount.google.com/language"
      echo ""
      echo "Usage: ./switch-account-language.sh [options]"
      echo ""
      echo "Options:"
      echo "  --account=NAME    Account key from ACCOUNT_IDS (required)"
      echo "  --lang=LANG       Target language: en|fr (required)"
      echo "  --show            Show browser during re-authentication"
      echo "  --help            Show this help"
      echo ""
      echo "Examples:"
      echo "  ./switch-account-language.sh --account=account-a --lang=en"
      echo "  ./switch-account-language.sh --account=account-b --lang=fr --show"
      exit 0
      ;;
  esac
done

# Validate arguments
if [ -z "$ACCOUNT" ]; then
  echo "ERROR: --account is required"
  echo "Use --help for usage information"
  exit 1
fi

if [ -z "$LANG" ]; then
  echo "ERROR: --lang is required"
  echo "Use --help for usage information"
  exit 1
fi

if [ -z "${ACCOUNT_IDS[$ACCOUNT]}" ]; then
  echo "ERROR: Unknown account '$ACCOUNT'"
  echo "Valid accounts: ${!ACCOUNT_IDS[*]}"
  exit 1
fi

if [ "$LANG" != "en" ] && [ "$LANG" != "fr" ]; then
  echo "ERROR: Invalid language '$LANG'"
  echo "Valid languages: en, fr"
  exit 1
fi

ACCOUNT_ID="${ACCOUNT_IDS[$ACCOUNT]}"
ACCOUNT_EMAIL="${ACCOUNT_EMAILS[$ACCOUNT]}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Switch Account Language                                    ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Account: $ACCOUNT ($ACCOUNT_EMAIL)"
echo "║  Target:  $LANG"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Stop server and Chrome
echo "Step 1/5: Stopping server and Chrome..."
cmd.exe /c "taskkill /F /IM node.exe" 2>/dev/null || true
sleep 1
# Only kill Chrome if profile is locked (don't kill user's personal browser)
if [ -f "$DATA_PATH/chrome_profile/lockfile" ] 2>/dev/null; then
  echo "  Chrome profile locked, killing Chrome..."
  cmd.exe /c "taskkill /F /IM chrome.exe" 2>/dev/null || true
  sleep 2
fi
echo "  Done."

# Step 2: Delete account's Chrome profile (to clear language cache)
echo ""
echo "Step 2/5: Deleting Chrome profile cache for $ACCOUNT..."
ACCOUNT_PROFILE="$DATA_PATH/accounts/$ACCOUNT_ID/profile"
if [ -d "$ACCOUNT_PROFILE" ]; then
  rm -rf "$ACCOUNT_PROFILE"
  echo "  Deleted: $ACCOUNT_PROFILE"
else
  echo "  Profile not found (already clean)"
fi
echo "  Done."

# Step 3: Re-authenticate to create fresh profile
echo ""
echo "Step 3/5: Re-authenticating $ACCOUNT..."
echo "  This will open a browser to log in with the new language settings."
echo ""

cd /mnt/d/path/to/notebooklm-mcp
cmd.exe /c "cd /d D:\\path\\to\\notebooklm-mcp && npm run accounts test $ACCOUNT_ID -- $SHOW_BROWSER"

echo "  Done."

# Step 4: Sync new profile to main
echo ""
echo "Step 4/5: Syncing new profile to main..."

# Sync state.json
if [ -f "$DATA_PATH/accounts/$ACCOUNT_ID/browser_state/state.json" ]; then
  cp "$DATA_PATH/accounts/$ACCOUNT_ID/browser_state/state.json" "$DATA_PATH/browser_state/"
  echo "  Synced state.json"
else
  echo "  WARNING: state.json not found"
fi

# Sync Chrome profile
rm -rf "$DATA_PATH/chrome_profile" 2>/dev/null || true
if [ -d "$DATA_PATH/accounts/$ACCOUNT_ID/profile" ]; then
  cp -r "$DATA_PATH/accounts/$ACCOUNT_ID/profile" "$DATA_PATH/chrome_profile"
  echo "  Synced Chrome profile"
else
  echo "  WARNING: Chrome profile not found"
fi
echo "  Done."

# Step 5: Restart server with correct locale
echo ""
echo "Step 5/5: Starting server with UI locale '$LANG'..."

# Convert lang to uppercase for display
LANG_UPPER=$(echo "$LANG" | tr '[:lower:]' '[:upper:]')

cmd.exe /c "cd /d D:\\path\\to\\notebooklm-mcp && set NOTEBOOKLM_UI_LOCALE=$LANG&& start /B node dist/http-wrapper.js" &
sleep 4

# Verify
echo ""
echo "Verifying server..."
HEALTH=$(cmd.exe /c "curl -s http://localhost:3000/health" 2>/dev/null || echo '{"error":"failed"}')
echo "$HEALTH" | head -c 200

echo ""
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  COMPLETED                                                  ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Account '$ACCOUNT' is now configured for '$LANG_UPPER'."
echo "║                                                             ║"
echo "║  IMPORTANT: Verify visually that NotebookLM UI is in $LANG_UPPER    ║"
echo "║  by running a test with show_browser:true                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
