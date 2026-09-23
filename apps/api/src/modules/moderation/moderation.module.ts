import { Module, forwardRef } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { GroupsModule } from '../groups/groups.module';
import { SettingsModule } from '../settings/settings.module';
import { TypeSafeModule } from '../typesafe/typesafe.module';
import { EventsModule } from '../events/events.module';
import { BaileysModule } from '../baileys/baileys.module';

@Module({
  imports: [
    GroupsModule,
    SettingsModule,
    TypeSafeModule,
    EventsModule,
    forwardRef(() => BaileysModule),
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
