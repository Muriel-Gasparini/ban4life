import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import { DrizzleDB } from '../../database';
import { groups } from '../../database/schema';
import { GroupDto } from '@ban4life/types';
import { EventsService } from '../events/events.service';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly eventsService: EventsService,
  ) {}

  async listGroups(onlyAdmin: boolean = true): Promise<GroupDto[]> {
    let query = this.db.select().from(groups);

    if (onlyAdmin) {
      query = query.where(eq(groups.isBotAdmin, true)) as any;
    }

    const rows = await query.orderBy(desc(groups.isProtected), asc(groups.name));
    return rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        isProtected: Boolean(r.isProtected),
        isBotAdmin: Boolean(r.isBotAdmin),
        participantCount: r.participantCount,
        updatedAt: r.updatedAt,
      }))
      .sort((a, b) => {
        if (a.isProtected !== b.isProtected) {
          return a.isProtected ? -1 : 1;
        }
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
  }

  async getGroup(id: string): Promise<GroupDto | null> {
    const rows = await this.db.select().from(groups).where(eq(groups.id, id));
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      isProtected: Boolean(r.isProtected),
      isBotAdmin: Boolean(r.isBotAdmin),
      participantCount: r.participantCount,
      updatedAt: r.updatedAt,
    };
  }

  async isGroupProtected(id: string): Promise<boolean> {
    const g = await this.getGroup(id);
    return g ? g.isProtected : false;
  }

  async listProtectedGroups(): Promise<GroupDto[]> {
    const rows = await this.db.select().from(groups).where(eq(groups.isProtected, true));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isProtected: Boolean(r.isProtected),
      isBotAdmin: Boolean(r.isBotAdmin),
      participantCount: r.participantCount,
      updatedAt: r.updatedAt,
    }));
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
    newGroups: { id: string; name: string; participantCount: number; isBotAdmin?: boolean }[],
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
            ...(group.isBotAdmin !== undefined ? { isBotAdmin: group.isBotAdmin } : {}),
            updatedAt: now,
          })
          .where(eq(groups.id, group.id));
      } else {
        await this.db.insert(groups).values({
          id: group.id,
          name: group.name,
          isProtected: false,
          participantCount: group.participantCount,
          isBotAdmin: group.isBotAdmin ?? false,
          updatedAt: now,
        });
      }
    }
  }

  async updateGroupAdminStatus(id: string, isBotAdmin: boolean): Promise<void> {
    const existing = await this.getGroup(id);
    if (!existing) return;
    const now = Date.now();
    await this.db
      .update(groups)
      .set({
        isBotAdmin,
        updatedAt: now,
      })
      .where(eq(groups.id, id));

    this.eventsService.emitGroup({
      ...existing,
      isBotAdmin,
      updatedAt: now,
    });
  }

  async updateGroupName(id: string, name: string): Promise<void> {
    const existing = await this.getGroup(id);
    if (!existing) return;
    const now = Date.now();
    await this.db
      .update(groups)
      .set({
        name,
        updatedAt: now,
      })
      .where(eq(groups.id, id));

    this.eventsService.emitGroup({
      ...existing,
      name,
      updatedAt: now,
    });
  }
}
