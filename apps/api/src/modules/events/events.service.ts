import { Injectable, OnModuleDestroy, MessageEvent } from '@nestjs/common';
import { Subject, Observable, interval, merge, map } from 'rxjs';
import { BaileysStatus, GroupDto, SpamLogDto } from '@ban4life/types';

@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly eventSubject = new Subject<MessageEvent>();

  emitStatus(status: BaileysStatus) {
    this.eventSubject.next({
      data: { type: 'status', data: { status } },
    });
  }

  emitSpam(spam: SpamLogDto) {
    this.eventSubject.next({
      data: { type: 'spam', data: spam },
    });
  }

  emitGroup(group: GroupDto) {
    this.eventSubject.next({
      data: { type: 'group', data: group },
    });
  }

  getEventStream(): Observable<MessageEvent> {
    const pings$ = interval(15000).pipe(
      map(() => ({
        data: { type: 'ping', data: { timestamp: Date.now() } },
      })),
    );

    return merge(this.eventSubject.asObservable(), pings$);
  }

  onModuleDestroy() {
    this.eventSubject.complete();
  }
}
