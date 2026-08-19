import { PrismaClient } from '@prisma/client';

/**
 * Prisma configuration for Prisma 7
 * Uses direct database connection (no Accelerate)
 */
export const prismaConfig = {
  datasourceUrl: process.env.DATABASE_URL,
};

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
