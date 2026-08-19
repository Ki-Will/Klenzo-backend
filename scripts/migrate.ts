#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database migration...');

  // Create schemas if they don't exist
  const schemas = ['auth', 'finance', 'habit', 'insight', 'notifications', 'productivity', 'public'];
  
  for (const schema of schemas) {
    await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS ${schema}`;
    console.log(`✓ Schema '${schema}' created/confirmed`);
  }

  console.log('Database migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });