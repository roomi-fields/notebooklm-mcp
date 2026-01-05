# Déploiement NotebookLM MCP sur Filer

## Fichiers inclus

- `notebooklm-mcp.tar.gz` - Image Docker (404 MB)
- `docker-compose.yml` - Configuration Docker Compose
- `data/` - Credentials et configuration (3 comptes Google)

## Instructions

### 1. Copier le dossier sur le filer

```bash
scp -r deploy-package romainadmin@filer:/home/romainadmin/notebooklm-mcp
```

### 2. Sur le filer, charger l'image

```bash
cd /home/romainadmin/notebooklm-mcp
docker load < notebooklm-mcp.tar.gz
```

### 3. Démarrer le serveur

```bash
docker-compose up -d
```

### 4. Vérifier

```bash
curl http://localhost:3000/health
```

## Commandes utiles

```bash
# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart
```

## Accès

- API: http://filer:3000
- Health: http://filer:3000/health
