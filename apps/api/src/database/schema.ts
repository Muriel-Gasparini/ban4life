import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isProtected: integer('is_protected', { mode: 'boolean' }).notNull().default(false),
  participantCount: integer('participant_count').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});

export const spamLogs = sqliteTable('spam_logs', {
  id: text('id').primaryKey(),
  groupJid: text('group_jid').notNull(),
  groupName: text('group_name').notNull(),
  senderJid: text('sender_jid').notNull(),
  messageText: text('message_text').notNull(),
  jevScore: real('jev_score').notNull(),
  jevCategory: text('jev_category').notNull(),
  actionTaken: text('action_taken').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

export type SpamLog = typeof spamLogs.$inferSelect;
export type NewSpamLog = typeof spamLogs.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
