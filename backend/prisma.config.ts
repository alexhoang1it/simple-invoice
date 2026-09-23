// Prisma 7 drops the `prisma` key in package.json, so the config lives here.
//
// The schema, its migrations and the seed all sit under src/database/, which is
// where the project structure in the brief puts database concerns. Declaring a
// config file also switches off Prisma's automatic .env loading, hence dotenv.
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('src', 'database', 'schema.prisma'),
  migrations: {
    path: path.join('src', 'database', 'migrations'),
    seed: 'ts-node src/database/seed/seed.ts',
  },
});
