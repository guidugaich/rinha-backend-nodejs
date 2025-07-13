import axios, { AxiosResponse } from 'axios';

export interface PaymentData {
  amount: number;
  correlationId: string;
}

interface ExternalResponse {
  status: string;
}

export async function processPayment(data: PaymentData): Promise<ExternalResponse> {
  if (data.amount <= 0) {
    throw new Error('Amount must be positive');
  }

  console.log('Payment received', data);
  return { status: 'success' };
};