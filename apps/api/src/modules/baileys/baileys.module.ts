import { Module, forwardRef } from '@nestjs/common';
import { BaileysService } from './baileys.service';
import { BaileysController } from './baileys.controller';
import { GroupsModule } from '../groups/groups.module';
import { EventsModule } from '../events/events.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [
    GroupsModule,
    EventsModule,
    forwardRef(() => ModerationModule),
  ],
  controllers: [BaileysController],
  providers: [BaileysService],
  exports: [BaileysService],
})
export class BaileysModule {}
