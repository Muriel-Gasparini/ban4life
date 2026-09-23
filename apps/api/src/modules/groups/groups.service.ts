import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import { DrizzleDB } from '../../database';
import { groups } from '../../database/schema';
import { GroupDto } from '@linkeshield/types';
import { EventsService } from '../events/events.service';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly eventsService: EventsService,
  ) {}

  async listGroups(): Promise<GroupDto[]> {
    const rows = await this.db.select().from(groups);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isProtected: Boolean(r.isProtected),
      participantCount: r.participantCount,
      updatedAt: r.updatedAt,
    }));
  }

  async getGroup(id: string): Promise<GroupDto | null> {
    const rows = await this.db.select().from(groups).where(eq(groups.id, id));
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      isProtected: Boolean(r.isProtected),
      participantCount: r.participantCount,
      updatedAt: r.updatedAt,
    };
  }

  async isGroupProtected(id: string): Promise<boolean> {
    const g = await this.getGroup(id);
    return g ? g.isProtected : false;
  }

  async toggleGroup(id: string, explicitState?: boolean): Promise<GroupDto> {
    const existing = await this.getGroup(id);
    if (!existing) {
      throw new NotFoundException(`Grupo com ID ${id} não encontrado`);
    }

    const newState = explicitState !== undefined ? explicitState : !existing.isProtected;
    const now = Date.now();

    await this.db
      .update(groups)
      .set({ isProtected: newState, updatedAt: now })
      .where(eq(groups.id, id));

    const updated: GroupDto = {
      ...existing,
      isProtected: newState,
      updatedAt: now,
    };

    this.eventsService.emitGroup(updated);
    return updated;
  }

  async syncGroups(
    newGroups: { id: string; name: string; participantCount: number }[],
  ): Promise<void> {
    const now = Date.now();
    for (const group of newGroups) {
      const existing = await this.getGroup(group.id);
      if (existing) {
        await this.db
          .update(groups)
          .set({
            name: group.name,
            participantCount: group.participantCount,
            updatedAt: now,
          })
          .where(eq(groups.id, group.id));
      } else {
        await this.db.insert(groups).values({
          id: group.id,
          name: group.name,
          isProtected: false,
          participantCount: group.participantCount,
          updatedAt: now,
        });
      }
    }
  }
}
