#!/bin/bash
# E2E Test Runner
#
# Usage:
#   ./run-e2e.sh                        # Quick mode, FR, default account
#   ./run-e2e.sh --mode=full            # Full mode (76 tests)
#   ./run-e2e.sh --lang=en              # English UI
#   ./run-e2e.sh --account=account-c      # Specific account
#   ./run-e2e.sh --test=01              # Run specific test file
#   ./run-e2e.sh --mode=full --lang=en --account=account-b  # Combined

# Default values
MODE="quick"
LANG="fr"
ACCOUNT="account-b"
TEST_FILE=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --mode=*)
      MODE="${arg#*=}"
      ;;
    --lang=*)
      LANG="${arg#*=}"
      ;;
    --account=*)
      ACCOUNT="${arg#*=}"
      ;;
    --test=*)
      TEST_FILE="${arg#*=}"
      ;;
    --help)
      echo "E2E Test Runner"
      echo ""
      echo "Usage: ./run-e2e.sh [options]"
      echo ""
      echo "Options:"
      echo "  --mode=quick|full     Test mode (default: quick)"
      echo "  --lang=fr|en          UI language (default: fr)"
      echo "  --account=NAME        Account: account-b|account-b|account-c (default: account-b)"
      echo "  --test=XX             Run specific test file (e.g., 01, 02, 03)"
      echo "  --help                Show this help"
      echo ""
      echo "Examples:"
      echo "  ./run-e2e.sh --mode=full --lang=en"
      echo "  ./run-e2e.sh --test=03 --account=account-c"
      exit 0
      ;;
  esac
done

# Display configuration
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  E2E Test Runner                                           ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Mode:    $MODE"
echo "║  Lang:    $LANG"
echo "║  Account: $ACCOUNT"
if [ -n "$TEST_FILE" ]; then
echo "║  Test:    $TEST_FILE"
fi
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Set environment variables
export TEST_MODE="$MODE"
export TEST_LANG="$LANG"
export TEST_ACCOUNT="$ACCOUNT"
export NBLM_INTEGRATION_TESTS="true"

# Change to project root
cd "$(dirname "$0")/../.."

# Build if needed
if [ ! -d "dist" ]; then
  echo "Building project..."
  npm run build
fi

# Run tests with ESM support
export NODE_OPTIONS="--experimental-vm-modules"
if [ -n "$TEST_FILE" ]; then
  # Run specific test file
  npx jest --testPathPatterns="tests/e2e/tests/${TEST_FILE}.*\\.test\\.ts$" --verbose --runInBand --no-coverage
else
  # Run all E2E tests
  npx jest --testPathPatterns="tests/e2e/tests/.*\\.test\\.ts$" --verbose --runInBand --no-coverage
fi

# Capture exit code
EXIT_CODE=$?

echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Some tests failed (exit code: $EXIT_CODE)"
fi
echo "═══════════════════════════════════════════════════════════════"

exit $EXIT_CODE
