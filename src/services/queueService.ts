import { pool } from '../database/connection';
import { PaymentJob } from '../shared/interfaces';
import { processPayment } from './paymentService';

const queue: PaymentJob[] = [];

export function addPaymentJob(job: PaymentJob) {
  queue.push(job);
}

async function processQueue() {
  if (queue.length === 0) {
    setTimeout(processQueue, 1000); // Wait 1s if queue is empty
    return;
  }

  const job = queue.shift(); // Get the next job

  if (job) {
    try {
      const paymentQuery = await pool.query('SELECT amount_cents, correlation_id, created_at FROM payments WHERE correlation_id = $1', [job.paymentId]);
      
      if (paymentQuery.rows.length === 0) {
          process.nextTick(processQueue); // Move to next job
          return;
      }

      const paymentData = paymentQuery.rows[0];
      const result = await processPayment(paymentData);

      const newStatus = result.success ? 'processed' : 'failed';
      await pool.query(
        'UPDATE payments SET status = $1, processor = $2, "updated_at" = NOW() WHERE correlation_id = $3',
        [newStatus, result.processor, job.paymentId]
      );
    } catch (error) {
      try {
        await pool.query(
          "UPDATE payments SET status = 'failed', processor = 'none', \"updated_at\" = NOW() WHERE correlation_id = $1",
          [job.paymentId]
        );
      } catch (dbError) {
          console.error(`Failed to update job ${job.paymentId} to failed status`, dbError);
      }
    }
  }

  // Immediately check for the next job
  process.nextTick(processQueue);
}

export function startWorker() {
  processQueue();
}
