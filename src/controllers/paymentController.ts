import { FastifyReply, FastifyRequest } from "fastify";
import { addPaymentJob } from '../services/queueService';
import { PaymentSummaryResponse, PaymentRequest, SummaryQuery } from "../shared/interfaces";
import { getPaymentSummary } from "../services/paymentSummaryService";

export async function createPaymentController(req: FastifyRequest<{ Body: PaymentRequest }>, reply: FastifyReply) {
    const { correlationId, amount } = req.body;
    
    if (!correlationId || typeof amount !== 'number' || amount <= 0) {
        return reply.status(400).send({ message: 'Invalid request body. "correlationId" and a positive "amount" are required.' });
    }

    try {
        const amountInCents = Math.round(amount * 100);
        
        addPaymentJob({ correlationId, amountInCents, createdAt: new Date() });

        return reply.status(202).send();
    } catch (error) {
        return reply.status(500).send();
    }
}

export async function paymentSummaryController(
    req: FastifyRequest<{ Querystring: SummaryQuery }>,
    reply: FastifyReply
): Promise<PaymentSummaryResponse> {
    const { from, to } = req.query;

    if (from && isNaN(new Date(from).getTime())) {
        return reply.status(400).send({ message: 'Invalid "from" date format. Please use UTC ISO format.' });
    }

    if (to && isNaN(new Date(to).getTime())) {
        return reply.status(400).send({ message: 'Invalid "to" date format. Please use UTC ISO format.' });
    }

    const paymentSummary = await getPaymentSummary(from, to);
    return reply.status(200).send(paymentSummary);
};