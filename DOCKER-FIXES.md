# Docker Deployment - FONCTIONNEL ✅

## État (2025-01-05 22:10)

- ✅ Docker build OK
- ✅ noVNC fonctionne
- ✅ Auth Google réussie

## Bugs corrigés

1. Route `/` manquante
2. Locale hardcodée `en-US`
3. Browser channel `chrome` incompatible
4. patchright vs playwright install
5. show_browser non passé
6. Chromium timeout (flags Docker manquants)

## Flags Chromium Docker

`--no-sandbox --disable-setuid-sandbox --disable-gpu --disable-infobars --log-level=3`

## Utilisation

1. Ouvrir http://filer:6080/vnc.html
2. `curl -X POST http://filer:3000/setup-auth -d '{"show_browser":true}'`
3. Se connecter à Google dans VNC

## Déploiement one-liner

```bash
npm run build && docker build -t notebooklm-mcp:latest . && docker save notebooklm-mcp:latest | gzip > notebooklm-mcp.tar.gz && ssh romainadmin@filer "cat > ~/notebooklm-mcp.tar.gz" < notebooklm-mcp.tar.gz && ssh romainadmin@filer '/usr/local/bin/docker load < ~/notebooklm-mcp.tar.gz && /usr/local/bin/docker stop notebooklm-mcp; /usr/local/bin/docker rm notebooklm-mcp; /usr/local/bin/docker run -d --name notebooklm-mcp --restart unless-stopped -p 3000:3000 -p 6080:6080 -v /volume1/docker/notebooklm/data:/data -e NODE_ENV=production -e HEADLESS=true -e STEALTH_ENABLED=true -e NOTEBOOKLM_UI_LOCALE=fr notebooklm-mcp:latest'
```
