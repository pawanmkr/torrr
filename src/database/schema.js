import { pgTable, serial, text, integer, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const shortLinks = pgTable('short_links', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  channel: integer('channel').references(() => channels.id, { onDelete: 'CASCADE' }),
  magnet: text('magnet').notNull(),
  clicks: integer('clicks').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`NOW()`)
});

export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  owner: integer('owner').references(() => users.id, { onDelete: 'CASCADE' }),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull()
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull()
});
