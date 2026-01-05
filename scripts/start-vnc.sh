#!/bin/bash
# Start VNC services for browser visibility in Docker
# This allows users to see and interact with Chromium via noVNC web interface

set -e

DISPLAY_NUM="${DISPLAY_NUM:-99}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"
SCREEN_RESOLUTION="${SCREEN_RESOLUTION:-1280x800x24}"

export DISPLAY=":${DISPLAY_NUM}"

echo "[VNC] Starting Xvfb on display :${DISPLAY_NUM}..."
Xvfb :${DISPLAY_NUM} -screen 0 ${SCREEN_RESOLUTION} -ac &
sleep 1

echo "[VNC] Starting fluxbox window manager..."
fluxbox &
sleep 1

echo "[VNC] Starting x11vnc on port ${VNC_PORT}..."
x11vnc -display :${DISPLAY_NUM} -forever -shared -rfbport ${VNC_PORT} -nopw -xkb &
sleep 1

echo "[VNC] Starting noVNC websockify on port ${NOVNC_PORT}..."
# noVNC location on Debian
NOVNC_DIR="/usr/share/novnc"
if [ -d "$NOVNC_DIR" ]; then
    websockify --web=${NOVNC_DIR} ${NOVNC_PORT} localhost:${VNC_PORT} &
else
    echo "[VNC] Warning: noVNC directory not found at ${NOVNC_DIR}"
    websockify ${NOVNC_PORT} localhost:${VNC_PORT} &
fi

echo "[VNC] VNC services started successfully"
echo "[VNC] Access browser at: http://localhost:${NOVNC_PORT}/vnc.html"
