import { config } from 'dotenv';
import { pool } from '../database/connection';
import { PaymentData, PaymentResult } from '../shared/interfaces';
import { getBestProcessor } from './paymentProcessorHealthService';

config();

const processorHosts = {
  default: process.env.PAYMENT_PROCESSOR_DEFAULT_HOST,
  fallback: process.env.PAYMENT_PROCESSOR_FALLBACK_HOST,
};

export async function processPayment(data: PaymentData): Promise<PaymentResult> {
  const requestBody = {
    amount: data.amount_cents / 100,
    correlationId: data.correlation_id,
    requestedAt: data.created_at.toISOString()
  }

  const primaryProcessor = getBestProcessor();
  const secondaryProcessor = primaryProcessor === 'default' ? 'fallback' : 'default';

  const tryProcessor = async (processor: 'default' | 'fallback'): Promise<PaymentResult | null> => {
    try {
      const response = await fetch(`${processorHosts[processor]}/payments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        return { success: true, processor };
      }
    } catch (error) {
      console.error(`Error on ${processor} payment processor for payment ${data.correlation_id}:`, error);
    }
    return null;
  }

  let result = await tryProcessor(primaryProcessor);
  if (result) {
    return result;
  }

  result = await tryProcessor(secondaryProcessor);
  if (result) {
    return result;
  }

  return { success: false, processor: 'none' };
};

export async function createPendingPayment(
  correlationId: string,
  amountCents: number,
  createdAt: Date,
): Promise<void> {
  await pool.query(
        'INSERT INTO payments (correlation_id, amount_cents, status, "created_at") VALUES ($1, $2, $3, $4)',
        [correlationId, amountCents, 'pending', createdAt]
    );
}

export async function updatePaymentStatus(
  correlationId: string,
  status: 'processed' | 'failed',
  processor: 'default' | 'fallback' | 'none'
): Promise<void> {
  await pool.query(
    'UPDATE payments SET status = $1, processor = $2, "updated_at" = NOW() WHERE correlation_id = $3',
    [status, processor, correlationId]
  );
}
