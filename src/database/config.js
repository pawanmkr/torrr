import dotenv from 'dotenv';
import path from 'path';
import process from 'process';

dotenv.config({
  path: path.join(process.cwd(), '.env'),
});

// let db;

// if (NODE_ENV === "production") {
//   db = new Pool({
//     connectionString: DATABASE_URL,
//     ssl: {
//       rejectUnauthorized: false,
//     },
//   });
// } else {
//   db = new pg.Pool({ connectionString: DATABASE_URL });
// }


import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
//import { sql } from 'drizzle-orm';

const pool = new pkg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export async function connectWithDB() {
  try {
    await pool.connect();
    // await db.execute(sql`SELECT NOW()`);
    console.log('> Database connection Successful!');

    console.log('> Running Migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('> Migrations Complete.\n');

    await pool.end();
  } catch (error) {
    console.log('[database]: failed to connect with db, ' + error);
    throw error;
  }
}

export default db;
