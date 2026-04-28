import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv } from '../config/env';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: async () => {
        const env = loadEnv();
        const pool = new Pool({ connectionString: env.DATABASE_URL });
        const db = drizzle(pool);
        return { db, pool };
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
