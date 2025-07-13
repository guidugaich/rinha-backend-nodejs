import { config } from 'dotenv';
import Fastify, { FastifyInstance } from 'fastify';
import paymentRoutes from './routes/paymentRoutes';

config(); // Load environment variables from .env file

const server: FastifyInstance = Fastify({ logger: true });

server.register(paymentRoutes);

const start = async () => {
  try {
    const port = process.env.PORT || 9999;
    await server.listen({ port: Number(port) });
    server.log.info(`Server listening on ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();