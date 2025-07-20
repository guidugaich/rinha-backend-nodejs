export interface PaymentSummaryResponse {
    default: {
        totalRequests: number;
        totalAmount: number;
    },
    fallback: {
        totalRequests: number;
        totalAmount: number;
    }
}

export interface PaymentRequest {
    correlationId: string;
    amount: number;
}

export interface PaymentData {
    amount_cents: number;
    correlation_id: string;
    created_at: Date;
  }

export interface PaymentJob {
    correlationId: string;
    amountInCents: number;
    createdAt: Date;
}

export interface PaymentResult {
    success: boolean;
    processor: 'default' | 'fallback' | 'none';
}

export interface SummaryQuery {
    from?: string;
    to?: string;
}

export interface HealthStatus {
    failing: boolean;
    minResponseTime: number;
}
  
export interface CachedHealth {
    default: HealthStatus;
    fallback: HealthStatus;
}