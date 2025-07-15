import { FastifyPluginAsync } from 'fastify';
import * as os from 'os';
import { pool } from '../database/connection';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return { status: 'ok', hostname: os.hostname() };
  });

  fastify.get('/health/db', async () => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok', message: 'Database connection is healthy' };
    } catch (error) {
      fastify.log.error(error);
      return { status: 'error', message: 'Database connection failed' };
    }
  });
};

export default healthRoutes;