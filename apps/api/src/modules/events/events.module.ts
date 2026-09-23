import { Module, Global } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Global()
@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
