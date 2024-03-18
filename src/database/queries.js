import db from './config.js';
import { eq } from 'drizzle-orm';
import { users, shortLinks, channels } from './schema.js';

export default class Queries {

  // Check if email already exists
  static async doesEmailAlreadyExists(email) {
    const existingEmail = await db(users)
      .select()
      .where(eq(users.email, email))
      .count();

    return existingEmail > 0;
  }

  // Find user by email
  static async findUserWithEmail(email) {
    return await db(users)
      .select()
      .where(eq(users.email, email))
      .first();
  }

  // Add new user
  static async addNewUserToDB(email, password) {
    return await db(users)
      .insert({ email, password })
      .returning('*')
      .first();
  }

  // Create new channel
  static async createNewChannel(name, owner) {
    return await db(channels)
      .insert({ name, owner })
      .returning('*')
      .first();
  }

  // Save magnet
  static async saveMagnet(uid, magnet) {
    try {
      return await db(shortLinks)
        .insert({ uid, magnet })
        .returning('*')
        .first();
    } catch (error) {
      console.error('Error saving magnet:', error);
      return null;
    }
  }

  // Retrieve magnet using short link
  static async retrieveMagnetUsingShortLink(uid) {
    try {
      const shortLink = await db(shortLinks)
        .select()
        .where(eq(shortLinks.uid, uid))
        .first();

      if (!shortLink) return '';

      if (shortLink.clicks >= 0) {
        await db(shortLinks)
          .update({ clicks: shortLink.clicks + 1 })
          .where(eq(shortLinks.uid, uid));
      }

      return shortLink.magnet;
    } catch (error) {
      console.error('Error retrieving magnet:', error);
      return '';
    }
  }

  // Retrieve short link stats
  static async retrieveShortStats(uid) {
    try {
      const res = await db(shortLinks)
        .select(shortLinks.clicks)
        .where(eq(shortLinks.uid, uid))
        .first();

      return res?.clicks || 0; // Handle case where record doesn't exist
    } catch (error) {
      console.error('Error retrieving short stats:', error);
      return 0;
    }
  }
}
