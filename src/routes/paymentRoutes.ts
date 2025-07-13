import { FastifyPluginAsync } from 'fastify';
import { createPaymentController, paymentSummaryController } from '../controllers/paymentController'; // We'll create this in the next step

const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/payments', createPaymentController);
  fastify.get('/payments-summary', paymentSummaryController);
};

export default paymentRoutes;