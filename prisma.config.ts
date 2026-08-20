import { defineConfig } from '@prisma/config';
import 'dotenv/config';

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
