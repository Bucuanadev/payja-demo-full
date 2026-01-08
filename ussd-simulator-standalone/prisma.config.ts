import { defineConfig } from 'prisma';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    db: {
      provider: 'postgresql',
      url: "postgresql://postgres:admin@localhost:5432/ussd_db",
    },
  },
});
