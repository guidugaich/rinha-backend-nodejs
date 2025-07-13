import { FastifyReply, FastifyRequest } from "fastify";
import { PaymentData, processPayment } from "../services/paymentService";

export async function createPaymentController(req: FastifyRequest<{ Body: PaymentData }>, reply: FastifyReply) {
    const { body } = req;
    if (!body || !body.amount || !body.correlationId) {
        reply.status(400).send({ message: 'Invalid request body' });
        return;
    }
    const paymentProcessed = await processPayment(body);
    return { message: 'Payment processed', paymentProcessed };
};

export async function paymentSummaryController(req: FastifyRequest) {
    console.log('Payment summary received', req.host);
    return { message: 'Payment summary received on controller' };
};