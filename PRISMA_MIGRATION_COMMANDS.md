# Prisma Migration Commands Reference

## Installation

```bash
# Install Prisma CLI and client
npm install prisma @prisma/client --save-dev

# Initialize Prisma
npx prisma init
```

## Database Setup

### Create Schemas
```bash
# Option 1: Use the migration script
npx ts-node scripts/migrate.ts

# Option 2: Manual SQL
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS habit;
CREATE SCHEMA IF NOT EXISTS insight;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS productivity;
CREATE SCHEMA IF NOT EXISTS public;
```

### Generate Prisma Client
```bash
npx prisma generate
```

### Run Migrations
```bash
# Create a new migration
npx prisma migrate dev --name init_schema

# Apply all pending migrations
npx prisma migrate deploy

# Rollback last migration
npx prisma migrate rollback

# Reset database (DESTRUCTIVE!)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

## Development Commands

### Open Prisma Studio (Database GUI)
```bash
npx prisma studio
# Open http://localhost:5555 in your browser
```

### Generate Types
```bash
npx prisma generate
```

### Schema Validation
```bash
npx prisma validate
```

### DB Pull (Sync schema from database)
```bash
npx prisma db pull
```

### DB Push (Push schema to database)
```bash
npx prisma db push
```

## CI/CD Commands

```yaml
# In your deployment workflow
steps:
  - name: Install dependencies
    run: npm ci

  - name: Generate Prisma client
    run: npx prisma generate

  - name: Run Prisma migrations
    run: npx prisma migrate deploy
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## TypeScript Support

### Generate Types
```bash
npx prisma generate
```

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

## Common Issues and Solutions

### Issue: Schema not found
```bash
# Ensure schemas exist
npx ts-node scripts/migrate.ts
```

### Issue: Type mismatch
```bash
# Regenerate Prisma client
npx prisma generate --force
```

### Issue: Migration conflicts
```bash
# Check migration status
npx prisma migrate status

# If needed, reset and recreate
npx prisma migrate reset
```

## Environment Variables

```env
DATABASE_URL=postgresql://klenzo:klenzo_password@localhost:5432/klenzo_db
PRISMA_URL=postgresql://klenzo:klenzo_password@localhost:5432/klenzo_db
```

## Docker Development

```bash
# Start services
docker-compose up -d

# Run migrations in container
docker exec -it klenzo-backend prisma migrate deploy

# Access Prisma Studio
docker exec -it klenzo-backend npx prisma studio
```