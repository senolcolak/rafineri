#!/bin/bash
# =============================================================================
# Rafineri Database Backup Script
# =============================================================================
# Run this script to create a backup of the PostgreSQL database
# Recommended: Run via cron daily
#   0 2 * * * /path/to/rafineri/scripts/backup.sh
# =============================================================================

set -e

BACKUP_DIR="\${BACKUP_DIR:-./backups}"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\$BACKUP_DIR/rafineri_backup_\$DATE.sql"
RETENTION_DAYS="\${RETENTION_DAYS:-7}"

# Create backup directory
mkdir -p "\$BACKUP_DIR"

# Create backup
echo "Creating backup: \$BACKUP_FILE"
docker compose -f docker-compose.server.yml exec -T postgres \
    pg_dump -U rafineri rafineri > "\$BACKUP_FILE"

# Compress backup
gzip "\$BACKUP_FILE"
echo "Backup complete: \${BACKUP_FILE}.gz"

# Clean up old backups
echo "Cleaning up backups older than \$RETENTION_DAYS days..."
find "\$BACKUP_DIR" -name "rafineri_backup_*.sql.gz" -mtime +\$RETENTION_DAYS -delete

echo "Done!"
