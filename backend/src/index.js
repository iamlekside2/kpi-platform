const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const orgRoutes = require('./modules/orgs/orgs.routes');
const templateRoutes = require('./modules/templates/templates.routes');
const kpiRoutes = require('./modules/kpis/kpis.routes');
const importRoutes = require('./modules/import/import.routes');
const integrationRoutes = require('./modules/integrations/integrations.routes');
const syncRoutes = require('./modules/sync/sync.routes');
const appraisalRoutes = require('./modules/appraisals/appraisals.routes');

// Middleware imports
const { authenticate } = require('./modules/auth/auth.middleware');

// Scheduler
const { startScheduler } = require('./modules/sync/scheduler');

const app = express();

// Global middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' })); // Allow larger payloads for CSV
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orgs', authenticate, orgRoutes);
app.use('/api/templates', authenticate, templateRoutes);
app.use('/api/kpis', authenticate, kpiRoutes);
app.use('/api/import', authenticate, importRoutes);
app.use('/api/integrations', authenticate, integrationRoutes);
app.use('/api/sync', authenticate, syncRoutes);
app.use('/api/appraisals', authenticate, appraisalRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.port, () => {
  console.log(`KPI Platform API running on port ${env.port}`);
  // Start sync scheduler
  startScheduler();
});
