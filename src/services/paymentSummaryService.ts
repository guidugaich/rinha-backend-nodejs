import { pool } from "../database/connection";
import { PaymentSummaryResponse } from "../shared/interfaces";

export async function getPaymentSummary(): Promise<PaymentSummaryResponse> {
    const result = await pool.query('SELECT SUM(amount) as total_amount, COUNT(*) as total_count FROM payments');
    return result.rows[0];
}