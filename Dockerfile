FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    xvfb x11vnc novnc websockify fluxbox \
    fonts-liberation fonts-noto-color-emoji wget ca-certificates procps \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r notebooklm && useradd -r -g notebooklm -d /home/notebooklm notebooklm \
    && mkdir -p /home/notebooklm /app /data \
    && chown -R notebooklm:notebooklm /home/notebooklm /app /data \
    && mkdir -p /tmp/.X11-unix \
    && chmod 1777 /tmp/.X11-unix

WORKDIR /app

# Copier package files
COPY --chown=notebooklm:notebooklm package*.json ./

USER notebooklm

# Installer TOUTES les dépendances (avec devDependencies pour TypeScript)
RUN npm ci --ignore-scripts

# Copier les sources AVANT de builder
COPY --chown=notebooklm:notebooklm src/ ./src/
COPY --chown=notebooklm:notebooklm tsconfig*.json ./

# Builder
RUN npm run build

# Copier scripts
COPY --chown=notebooklm:notebooklm scripts/ ./scripts/

# Supprimer les devDependencies après le build
RUN npm prune --omit=dev

# Installer le browser
RUN npx patchright install chromium

USER root
RUN chmod +x /app/scripts/*.sh
USER notebooklm

ENV NODE_ENV=production \
    HTTP_PORT=3000 \
    HTTP_HOST=0.0.0.0 \
    HEADLESS=true \
    NOTEBOOKLM_DATA_DIR=/data \
    PLAYWRIGHT_BROWSERS_PATH=/home/notebooklm/.cache/ms-playwright \
    DISPLAY=:99 \
    NOVNC_PORT=6080

EXPOSE 3000 6080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

VOLUME ["/data"]

CMD ["/app/scripts/docker-entrypoint.sh"]
