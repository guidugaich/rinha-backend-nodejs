import { config } from 'dotenv';
import { pool } from '../database/connection';

config();

export interface PaymentData {
  amount: number;
  correlation_id: string;
  created_at: Date;
}

interface PaymentResult {
  success: boolean;
  processor: 'default' | 'fallback' | 'none';
}

const processorDefaultHost = process.env.PAYMENT_PROCESSOR_DEFAULT_HOST;
const processorFallbackHost = process.env.PAYMENT_PROCESSOR_FALLBACK_HOST;

export async function processPayment(data: PaymentData): Promise<PaymentResult> {
  const requestBody = {
    amount: data.amount,
    correlationId: data.correlation_id,
    requestedAt: data.created_at.toISOString()
  }

  try {
    const defaultProcessorResponse = await fetch(`${processorDefaultHost}/payments`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestBody),
    });

    if (defaultProcessorResponse.ok) { // .ok is true for status codes 200-299
      console.log(`Payment ${data.correlation_id} processed successfully by default processor`);
      return { success: true, processor: 'default' };
    }
    console.warn(`Default processor returned non-ok response for payment ${data.correlation_id}:`, defaultProcessorResponse.status);
  } catch (error) {
    console.error(`Error on default payment processor for payment ${data.correlation_id}:`, error);
  }

  console.log('Trying fallback payment processor');
  try {
    const fallbackProcessorResponse = await fetch(`${processorFallbackHost}/payments`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestBody),
    });

    if (fallbackProcessorResponse.ok) {
      console.log(`Payment ${data.correlation_id} processed successfully by fallback processor`);
      return { success: true, processor: 'fallback' };
    }
    console.error(`Fallback processor returned non-ok response for payment ${data.correlation_id}:`, fallbackProcessorResponse.status);
  } catch (error) {
    console.error(`Error on fallback payment processor for payment ${data.correlation_id}:`, error);
  }

  return { success: false, processor: 'none' };
};

export async function createPendingPayment(
  correlationId: string,
  amount: number,
  createdAt: Date,
): Promise<void> {
  try {
      await pool.query(
          'INSERT INTO payments (correlation_id, amount, status, "created_at") VALUES ($1, $2, $3, $4)',
          [correlationId, amount, 'pending', createdAt]
      );
  } catch (error) {
      console.error(`Database error creating pending payment for ${correlationId}:`, error);
      
      throw error;
  }
}
