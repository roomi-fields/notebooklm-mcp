#!/bin/bash
# NotebookLM MCP HTTP Server - WSL Helper Script
# This script helps interact with the Windows-hosted MCP server from WSL
#
# Usage:
#   ./mcp-wsl-helper.sh start          Start the server (Windows)
#   ./mcp-wsl-helper.sh stop           Stop the server
#   ./mcp-wsl-helper.sh status         Check if server is running
#   ./mcp-wsl-helper.sh health         Get health status
#   ./mcp-wsl-helper.sh ask "question" Ask a question to the active notebook
#   ./mcp-wsl-helper.sh auth           Launch authentication (opens Chrome)

set -e

MCP_PORT=3000
MCP_DIR="D:/path/to/notebooklm-mcp"

# Helper function to call the API via PowerShell (bypasses WSL network issues)
call_api() {
    local method="$1"
    local endpoint="$2"
    local body="$3"

    if [ -n "$body" ]; then
        powershell.exe -Command "Invoke-RestMethod -Uri 'http://localhost:${MCP_PORT}${endpoint}' -Method ${method} -ContentType 'application/json' -Body '${body}' | ConvertTo-Json -Depth 10" 2>&1
    else
        powershell.exe -Command "Invoke-RestMethod -Uri 'http://localhost:${MCP_PORT}${endpoint}' -Method ${method} | ConvertTo-Json -Depth 10" 2>&1
    fi
}

# Check if server is running
is_running() {
    cmd.exe /c "netstat -ano | findstr :${MCP_PORT} | findstr LISTENING" >/dev/null 2>&1
}

# Get server PID
get_pid() {
    cmd.exe /c "netstat -ano | findstr :${MCP_PORT} | findstr LISTENING" 2>/dev/null | awk '{print $5}' | tr -d '\r'
}

case "$1" in
    start)
        if is_running; then
            echo "Server already running (PID: $(get_pid))"
            exit 0
        fi
        echo "Starting NotebookLM MCP HTTP Server..."
        powershell.exe -Command "Start-Process -NoNewWindow -FilePath 'node' -ArgumentList '${MCP_DIR}/dist/http-wrapper.js' -WorkingDirectory '${MCP_DIR}'" 2>&1
        sleep 3
        if is_running; then
            echo "Server started successfully (PID: $(get_pid))"
            echo "Health: http://localhost:${MCP_PORT}/health"
        else
            echo "Failed to start server"
            exit 1
        fi
        ;;

    stop)
        if ! is_running; then
            echo "Server not running"
            exit 0
        fi
        PID=$(get_pid)
        echo "Stopping server (PID: ${PID})..."
        cmd.exe /c "taskkill /PID ${PID} /F" 2>&1
        echo "Server stopped"
        ;;

    status)
        if is_running; then
            echo "Server is RUNNING (PID: $(get_pid))"
            echo ""
            call_api "GET" "/health"
        else
            echo "Server is STOPPED"
            exit 1
        fi
        ;;

    health)
        if ! is_running; then
            echo '{"success":false,"error":"Server not running"}'
            exit 1
        fi
        call_api "GET" "/health"
        ;;

    auth)
        if ! is_running; then
            echo "Server not running. Start it first with: $0 start"
            exit 1
        fi
        echo "Launching authentication (Chrome will open)..."
        call_api "POST" "/setup-auth" '{"show_browser": true}'
        ;;

    ask)
        if [ -z "$2" ]; then
            echo "Usage: $0 ask \"your question here\" [notebook_id]"
            exit 1
        fi
        if ! is_running; then
            echo '{"success":false,"error":"Server not running"}'
            exit 1
        fi
        QUESTION="$2"
        NOTEBOOK_ID="${3:-}"

        if [ -n "$NOTEBOOK_ID" ]; then
            BODY="{\"question\": \"${QUESTION}\", \"notebook_id\": \"${NOTEBOOK_ID}\"}"
        else
            BODY="{\"question\": \"${QUESTION}\"}"
        fi

        call_api "POST" "/ask" "$BODY"
        ;;

    notebooks)
        if ! is_running; then
            echo '{"success":false,"error":"Server not running"}'
            exit 1
        fi
        call_api "GET" "/notebooks"
        ;;

    *)
        echo "NotebookLM MCP HTTP Server - WSL Helper"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  start              Start the server (Windows background process)"
        echo "  stop               Stop the server"
        echo "  status             Check server status and health"
        echo "  health             Get health status (JSON)"
        echo "  auth               Launch authentication (opens Chrome)"
        echo "  ask \"question\"     Ask a question to the active notebook"
        echo "  notebooks          List available notebooks"
        echo ""
        echo "Examples:"
        echo "  $0 start"
        echo "  $0 ask \"What is the main topic?\" my-notebook"
        echo "  $0 status"
        ;;
esac
