import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

export const connectToDB = async () => {
  try {
    await pool.query('SELECT NOW()');
  } catch (error) {
    console.error('Failed to connect to the database', error);
    process.exit(1);
  }
};