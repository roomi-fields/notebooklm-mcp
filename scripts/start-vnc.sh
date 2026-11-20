#!/bin/bash
# Start VNC services for browser visibility in Docker
# This allows users to see and interact with Chromium via noVNC web interface.
#
# The display shows the Chromium that holds the user's Google session, so the
# console is a credential (GHSA-qhvm-xwjm-g4f8): it was served with no password
# and published on every interface. Now:
#   - x11vnc requires a password and listens on loopback only, so the one way
#     in is websockify/noVNC, and noVNC asks for that password;
#   - the password is VNC_PASSWORD, or a random one printed once to the logs.

set -e

DISPLAY_NUM="${DISPLAY_NUM:-99}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"
SCREEN_RESOLUTION="${SCREEN_RESOLUTION:-1280x800x24}"

export DISPLAY=":${DISPLAY_NUM}"

# VNC authentication only reads the first 8 characters of a password.
if [ -z "${VNC_PASSWORD}" ]; then
    VNC_PASSWORD="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 8)"
    VNC_PASSWORD_GENERATED=true
elif [ "${#VNC_PASSWORD}" -gt 8 ]; then
    echo "[VNC] Note: VNC only checks the first 8 characters of VNC_PASSWORD."
fi
VNC_PASSWD_FILE="${HOME:-/tmp}/.vnc/passwd"
mkdir -p "$(dirname "${VNC_PASSWD_FILE}")"
x11vnc -storepasswd "${VNC_PASSWORD}" "${VNC_PASSWD_FILE}" > /dev/null 2>&1
chmod 600 "${VNC_PASSWD_FILE}"

echo "[VNC] Starting Xvfb on display :${DISPLAY_NUM}..."
# -nolisten tcp: the display is reachable through its local socket only.
Xvfb :${DISPLAY_NUM} -screen 0 ${SCREEN_RESOLUTION} -nolisten tcp -ac &
sleep 1

echo "[VNC] Starting fluxbox window manager..."
fluxbox &
sleep 1

echo "[VNC] Starting x11vnc on 127.0.0.1:${VNC_PORT} (password required)..."
x11vnc -display :${DISPLAY_NUM} -forever -shared -localhost -rfbport ${VNC_PORT} \
    -rfbauth "${VNC_PASSWD_FILE}" -xkb &
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
if [ "${VNC_PASSWORD_GENERATED}" = "true" ]; then
    echo "[VNC] Password (generated for this start; set VNC_PASSWORD to choose one): ${VNC_PASSWORD}"
else
    echo "[VNC] Password: the value of VNC_PASSWORD"
fi
unset VNC_PASSWORD
