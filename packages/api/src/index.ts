import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { searchRoutes } from './routes/search.js';
import { entityRoutes } from './routes/entities.js';
import { actionRoutes } from './routes/actions.js';
import { assembleRoutes } from './routes/assemble.js';
import { crawlRoutes } from './routes/crawl.js';
import { healthRoutes } from './routes/health.js';
import { apiKeyAuth } from './middleware/auth.js';
import { rateLimit } from './middleware/rate-limit.js';
import { queryCache } from './middleware/cache.js';

const app = new Hono();

app.use('*', cors());
app.use('*', rateLimit(200, 60));   // 200 req/min per IP globally
app.use('/v1/*', apiKeyAuth);
app.use('/v1/*', queryCache(300));  // 5-min cache for GET responses

app.route('/v1', searchRoutes);
app.route('/v1', entityRoutes);
app.route('/v1', actionRoutes);
app.route('/v1', assembleRoutes);
app.route('/v1', crawlRoutes);
app.route('/', healthRoutes);

const port = parseInt(process.env.PORT || process.env.API_PORT || '3000');
console.log(`WebDex API starting on port ${port}`);
serve({ fetch: app.fetch, port });
