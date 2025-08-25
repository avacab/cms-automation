#!/bin/bash
# Automated backup script for CMS POC

BACKUP_DIR="/home/$(whoami)/cms_automation/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
docker exec cms_postgres pg_dump -U cms_user cms_db > "$BACKUP_DIR/database_$DATE.sql"

# Backup uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" uploads/

# Backup configuration
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" config/ docker/poc/.env

# Clean old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
