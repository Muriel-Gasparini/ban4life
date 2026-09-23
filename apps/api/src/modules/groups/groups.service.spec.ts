import { Test, TestingModule } from '@nestjs/testing';
import { GroupsService } from './groups.service';
import { DRIZZLE_DB, SQLITE_DB } from '../../database/database.module';
import { createDatabaseClient } from '../../database';
import { EventsService } from '../events/events.service';
import Database from 'better-sqlite3';

describe('GroupsService', () => {
  let groupsService: GroupsService;
  let sqlite: Database.Database;
  let eventsService: EventsService;

  beforeEach(async () => {
    const dbClient = createDatabaseClient(':memory:');
    sqlite = dbClient.sqlite;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: DRIZZLE_DB, useValue: dbClient.db },
        { provide: SQLITE_DB, useValue: sqlite },
        {
          provide: EventsService,
          useValue: {
            emitGroup: jest.fn(),
          },
        },
      ],
    }).compile();

    groupsService = module.get<GroupsService>(GroupsService);
    eventsService = module.get<EventsService>(EventsService);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should sync groups without losing protected state of existing ones', async () => {
    await groupsService.syncGroups([
      { id: 'group1@g.us', name: 'Devs Group', participantCount: 15 },
      { id: 'group2@g.us', name: 'Vagas Group', participantCount: 42 },
    ]);

    let list = await groupsService.listGroups();
    expect(list).toHaveLength(2);
    expect(list.find((g) => g.id === 'group1@g.us')?.isProtected).toBe(false);

    // Toggle group1 to protected
    await groupsService.toggleGroup('group1@g.us', true);
    expect(await groupsService.isGroupProtected('group1@g.us')).toBe(true);

    // Re-sync with updated participant count
    await groupsService.syncGroups([
      { id: 'group1@g.us', name: 'Devs Group Updated', participantCount: 20 },
      { id: 'group3@g.us', name: 'New Group', participantCount: 5 },
    ]);

    list = await groupsService.listGroups();
    expect(list).toHaveLength(3);

    const group1 = list.find((g) => g.id === 'group1@g.us');
    expect(group1?.name).toBe('Devs Group Updated');
    expect(group1?.participantCount).toBe(20);
    // Crucial: protection state was preserved
    expect(group1?.isProtected).toBe(true);
  });

  it('should toggle group protection and emit SSE event', async () => {
    await groupsService.syncGroups([
      { id: 'group1@g.us', name: 'Devs Group', participantCount: 10 },
    ]);

    const toggled = await groupsService.toggleGroup('group1@g.us');
    expect(toggled.isProtected).toBe(true);
    expect(eventsService.emitGroup).toHaveBeenCalledWith(toggled);

    const toggledAgain = await groupsService.toggleGroup('group1@g.us');
    expect(toggledAgain.isProtected).toBe(false);
  });
});
