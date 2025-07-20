import { pool } from '../database/connection';
import { PaymentJob } from '../shared/interfaces';
import { createPendingPayment, processPayment } from './paymentService';

const queue: PaymentJob[] = [];

export function addPaymentJob(job: PaymentJob) {
  queue.push(job);
}

async function processQueue() {
  if (queue.length === 0) {
    setTimeout(processQueue, 500);
    return;
  }

  const job = queue.shift();

  if (job) {
    try {
      await createPendingPayment(job.correlationId, job.amountInCents, job.createdAt);
      const paymentData = {
        amount_cents: job.amountInCents,
        correlation_id: job.correlationId,
        created_at: job.createdAt
      };
      
      const result = await processPayment(paymentData);

      const newStatus = result.success ? 'processed' : 'failed';
      await pool.query(
        'UPDATE payments SET status = $1, processor = $2, "updated_at" = NOW() WHERE correlation_id = $3',
        [newStatus, result.processor, job.correlationId]
      );
    } catch (error) {
        console.error(`Error processing job for correlationId ${job.correlationId}:`, error);
      // If the initial insert fails (e.g., duplicate correlationId), we just log it and move on.
      // The client already got a 202, so we can't report back.
    }
  }

  process.nextTick(processQueue);
}

export function startWorker() {
  processQueue();
}
