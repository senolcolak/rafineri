# Rafineri Database Scripts

This directory contains scripts for managing the Rafineri database.

## Scripts

### `setup-database.sh`
Sets up the database schema and default data.

```bash
./scripts/setup-database.sh
```

This script will:
- Create all required PostgreSQL types (enums)
- Create all tables with indexes
- Set up foreign key constraints
- Insert default sources (Hacker News, Reddit)

**Note:** This script is safe to run multiple times - it uses `IF NOT EXISTS` for all objects.

### `setup-database.sql`
The raw SQL file used by `setup-database.sh`. Can be run directly:

```bash
docker compose exec -T postgres psql -U rafineri -d rafineri < scripts/setup-database.sql
```

### `health-check.sh`
Checks the health of all Rafineri services.

```bash
./scripts/health-check.sh
```

This will check:
- PostgreSQL connectivity
- Redis connectivity
- API endpoints
- Admin console endpoints
- Database table statistics

### `reset-database.sh`
⚠️ **WARNING: Destructive operation!**

Completely resets the database (deletes all data).

```bash
./scripts/reset-database.sh
```

You will be prompted to type "yes" to confirm.

## Automatic Setup

The `docker-compose.yml` now includes a `db-migrate` service that automatically runs the database setup when you start the stack:

```bash
docker compose up -d
```

The `db-migrate` container will:
1. Wait for PostgreSQL to be ready
2. Run `setup-database.sql`
3. Exit successfully
4. API and Worker will then start

## Manual SQL Commands

If you need to run custom SQL:

```bash
# Open psql console
docker compose exec postgres psql -U rafineri -d rafineri

# Run a single command
docker compose exec postgres psql -U rafineri -d rafineri -c "SELECT * FROM sources;"
```

## Troubleshooting

### "relation X does not exist"
Run the setup script:
```bash
./scripts/setup-database.sh
```

### "type X does not exist"
The types are created in `setup-database.sql`. Run:
```bash
docker compose exec -T postgres psql -U rafineri -d rafineri < scripts/setup-database.sql
```

### Permission denied
Make sure scripts are executable:
```bash
chmod +x scripts/*.sh
```
