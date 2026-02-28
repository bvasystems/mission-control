import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const parsedConnectionString = connectionString.replace(
  'sslmode=require',
  'sslmode=require&uselibpqcompat=true'
);

export const db = new Pool({ connectionString: parsedConnectionString, ssl: { rejectUnauthorized: false } });
