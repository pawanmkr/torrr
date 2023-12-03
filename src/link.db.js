import client from "./db.js";

export class Link {
  static async createLinkTable() {
    const query = `
      CREATE TABLE 
        IF NOT EXISTS short_links (
          id SERIAL PRIMARY KEY,
          uid TEXT NOT NULL UNIQUE,
          magnet TEXT NOT NULL,
          clicks INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        );
    `;
    try {
      await client.query(query);
      console.log(`> Link Table Created`)
    } catch (error) {
      console.error("Error creating short_link table:", error);
    }
  }

  static async saveMagnet(uid, magnet) {
    const query = `INSERT INTO short_links (uid, magnet) VALUES($1, $2) RETURNING *`;
    try {
      const res = await client.query(query, [uid, magnet]);
      return res.rows[0];
    } catch (error) {
      console.error("Error saving magnet:", error);
    }
  }

  static async retrieveMagnetUsingShortLink(uid) {
    const query = `SELECT * FROM short_links WHERE uid=$1`;
    try {
      const res = await client.query(query, [uid]);
      if (res && res.rows.length > 0) {
        if (res.rows[0].clicks >= 0) {
          const clickResult = await client.query(
            `UPDATE short_links SET clicks=clicks+1 WHERE uid=$1 RETURNING *`,
            [res.rows[0].uid]
          );
          if (!clickResult) {
            throw new Error("Something is wrong with clicks");
          }
        }
        return res.rows[0].magnet;
      } else {
        return "";
      }
    } catch (error) {
      console.error("Error retrieving magnet:", error);
    }
  }

  static async retrieveShortStats(uid) {
    try {
      const res = await client.query(
        `SELECT clicks FROM short_links WHERE uid=$1`,
        [uid]
      );
      return res.rows[0].clicks;
    } catch (error) {
      console.error("Error retrieving short stats:", error);
    }
  }
}
