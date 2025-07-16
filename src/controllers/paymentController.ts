import { FastifyReply, FastifyRequest } from "fastify";
import { addPaymentJob } from '../services/queueService';
import { getPaymentSummary } from "../services/paymentSummaryService";
import { createPendingPayment, PaymentData } from "../services/paymentService";

export interface PaymentRequest {
    correlationId: string;
    amount: number;
}

export async function createPaymentController(req: FastifyRequest<{ Body: PaymentRequest }>, reply: FastifyReply) {
    const { correlationId, amount } = req.body;
    
    if (!correlationId || typeof amount !== 'number') {
        return reply.status(400).send({ message: 'Invalid request body. "correlationId" and "amount" are required.' });
    }

    try {
        await createPendingPayment(correlationId, amount, new Date());
        addPaymentJob({ paymentId: correlationId });

        return reply.status(202).send({ correlationId });
    } catch (error) {
        console.error('Error creating payment job:', error);
        return reply.status(500).send({ message: 'Internal Server Error' });
    }
}

export async function paymentSummaryController() {
    const paymentSummary = await getPaymentSummary();
    return { message: 'Payment summary received', paymentSummary };
};