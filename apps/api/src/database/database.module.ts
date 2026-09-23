import { Module, Global } from '@nestjs/common';
import { createDatabaseClient, DrizzleDB } from './index';
import { loadEnv } from '../config/env';
import Database from 'better-sqlite3';

export const DRIZZLE_DB = 'DRIZZLE_DB';
export const SQLITE_DB = 'SQLITE_DB';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useFactory: (): DrizzleDB => {
        const env = loadEnv();
        const { db } = createDatabaseClient(env.DATABASE_URL);
        return db;
      },
    },
    {
      provide: SQLITE_DB,
      useFactory: (): Database.Database => {
        const env = loadEnv();
        const { sqlite } = createDatabaseClient(env.DATABASE_URL);
        return sqlite;
      },
    },
  ],
  exports: [DRIZZLE_DB, SQLITE_DB],
})
export class DatabaseModule {}
