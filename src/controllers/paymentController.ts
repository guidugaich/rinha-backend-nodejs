import { FastifyReply, FastifyRequest } from "fastify";
import { getPaymentSummary, PaymentData, processPayment } from "../services/paymentService";

export async function createPaymentController(req: FastifyRequest<{ Body: PaymentData }>, reply: FastifyReply) {
    const { body } = req;
    if (!body || !body.amount || !body.correlationId) {
        reply.status(400).send({ message: 'Invalid request body' });
        return;
    }
    const paymentProcessed = await processPayment(body);
    return { message: 'Payment processed', paymentProcessed };
};

export async function paymentSummaryController() {
    const paymentSummary = await getPaymentSummary();
    return { message: 'Payment summary received', paymentSummary };
};