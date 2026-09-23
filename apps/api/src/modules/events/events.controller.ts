import { Controller, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse()
  events(): Observable<MessageEvent> {
    return this.eventsService.getEventStream();
  }
}
