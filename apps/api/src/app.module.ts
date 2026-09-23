import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { SettingsModule } from './modules/settings/settings.module';
import { GroupsModule } from './modules/groups/groups.module';
import { EventsModule } from './modules/events/events.module';
import { TypeSafeModule } from './modules/typesafe/typesafe.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { BaileysModule } from './modules/baileys/baileys.module';

// Resolve frontend dist directory
const webDistCandidates = [
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(__dirname, '../../../apps/web/dist'),
  path.resolve(process.cwd(), 'apps/web/dist'),
  path.resolve(process.cwd(), 'dist/web'),
  path.resolve('/app/web/dist'),
];

let webDistPath = webDistCandidates[0];
for (const candidate of webDistCandidates) {
  if (fs.existsSync(candidate)) {
    webDistPath = candidate;
    break;
  }
}

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    SettingsModule,
    GroupsModule,
    EventsModule,
    TypeSafeModule,
    ModerationModule,
    BaileysModule,
    ServeStaticModule.forRoot({
      rootPath: webDistPath,
      exclude: ['/api/(.*)'],
      serveStaticOptions: {
        fallthrough: true,
      },
    }),
  ],
})
export class AppModule {}
