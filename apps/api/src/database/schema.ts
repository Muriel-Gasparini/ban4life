import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isProtected: integer('is_protected', { mode: 'boolean' }).notNull().default(false),
  participantCount: integer('participant_count').notNull().default(0),
  isBotAdmin: integer('is_bot_admin', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').notNull(),
});

export const spamLogs = sqliteTable('spam_logs', {
  id: text('id').primaryKey(),
  groupJid: text('group_jid').notNull(),
  groupName: text('group_name').notNull(),
  senderJid: text('sender_jid').notNull(),
  senderName: text('sender_name'),
  senderPhone: text('sender_phone'),
  messageText: text('message_text').notNull(),
  jevScore: real('jev_score').notNull(),
  jevCategory: text('jev_category').notNull(),
  actionTaken: text('action_taken').notNull(),
  isCrossGroupBan: integer('is_cross_group_ban', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at').notNull(),
});

export const metrics = sqliteTable('metrics', {
  id: text('id').primaryKey(), // 'global'
  totalEvaluated: integer('total_evaluated').notNull().default(0),
  totalSpamsBanned: integer('total_spams_banned').notNull().default(0),
  cacheHits: integer('cache_hits').notNull().default(0),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

export type SpamLog = typeof spamLogs.$inferSelect;
export type NewSpamLog = typeof spamLogs.$inferInsert;

export type Metric = typeof metrics.$inferSelect;
export type NewMetric = typeof metrics.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
