import { config } from 'dotenv';
import Fastify, { FastifyInstance } from 'fastify';
import paymentRoutes from './routes/paymentRoutes';
import healthRoutes from './routes/HealthRoutes';
import { connectToDB } from './database/connection';

config();

const server: FastifyInstance = Fastify({ logger: true });

server.register(healthRoutes);
server.register(paymentRoutes);

const start = async () => {
  try {
    await connectToDB();

    const port = process.env.PORT || 9999;
    await server.listen({
      port: Number(port),
      host: '0.0.0.0',
    });
    server.log.info(`Server listening on ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();