import { PayjaApiService } from './payja-api.service.js';

export class PayjaSyncService {
  constructor(db) {
    this.db = db;
    this.api = new PayjaApiService();
    this.timer = null;
  }

  async syncOnce() {
    try {
      console.log('PayjaSyncService: starting one-shot sync');
      // Simple connectivity test — if PayJA is reachable we log it.
      const test = await this.api.testConnection();
      if (!test || test.success === false) {
        console.warn('PayjaSyncService: PayJA not reachable:', test && test.error);
        return { success: 0, errors: 1 };
      }

      // Placeholder: future implementation would fetch/merge customers here.
      console.log('PayjaSyncService: PayJA reachable:', test.data || null);
      return { success: 0, errors: 0 };
    } catch (err) {
      console.error('PayjaSyncService syncOnce error:', err && err.message ? err.message : err);
      return { success: 0, errors: 1 };
    }
  }

  startPeriodicSync(intervalMs = 60000) {
    // Stop existing timer
    this.stop();
    // Run immediately
    this.syncOnce().catch(() => {});
    // Schedule periodic runs
    this.timer = setInterval(() => {
      this.syncOnce().catch(() => {});
    }, intervalMs);
    console.log(`PayjaSyncService: periodic sync started (every ${intervalMs}ms)`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('PayjaSyncService: periodic sync stopped');
    }
  }
}
