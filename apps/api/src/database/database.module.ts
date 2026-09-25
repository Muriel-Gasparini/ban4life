import { Module, Global } from '@nestjs/common';
import { createDatabaseClient, DrizzleDB } from './index';
import { loadEnv } from '../config/env';
import Database from 'better-sqlite3';

export const DRIZZLE_DB = 'DRIZZLE_DB';
export const SQLITE_DB = 'SQLITE_DB';

const DB_CLIENT = 'DB_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: DB_CLIENT,
      useFactory: () => {
        const env = loadEnv();
        return createDatabaseClient(env.DATABASE_URL);
      },
    },
    {
      provide: DRIZZLE_DB,
      useFactory: (client: { db: DrizzleDB; sqlite: Database.Database }): DrizzleDB => {
        return client.db;
      },
      inject: [DB_CLIENT],
    },
    {
      provide: SQLITE_DB,
      useFactory: (client: { db: DrizzleDB; sqlite: Database.Database }): Database.Database => {
        return client.sqlite;
      },
      inject: [DB_CLIENT],
    },
  ],
  exports: [DRIZZLE_DB, SQLITE_DB],
})
export class DatabaseModule {}
