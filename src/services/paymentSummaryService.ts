import { pool } from "../database/connection";
import { PaymentSummaryResponse } from "../shared/interfaces";

export async function getPaymentSummary(from?: string, to?: string): Promise<PaymentSummaryResponse> {
    const params: string[] = [];
    const whereClauses: string[] = [`status = 'processed'`, `processor IN ('default', 'fallback')`];

    if (from) {
        params.push(from);
        whereClauses.push(`created_at >= $${params.length}`);
    }

    if (to) {
        params.push(to);
        whereClauses.push(`created_at <= $${params.length}`);
    }

    const query = `
        SELECT
            COALESCE(COUNT(CASE WHEN processor = 'default' THEN 1 END), 0)::INT AS "defaultTotalRequests",
            COALESCE(SUM(CASE WHEN processor = 'default' THEN amount_cents END), 0) AS "defaultTotalAmount",
            COALESCE(COUNT(CASE WHEN processor = 'fallback' THEN 1 END), 0)::INT AS "fallbackTotalRequests",
            COALESCE(SUM(CASE WHEN processor = 'fallback' THEN amount_cents END), 0) AS "fallbackTotalAmount"
        FROM
            payments
        WHERE
            ${whereClauses.join(' AND ')}
    `;

    const result = await pool.query(query, params);
    const row = result.rows[0];

    return {
        default: {
            totalRequests: row.defaultTotalRequests,
            totalAmount: Number(row.defaultTotalAmount) / 100,
        },
        fallback: {
            totalRequests: row.fallbackTotalRequests,
            totalAmount: Number(row.fallbackTotalAmount) / 100,
        },
    };
}