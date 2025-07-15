import { config } from 'dotenv';

config();

export interface PaymentData {
  amount: number;
  correlationId: string;
}

interface ExternalResponse {
  status: string;
}

const PAYMENT_PROCESSOR_HOST = process.env.PAYMENT_PROCESSOR_FALLBACK_HOST

export async function processPayment(data: PaymentData): Promise<ExternalResponse> {
  const requestBody = {
    ...data,
    requestedAt: new Date().toISOString()
  }
  const requestUrl = `${PAYMENT_PROCESSOR_HOST}/payments`;
  const paymentProcessorResponse = await fetch(requestUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(requestBody),
  });
  console.log('Payment processor response', paymentProcessorResponse);
  return paymentProcessorResponse.json();
};

export async function getPaymentSummary(): Promise<any> {
  return {
    totalAmount: 1000,
    totalCount: 10,
  };
}