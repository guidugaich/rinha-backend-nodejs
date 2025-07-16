import { pool } from "../database/connection";

export async function getPaymentSummary(): Promise<any> {
    const result = await pool.query('SELECT SUM(amount) as total_amount, COUNT(*) as total_count FROM payments');
    return result.rows[0];
}