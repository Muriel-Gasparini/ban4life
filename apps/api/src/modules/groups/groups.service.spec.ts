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
      { id: 'group1@g.us', name: 'Devs Group', participantCount: 15, isBotAdmin: true },
      { id: 'group2@g.us', name: 'Vagas Group', participantCount: 42, isBotAdmin: true },
    ]);

    let list = await groupsService.listGroups();
    expect(list).toHaveLength(2);
    expect(list.find((g) => g.id === 'group1@g.us')?.isProtected).toBe(false);

    // Toggle group1 to protected
    await groupsService.toggleGroup('group1@g.us', true);
    expect(await groupsService.isGroupProtected('group1@g.us')).toBe(true);

    // Re-sync with updated participant count
    await groupsService.syncGroups([
      { id: 'group1@g.us', name: 'Devs Group Updated', participantCount: 20, isBotAdmin: true },
      { id: 'group3@g.us', name: 'New Group', participantCount: 5, isBotAdmin: true },
    ]);

    list = await groupsService.listGroups();
    expect(list).toHaveLength(3);

    const group1 = list.find((g) => g.id === 'group1@g.us');
    expect(group1?.name).toBe('Devs Group Updated');
    expect(group1?.participantCount).toBe(20);
    // Crucial: protection state was preserved
    expect(group1?.isProtected).toBe(true);
  });

  it('should filter out groups where bot is not admin by default', async () => {
    await groupsService.syncGroups([
      { id: 'adminGroup@g.us', name: 'Admin Group', participantCount: 10, isBotAdmin: true },
      { id: 'memberGroup@g.us', name: 'Member Only Group', participantCount: 50, isBotAdmin: false },
    ]);

    // By default, listGroups() returns only admin groups
    const adminOnlyList = await groupsService.listGroups();
    expect(adminOnlyList).toHaveLength(1);
    expect(adminOnlyList[0].id).toBe('adminGroup@g.us');

    // When onlyAdmin = false, all groups are returned
    const allGroups = await groupsService.listGroups(false);
    expect(allGroups).toHaveLength(2);

    // Promote memberGroup to admin
    await groupsService.updateGroupAdminStatus('memberGroup@g.us', true);
    const updatedList = await groupsService.listGroups();
    expect(updatedList).toHaveLength(2);
    expect(eventsService.emitGroup).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'memberGroup@g.us', isBotAdmin: true }),
    );
  });

  it('should toggle group protection and emit SSE event', async () => {
    await groupsService.syncGroups([
      { id: 'group1@g.us', name: 'Devs Group', participantCount: 10, isBotAdmin: true },
    ]);

    const toggled = await groupsService.toggleGroup('group1@g.us');
    expect(toggled.isProtected).toBe(true);
    expect(eventsService.emitGroup).toHaveBeenCalledWith(toggled);

    const toggledAgain = await groupsService.toggleGroup('group1@g.us');
    expect(toggledAgain.isProtected).toBe(false);
  });

  it('should update group name when subject changes and emit SSE event', async () => {
    await groupsService.syncGroups([
      { id: 'group1@g.us', name: 'Original Name', participantCount: 10, isBotAdmin: true },
    ]);

    await groupsService.updateGroupName('group1@g.us', 'Renamed Group');
    const group = await groupsService.getGroup('group1@g.us');
    expect(group?.name).toBe('Renamed Group');
    expect(eventsService.emitGroup).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'group1@g.us', name: 'Renamed Group' }),
    );
  });

  it('should return groups ordered by isProtected first, then alphabetically by name', async () => {
    await groupsService.syncGroups([
      { id: 'g1@g.us', name: 'Zeta Group', participantCount: 10, isBotAdmin: true },
      { id: 'g2@g.us', name: 'Alpha Group', participantCount: 10, isBotAdmin: true },
      { id: 'g3@g.us', name: 'Beta Group', participantCount: 10, isBotAdmin: true },
      { id: 'g4@g.us', name: 'Delta Group', participantCount: 10, isBotAdmin: true },
    ]);

    // Protect Zeta and Delta
    await groupsService.toggleGroup('g1@g.us', true);
    await groupsService.toggleGroup('g4@g.us', true);

    const list = await groupsService.listGroups();
    // Delta and Zeta are protected, so Delta comes first, then Zeta.
    // Alpha and Beta are unprotected, so Alpha comes first, then Beta.
    expect(list.map((g) => ({ name: g.name, isProtected: g.isProtected }))).toEqual([
      { name: 'Delta Group', isProtected: true },
      { name: 'Zeta Group', isProtected: true },
      { name: 'Alpha Group', isProtected: false },
      { name: 'Beta Group', isProtected: false },
    ]);
  });
});
