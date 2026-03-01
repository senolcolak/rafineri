# Server Deployment (Simple)

This guide covers deploying Rafineri on a single Linux VM using Docker Compose. This is suitable for small to medium production loads.

## Prerequisites

- Linux VM (Ubuntu 20.04/22.04 LTS recommended)
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ disk space
- SSH access with sudo privileges

## Quick Start

### 1. Install Docker and Docker Compose

SSH into your server and run:

```bash
# Download the installation script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to the docker group
sudo usermod -aG docker $USER

# Apply group changes (logout and login, or use):
newgrp docker

# Verify installation
docker --version
docker compose version
```

Or use our provided script:

```bash
sudo bash scripts/install-docker.sh
```

### 2. Clone the Repository

```bash
cd ~
git clone https://github.com/your-org/rafineri.git
cd rafineri
```

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.server.example .env

# Edit the configuration
nano .env
```

**Required changes:**

```env
# Database - Change to a strong password!
POSTGRES_PASSWORD=your-secure-password-here-32-chars

# Admin token - Generate a secure random string
ADMIN_TOKEN=your-secure-admin-token-min-32-characters

# Public API URL (use your server's IP or domain)
NEXT_PUBLIC_API_URL=http://your-server-ip:3001
```

### 4. Deploy the Application

```bash
# Build and start all services
docker compose -f docker-compose.server.yml up -d --build

# View logs in real-time
docker compose -f docker-compose.server.yml logs -f

# Or use our deployment script
bash scripts/deploy.sh
```

### 5. Access the Application

Once deployment is complete:

- **Web UI**: `http://your-server-ip:3000`
- **API**: `http://your-server-ip:3001`
- **API Docs**: `http://your-server-ip:3001/docs`

## Production Configuration

### Firewall Setup

Allow only necessary ports:

```bash
# Using UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (if using nginx)
sudo ufw allow 443/tcp   # HTTPS (if using SSL)
sudo ufw allow 3000/tcp  # Rafineri Web (or restrict to localhost)
sudo ufw enable
```

### SSL with Nginx (Optional but Recommended)

For production with HTTPS, add an Nginx reverse proxy:

```yaml
# Add to docker-compose.server.yml

  nginx:
    image: nginx:alpine
    container_name: rafineri-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot-data:/etc/letsencrypt
    depends_on:
      - web
      - api
    networks:
      - rafineri-network
```

Example `nginx/nginx.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://web:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api/ {
        proxy_pass http://api:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Using Let's Encrypt

```bash
# Install certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy to nginx ssl folder
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

## Monitoring & Maintenance

### Check Service Status

```bash
# View all containers
docker compose -f docker-compose.server.yml ps

# View resource usage
docker stats

# Run monitoring script
bash scripts/monitor.sh
```

### View Logs

```bash
# All services
docker compose -f docker-compose.server.yml logs -f

# Specific service
docker compose -f docker-compose.server.yml logs -f api
docker compose -f docker-compose.server.yml logs -f worker
docker compose -f docker-compose.server.yml logs -f web

# Last 100 lines
docker compose -f docker-compose.server.yml logs --tail=100
```

### Database Backups

```bash
# Manual backup
bash scripts/backup.sh

# Or manually:
docker compose -f docker-compose.server.yml exec postgres \
    pg_dump -U rafineri rafineri > backup_$(date +%Y%m%d).sql

# Automated daily backups via cron
echo "0 2 * * * cd /path/to/rafineri && bash scripts/backup.sh" | sudo crontab -
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.server.yml up -d --build

# Database migrations (if needed)
docker compose -f docker-compose.server.yml run --rm api npx drizzle-kit migrate
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.server.yml restart

# Restart specific service
docker compose -f docker-compose.server.yml restart api
```

### Stop All Services

```bash
docker compose -f docker-compose.server.yml down

# Stop and remove volumes (WARNING: deletes database!)
docker compose -f docker-compose.server.yml down -v
```

## Troubleshooting

### Services Won't Start

```bash
# Check for port conflicts
sudo netstat -tlnp | grep -E '3000|3001|5432|6379'

# View detailed logs
docker compose -f docker-compose.server.yml logs --no-color

# Check container status
docker ps -a
```

### Database Connection Issues

```bash
# Check postgres is running
docker compose -f docker-compose.server.yml ps postgres

# Connect to database manually
docker compose -f docker-compose.server.yml exec postgres \
    psql -U rafineri -d rafineri
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats --no-stream

# Restart services with cleanup
docker compose -f docker-compose.server.yml down
docker system prune -a  # Clean unused images
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches  # Clear caches
docker compose -f docker-compose.server.yml up -d
```

### Worker Not Processing Jobs

```bash
# Check Redis connectivity
docker compose -f docker-compose.server.yml exec redis redis-cli ping

# Check worker logs
docker compose -f docker-compose.server.yml logs -f worker

# Restart worker
docker compose -f docker-compose.server.yml restart worker
```

## Security Hardening

1. **Change default passwords** in `.env`
2. **Use a firewall** (UFW) to restrict ports
3. **Enable SSL** with Let's Encrypt
4. **Keep Docker updated** regularly
5. **Run as non-root user** where possible
6. **Review logs** periodically for suspicious activity

## Performance Tuning

For higher traffic, consider:

1. **Increase VM resources** (CPU/RAM)
2. **Add database connection pooling** (PgBouncer)
3. **Use external managed Redis** (AWS ElastiCache, Redis Cloud)
4. **Scale horizontally** with multiple worker instances:

```yaml
# In docker-compose.server.yml
worker:
  deploy:
    replicas: 3  # Run 3 worker instances
```

## Reference Commands

| Action | Command |
|--------|---------|
| Start | `docker compose -f docker-compose.server.yml up -d` |
| Stop | `docker compose -f docker-compose.server.yml down` |
| Logs | `docker compose -f docker-compose.server.yml logs -f` |
| Rebuild | `docker compose -f docker-compose.server.yml up -d --build` |
| Shell | `docker compose -f docker-compose.server.yml exec api sh` |
| DB Shell | `docker compose -f docker-compose.server.yml exec postgres psql -U rafineri` |
| Update | `git pull && docker compose -f docker-compose.server.yml up -d --build` |

## Support

For issues or questions:
- Check logs: `docker compose -f docker-compose.server.yml logs`
- Review documentation: `/docs`
- Create an issue on GitHub
