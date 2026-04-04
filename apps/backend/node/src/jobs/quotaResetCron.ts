/**
 * Quota Reset Cron Job
 * Runs daily at midnight UTC (0 0 * * *)
 * Resets projects_created and compute_units_used for all past-date quota records.
 * Requirements: 3.5
 */

import cron from 'node-cron';
import { QuotaService } from '../services/quotaService.js';
import { logger } from '../utils/logger.js';

export function startQuotaResetCron(): void {
    // Run at 00:00 UTC every day
    cron.schedule('0 0 * * *', async () => {
        logger.info('[QuotaReset] Running daily quota reset');
        try {
            const count = await QuotaService.resetAll();
            logger.info(`[QuotaReset] Reset ${count} quota records for past dates`);
        } catch (err) {
            logger.error({ err }, '[QuotaReset] Failed to reset quotas');
        }
    }, { timezone: 'UTC' });

    logger.info('[QuotaReset] Daily quota reset cron scheduled (0 0 * * * UTC)');
}
