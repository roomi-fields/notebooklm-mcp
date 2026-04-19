# Docker Deployment

Run NotebookLM MCP Server in a Docker container for isolated, reproducible deployments.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Using Docker CLI

```bash
# Build image
docker build -t notebooklm-mcp .

# Run container
docker run -d \
  --name notebooklm-mcp \
  --restart unless-stopped \
  -p 3000:3000 \
  -p 6080:6080 \
  -v notebooklm-data:/data \
  -e HEADLESS=true \
  -e STEALTH_ENABLED=true \
  -e NOTEBOOKLM_UI_LOCALE=fr \
  notebooklm-mcp
```

## Ports

| Port | Description                              |
| ---- | ---------------------------------------- |
| 3000 | HTTP REST API                            |
| 6080 | noVNC web interface (for authentication) |

## First-Time Authentication via noVNC

Docker includes a **noVNC server** for visual browser access, required for initial Google authentication.

### Step 1: Open noVNC

Open in your browser:

```
http://localhost:6080/vnc.html
```

### Step 2: Trigger Authentication

```bash
curl -X POST http://localhost:3000/setup-auth \
  -H "Content-Type: application/json" \
  -d '{"show_browser": true}'
```

### Step 3: Login in noVNC

1. The Chromium browser appears in the noVNC window
2. Complete Google login
3. Authentication is saved automatically
4. Browser closes when done

### Verify Authentication

```bash
curl http://localhost:3000/health
# → {"success":true,"data":{"authenticated":true,...}}
```

## Alternative: Copy Existing Credentials

If you've already authenticated locally:

```bash
# Copy from local machine to container
docker cp ~/.local/share/notebooklm-mcp/. notebooklm-mcp:/data/

# Restart container
docker restart notebooklm-mcp
```

## Configuration

### Environment Variables

| Variable               | Default   | Description           |
| ---------------------- | --------- | --------------------- |
| `HTTP_PORT`            | `3000`    | HTTP server port      |
| `HTTP_HOST`            | `0.0.0.0` | HTTP server host      |
| `HEADLESS`             | `true`    | Run browser headless  |
| `STEALTH_ENABLED`      | `true`    | Enable anti-detection |
| `NOTEBOOKLM_DATA_DIR`  | `/data`   | Data directory path   |
| `NOTEBOOKLM_UI_LOCALE` | `fr`      | UI language (fr/en)   |
| `AUTO_LOGIN_ENABLED`   | `false`   | Enable auto-login     |
| `ENABLE_VNC`           | `true`    | Enable noVNC server   |
| `NOVNC_PORT`           | `6080`    | noVNC web port        |

### Custom Configuration

Edit `docker-compose.yml` to customize:

```yaml
environment:
  - HEADLESS=true
  - NOTEBOOKLM_UI_LOCALE=en
  - AUTO_LOGIN_ENABLED=true
```

## Data Persistence

All data is stored in the `/data` volume:

```
/data/
├── library.json          # Notebook library
├── chrome_profile/       # Chrome profile (Google session)
├── browser_state/        # Browser state backup
├── accounts.json         # Account configuration
├── accounts/             # Per-account data
│   └── account-xxx/
│       ├── credentials.enc.json
│       ├── quota.json
│       └── state.json
└── encryption.key        # Encryption key
```

### Backup

```bash
# Backup data volume
docker run --rm \
  -v notebooklm-mcp-data:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/notebooklm-backup.tar.gz -C /data .

# Restore
docker run --rm \
  -v notebooklm-mcp-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/notebooklm-backup.tar.gz -C /data
```

## NAS Deployment (Synology, QNAP)

### Build and Export

```bash
# On your local machine
npm run build
docker build -t notebooklm-mcp:latest .
docker save notebooklm-mcp:latest | gzip > notebooklm-mcp.tar.gz
```

### Upload and Deploy

```bash
# Upload to NAS
scp notebooklm-mcp.tar.gz user@nas:/volume1/docker/

# SSH to NAS and load
ssh user@nas
docker load < /volume1/docker/notebooklm-mcp.tar.gz

# Run container
docker run -d \
  --name notebooklm-mcp \
  --restart unless-stopped \
  -p 3000:3000 \
  -p 6080:6080 \
  -v /volume1/docker/notebooklm/data:/data \
  -e HEADLESS=true \
  -e STEALTH_ENABLED=true \
  -e NOTEBOOKLM_UI_LOCALE=fr \
  notebooklm-mcp:latest
```

### Authenticate via noVNC

1. Open `http://nas-ip:6080/vnc.html`
2. Run setup-auth command
3. Complete Google login in VNC window

## Resource Requirements

| Resource | Minimum | Recommended |
| -------- | ------- | ----------- |
| Memory   | 512 MB  | 2 GB        |
| CPU      | 1 core  | 2 cores     |
| Disk     | 500 MB  | 2 GB        |

Chromium uses significant memory. Adjust limits in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 4G
    reservations:
      memory: 1G
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs notebooklm-mcp

# Check container status
docker ps -a
```

### Browser issues

If Chromium fails to launch:

1. Ensure sufficient memory (minimum 512MB)
2. Check logs for errors
3. Try rebuilding: `docker build --no-cache -t notebooklm-mcp .`

### noVNC not accessible

1. Verify port 6080 is exposed
2. Check firewall rules
3. Verify container is running: `docker ps`

### Authentication issues

```bash
# Check health endpoint
curl http://localhost:3000/health

# If not authenticated, use noVNC method above
```

### Permission issues

```bash
# Fix volume permissions
docker run --rm -v notebooklm-mcp-data:/data alpine chown -R 1000:1000 /data
```

## Production Deployment

### With Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name notebooklm.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # noVNC (restrict access!)
    location /vnc {
        proxy_pass http://localhost:6080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        # Add authentication here!
    }
}
```

### Security Considerations

1. **Don't expose port 6080 publicly** - noVNC gives browser access
2. **Use a reverse proxy with authentication** for production
3. **Regular backups** of the data volume
4. **Monitor container health** using the healthcheck endpoint

## Architecture

```
Docker Container
├── Node.js HTTP Server (port 3000)
├── Xvfb (:99) - Virtual display
├── x11vnc - VNC server
├── websockify/noVNC (port 6080) - Web VNC
└── Chromium browser

User → noVNC (6080) → VNC → Xvfb → Chromium
User → HTTP API (3000) → Node.js → Chromium
```
