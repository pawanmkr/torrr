import 'dotenv/config';
import process from 'process';

export default {
  schema: './src/database/schema.js',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
};