import { pool } from '../database/connection';
import { processPayment } from './paymentService';

interface PaymentJob {
  paymentId: string;
}

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
      console.log(`Processing payment job for ID: ${job.paymentId}`);

      const paymentQuery = await pool.query('SELECT amount, correlation_id, created_at FROM payments WHERE correlation_id = $1', [job.paymentId]);
      
      if (paymentQuery.rows.length === 0) {
          console.error(`Payment with ID ${job.paymentId} not found in DB.`);
          process.nextTick(processQueue); // Move to next job
          return;
      }

      const paymentData = paymentQuery.rows[0];
      const result = await processPayment(paymentData);

      const newStatus = result.success ? 'processed' : 'failed';
      await pool.query(
        'UPDATE payments SET status = $1, processor = $2, "updatedAt" = NOW() WHERE correlation_id = $3',
        [newStatus, result.processor, job.paymentId]
      );
      console.log(`Payment job for ID: ${job.paymentId} finished with status: ${newStatus}`);
    } catch (error) {
      console.error(`Critical error processing job for payment ID ${job.paymentId}:`, error);
      // Mark as failed on critical error
      try {
        await pool.query(
          "UPDATE payments SET status = 'failed', processor = 'none', \"updatedAt\" = NOW() WHERE correlation_id = $1",
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
  console.log('Payment worker started.');
  processQueue();
}
