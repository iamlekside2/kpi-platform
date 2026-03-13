const prisma = require('../../config/db');
const { syncOrg } = require('./sync.service');
const { checkAlerts } = require('./notifications.service');

let intervalId = null;

/**
 * Start the sync scheduler.
 * Runs every hour, checks which orgs need syncing based on their schedule.
 * For simplicity in Phase 4, we run daily syncs at roughly midnight
 * and weekly syncs on Mondays.
 */
function startScheduler() {
  console.log('Sync scheduler started (hourly check)');

  // Check every hour
  intervalId = setInterval(async () => {
    try {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0=Sun, 1=Mon

      // Only sync during the configured hour (default: 2 AM)
      if (hour !== 2) return;

      const orgs = await prisma.organisation.findMany({
        where: {
          integrations: { some: { status: { not: 'disabled' } } },
        },
        select: { id: true, name: true },
      });

      for (const org of orgs) {
        try {
          console.log(`[Scheduler] Syncing org: ${org.name}`);
          await syncOrg(org.id);
          await checkAlerts(org.id);
        } catch (err) {
          console.error(`[Scheduler] Failed to sync org ${org.name}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  }, 60 * 60 * 1000); // every hour
}

function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Sync scheduler stopped');
  }
}

module.exports = { startScheduler, stopScheduler };
