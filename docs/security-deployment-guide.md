# Security Deployment Guide

This guide covers security best practices for deploying Rafineri in production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Secure Secret Generation](#secure-secret-generation)
3. [Environment File Security](#environment-file-security)
4. [Database Security](#database-security)
5. [Network Security](#network-security)
6. [Admin Token Protection](#admin-token-protection)
7. [TLS/SSL Configuration](#tlsssl-configuration)
8. [Security Headers](#security-headers)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Regular Security Maintenance](#regular-security-maintenance)

---

## Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] All default passwords changed
- [ ] Strong secrets generated for all services
- [ ] `.env` file permissions restricted
- [ ] Database not exposed publicly
- [ ] Admin token is at least 32 characters
- [ ] HTTPS/TLS configured for public access
- [ ] Security headers enabled
- [ ] Logging configured for audit trails

---

## Secure Secret Generation

### Database Password

Generate a secure database password (32+ characters):

```bash
# Linux/macOS with OpenSSL
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Docker (if OpenSSL not installed locally)
docker run --rm alpine/openssl rand -base64 32
```

### Admin Token

Generate a secure admin token (64 hex characters = 32 bytes):

```bash
# Linux/macOS
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Important**: The admin token grants full administrative access. Protect it carefully.

### Admin Panel Password

Generate a secure admin password:

```bash
openssl rand -base64 24
```

---

## Environment File Security

### File Permissions

Restrict access to your `.env` file:

```bash
# Set restrictive permissions (owner read/write only)
chmod 600 .env

# Verify permissions
ls -la .env
# Should show: -rw------- 1 user group ... .env
```

### Storage Best Practices

- **Never** commit `.env` files to version control
- Use `.env.example` as a template only
- Store production secrets in a secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.)
- Rotate secrets regularly (every 90 days recommended)

---

## Database Security

### Default Configuration

The Docker Compose configuration binds PostgreSQL to localhost only:

```yaml
ports:
  - "127.0.0.1:5432:5432"  # Localhost only
```

### Additional Hardening

1. **Disable remote connections** if not needed
2. **Enable SSL** for database connections:
   ```
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   ```
3. **Regular backups** with encrypted storage
4. **Connection limits** per user

---

## Network Security

### Firewall Rules

For production deployments, restrict access:

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH (restrict to your IP if possible)
sudo ufw allow 80/tcp    # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp   # HTTPS

# Block direct access to services
sudo ufw deny 3001/tcp   # API (access via reverse proxy only)
sudo ufw deny 5432/tcp   # PostgreSQL
sudo ufw deny 6379/tcp   # Redis
```

### Docker Network Isolation

The `docker-compose.server.yml` uses an isolated bridge network:

```yaml
networks:
  rafineri-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

## Admin Token Protection

The admin token is used for sensitive operations (rescoring, content management). 

### Usage Example

```bash
# Include in request headers
curl -H "X-Admin-Token: your-secure-token" \
     https://api.yourdomain.com/admin/rescore
```

### Best Practices

- Store in environment variables, never in code
- Rotate tokens after team member changes
- Use different tokens for different environments
- Log admin operations for audit trails

---

## TLS/SSL Configuration

### Recommended: Reverse Proxy with Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Let's Encrypt (Free SSL)

```bash
# Using Certbot
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

---

## Security Headers

Enable these headers in your reverse proxy:

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
```

---

## Monitoring and Logging

### Log Levels

Set appropriate log levels:

```bash
# Production
LOG_LEVEL=warn

# Debug issues (temporary)
LOG_LEVEL=debug
```

### What to Monitor

- Failed authentication attempts
- Admin token usage
- Database connection errors
- Unusual API request patterns
- Container restarts

### Log Aggregation

Consider shipping logs to a centralized system:

```yaml
# Example with Fluentd/Fluent Bit
logging:
  driver: fluentd
  options:
    fluentd-address: localhost:24224
    tag: docker.rafineri
```

---

## Regular Security Maintenance

### Monthly Tasks

- [ ] Review access logs for anomalies
- [ ] Check for available security updates
- [ ] Verify backup integrity

### Quarterly Tasks

- [ ] Rotate admin tokens
- [ ] Rotate API keys
- [ ] Review and revoke unnecessary access
- [ ] Test disaster recovery procedures

### Annual Tasks

- [ ] Full security audit
- [ ] Penetration testing
- [ ] Update security documentation

---

## Quick Reference: Secret Generation

| Secret Type | Command | Length |
|-------------|---------|--------|
| Database Password | `openssl rand -base64 32` | 32 bytes |
| Admin Token | `openssl rand -hex 32` | 64 hex chars |
| API Key | `openssl rand -base64 32` | 32 bytes |
| Session Secret | `openssl rand -base64 48` | 48 bytes |

---

## Additional Resources

- [OWASP Docker Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Nginx Security Hardening](https://www.nginx.com/blog/http-security-headers/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
