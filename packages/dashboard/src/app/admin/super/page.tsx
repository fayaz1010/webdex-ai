'use client';
import { useState } from 'react';

const Badge = ({ children, bg, fg }: { children: React.ReactNode; bg?: string; fg?: string }) => (
  <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: bg || '#1a2535', color: fg || '#6a7a8a', whiteSpace: 'nowrap' }}>{children}</span>
);

const PIPELINE_HEALTH = {
  crawler: { status: 'healthy', uptime: '14d 7h', pagesPerHour: 1847, queueDepth: 342, errorRate: '0.3%', lastError: 'Timeout on sparksolarpanels.com.au (35s)', avgLatency: '1.2s' },
  interpreter: { status: 'healthy', uptime: '14d 7h', pagesPerHour: 1623, modelLoaded: 'Qwen2.5-7B-Q4', gpuMemUsed: '5.1GB / 24GB', avgInferenceMs: 680, escalationRate: '4.2%' },
  database: { status: 'healthy', connections: '8 / 20', diskUsed: '2.7GB / 50GB', queryAvgMs: 12, vectorIndexSize: '1.1GB', entities: 14823, pages: 2847 },
  redis: { status: 'healthy', memUsed: '89MB / 256MB', hitRate: '87%', queueJobs: 342, cachedQueries: 1203 },
  api: { status: 'healthy', requestsToday: 847, avgResponseMs: 45, errorRate: '0.1%', activeKeys: 3 },
};

const CRAWL_METRICS = {
  today: { crawled: 423, succeeded: 418, failed: 5, skipped: 12, newPages: 156, updatedPages: 262, unchanged: 0, avgCrawlMs: 1240 },
  total: { pages: 2847, domains: 47, entities: 14823, relationships: 8234, formsMapped: 312, apiDiscovered: 89 },
  byType: [
    { type: 'HTTP (Cheerio)', count: 1847, pct: 65, avgMs: 340, color: '#10b981' },
    { type: 'Browser (Playwright)', count: 1000, pct: 35, avgMs: 2800, color: '#8b5cf6' },
  ],
  topDomains: [
    { domain: 'regenpower.com', pages: 234, entities: 892, lastCrawl: '2h ago', health: 98 },
    { domain: 'infiniteenergy.com.au', pages: 187, entities: 734, lastCrawl: '3h ago', health: 95 },
    { domain: 'solarcity.com.au', pages: 156, entities: 623, lastCrawl: '1h ago', health: 97 },
    { domain: 'cleanenergycouncil.org.au', pages: 89, entities: 345, lastCrawl: '6h ago', health: 92 },
    { domain: 'energy.gov.au', pages: 67, entities: 234, lastCrawl: '12h ago', health: 94 },
  ],
};

const AI_METRICS = {
  classification: { accuracy: 91.2, tested: 200, correct: 182, confused: [
    { actual: 'product_landing', predicted: 'business_service_landing', count: 7 },
    { actual: 'contact_page', predicted: 'about_page', count: 4 },
    { actual: 'staff_directory', predicted: 'contact_page', count: 3 },
    { actual: 'pricing_page', predicted: 'product_landing', count: 2 },
    { actual: 'faq_page', predicted: 'blog_article', count: 2 },
  ] },
  entityExtraction: {
    overall: { precision: 87.4, recall: 82.1, f1: 84.7 },
    byCategory: [
      { category: 'contact', precision: 92.3, recall: 78.5, f1: 84.8, count: 3421, issues: 'Misses contacts in image-based staff pages. Sometimes extracts company name as person name.' },
      { category: 'organisation', precision: 95.1, recall: 91.2, f1: 93.1, count: 2134, issues: 'Occasionally creates duplicate entities for same org with slightly different names.' },
      { category: 'product', precision: 88.7, recall: 84.3, f1: 86.4, count: 1847, issues: 'Struggles with complex pricing (tiered, conditional). Sometimes misses finance options.' },
      { category: 'action', precision: 94.2, recall: 89.7, f1: 91.9, count: 3234, issues: 'Good at forms. Misses some AJAX-triggered actions. Chat widgets sometimes not detected.' },
      { category: 'location', precision: 91.5, recall: 86.8, f1: 89.1, count: 1567, issues: 'Occasionally extracts postal address from privacy policy instead of business address.' },
      { category: 'review', precision: 82.3, recall: 76.4, f1: 79.2, count: 987, issues: 'Aggregation across platforms needs work. Sometimes double-counts Google reviews.' },
    ],
  },
  escalations: {
    total: 119,
    reasons: [
      { reason: 'Low classification confidence (<0.7)', count: 45, pct: 37.8 },
      { reason: 'Complex JavaScript SPA', count: 32, pct: 26.9 },
      { reason: 'Unusual page structure', count: 23, pct: 19.3 },
      { reason: 'Entity extraction parse failure', count: 12, pct: 10.1 },
      { reason: 'Non-English content detected', count: 7, pct: 5.9 },
    ],
  },
  modelPerformance: { tokensPerSecond: 14.2, avgInputTokens: 2840, avgOutputTokens: 620, peakMemoryGb: 5.8, cacheHitRate: '23%' },
};

const ACTION_METRICS = {
  formSubmissions: { total: 47, successful: 44, failed: 3, successRate: 93.6 },
  byDomain: [
    { domain: 'regenpower.com', attempts: 12, success: 12, rate: 100, endpoint: '/api/quote-requests', avgMs: 340 },
    { domain: 'infiniteenergy.com.au', attempts: 8, success: 7, rate: 87.5, endpoint: '/wp-json/.../feedback', avgMs: 890, issue: 'Occasional 429 rate limit' },
    { domain: 'solarcity.com.au', attempts: 6, success: 6, rate: 100, endpoint: '/contact/solar-quote', avgMs: 560 },
    { domain: 'arise.solar', attempts: 5, success: 4, rate: 80, endpoint: '/get-quote', avgMs: 1200, issue: 'CAPTCHA on 4th+ submission per hour' },
    { domain: 'solarwholesale.com.au', attempts: 4, success: 4, rate: 100, endpoint: '/get-quote', avgMs: 430 },
  ],
  commonFailures: [
    { type: 'CAPTCHA / bot detection', count: 2, pct: 42 },
    { type: 'Rate limiting (429)', count: 1, pct: 21 },
    { type: 'Field validation mismatch', count: 0, pct: 0 },
    { type: 'Endpoint changed (404)', count: 0, pct: 0 },
  ],
};

const RECENT_LOGS = [
  { ts: '14:23:41', level: 'info', component: 'crawler', msg: 'Crawled regenpower.com/residential/10kw — 200 OK, 187KB, 3 forms, 12 links (1.1s)' },
  { ts: '14:23:40', level: 'info', component: 'interpreter', msg: 'Classified regenpower.com/residential/10kw → product_landing (0.94 confidence)' },
  { ts: '14:23:39', level: 'info', component: 'interpreter', msg: 'Extracted 7 entities: 2 contacts, 1 org, 2 products, 2 actions' },
  { ts: '14:23:38', level: 'warn', component: 'interpreter', msg: 'Low confidence on contact extraction for arise.solar/about — escalating to cloud model' },
  { ts: '14:23:35', level: 'info', component: 'crawler', msg: 'Smart router: arise.solar/about → Playwright (JS framework detected)' },
  { ts: '14:23:32', level: 'info', component: 'action', msg: 'Form submission successful: regenpower.com/api/quote-requests → 200 (340ms)' },
  { ts: '14:23:28', level: 'error', component: 'crawler', msg: 'Failed: sparksolarpanels.com.au/contact — Timeout after 35000ms' },
  { ts: '14:23:25', level: 'info', component: 'crawler', msg: 'Change detected: solarcity.com.au/10kw-system — price updated $7,290 → $6,990' },
  { ts: '14:23:22', level: 'info', component: 'database', msg: 'Entity updated: product/solarcity-10kw — price field changed, re-embedded' },
  { ts: '14:23:18', level: 'info', component: 'scheduler', msg: 'Re-crawl queued: 23 pages due for weekly refresh' },
  { ts: '14:23:15', level: 'warn', component: 'interpreter', msg: 'Entity extraction returned empty for cleanenergycouncil.org.au/find-installer — page is a search form with no pre-loaded results' },
  { ts: '14:23:10', level: 'info', component: 'api', msg: "Search query: 'solar installers perth' — 23 results, 34ms, cache MISS" },
  { ts: '14:23:05', level: 'info', component: 'personal', msg: 'Personal index started: user_abc123 — 87 URLs queued (basic tier)' },
];

const StatusDot = ({ status }: { status: string }) => (
  <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'healthy' ? '#10b981' : status === 'degraded' ? '#f59e0b' : '#e85c5c', boxShadow: `0 0 6px ${status === 'healthy' ? '#10b981' : status === 'degraded' ? '#f59e0b' : '#e85c5c'}` }} />
);

const MetricCard = ({ label, value, sub, color, small }: { label: string; value: string | number; sub?: string; color?: string; small?: boolean }) => (
  <div style={{ background: '#0d1520', borderRadius: 10, border: '1px solid #1a2535', padding: small ? '10px 12px' : '14px 16px', textAlign: 'center' }}>
    <div style={{ fontSize: small ? 18 : 24, fontWeight: 800, color: color || '#e8edf3', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    <div style={{ fontSize: small ? 9 : 10, color: '#5a6a7a', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{label}</div>
    {sub && <div style={{ fontSize: 9, color: '#3a4a5a', marginTop: 1 }}>{sub}</div>}
  </div>
);

const ProgressBar = ({ value, max = 100, color, height = 6 }: { value: number; max?: number; color: string; height?: number }) => (
  <div style={{ height, borderRadius: height / 2, background: '#1a2535', overflow: 'hidden' }}>
    <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: '100%', borderRadius: height / 2, background: color, transition: 'width 0.3s' }} />
  </div>
);

export default function SuperAdmin() {
  const [view, setView] = useState('overview');
  const [logFilter, setLogFilter] = useState('all');

  return (
    <div style={{ background: '#080c14', color: '#c0c8d4', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ borderBottom: '1px solid #1a2535', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #10b981, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#080c14' }}>W</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e8edf3' }}>WebDex Super Admin</span>
          <Badge bg="#10b98120" fg="#10b981">All Systems Healthy</Badge>
        </div>
        <div style={{ fontSize: 11, color: '#4a5a6a', fontFamily: "'JetBrains Mono', monospace" }}>
          Solar Perth Vertical · {PIPELINE_HEALTH.database.entities.toLocaleString()} entities · {PIPELINE_HEALTH.database.pages.toLocaleString()} pages
        </div>
      </div>

      <div style={{ padding: '10px 24px 0', display: 'flex', gap: 4 }}>
        {[
          { key: 'overview', label: 'Pipeline Overview' },
          { key: 'crawl', label: 'Crawl Metrics' },
          { key: 'ai', label: 'AI Accuracy' },
          { key: 'actions', label: 'Action Success' },
          { key: 'logs', label: 'Live Logs' },
        ].map(t => (
          <button key={t.key} onClick={() => setView(t.key)} style={{
            padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            background: view === t.key ? '#0d1520' : 'transparent',
            color: view === t.key ? '#e8edf3' : '#4a5a6a',
            borderBottom: view === t.key ? '2px solid #10b981' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ background: '#0d1520', borderRadius: '0 0 12px 12px', border: '1px solid #1a2535', borderTop: 'none', padding: 20 }}>

          {view === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                {Object.entries(PIPELINE_HEALTH).map(([name, svc]) => (
                  <div key={name} style={{ background: '#0a0d14', borderRadius: 10, border: '1px solid #1a2535', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <StatusDot status={svc.status} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#e8edf3', textTransform: 'capitalize' }}>{name}</span>
                    </div>
                    {Object.entries(svc).filter(([k]) => k !== 'status').slice(0, 4).map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                        <span style={{ color: '#4a5a6a' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span style={{ color: '#8a9ab0', fontFamily: "'JetBrains Mono', monospace" }}>{String(val)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
                <MetricCard label="Pages Indexed" value={CRAWL_METRICS.total.pages.toLocaleString()} color="#10b981" small />
                <MetricCard label="Entities" value={CRAWL_METRICS.total.entities.toLocaleString()} color="#8b5cf6" small />
                <MetricCard label="Forms Mapped" value={CRAWL_METRICS.total.formsMapped} color="#f59e0b" small />
                <MetricCard label="APIs Found" value={CRAWL_METRICS.total.apiDiscovered} color="#06b6d4" small />
                <MetricCard label="AI Accuracy" value={AI_METRICS.entityExtraction.overall.f1 + '%'} color={AI_METRICS.entityExtraction.overall.f1 > 85 ? '#10b981' : '#f59e0b'} small />
                <MetricCard label="Action Success" value={ACTION_METRICS.formSubmissions.successRate + '%'} color="#10b981" small />
              </div>

              <div style={{ fontSize: 11, color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Top Domains</div>
              {CRAWL_METRICS.topDomains.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 6, marginBottom: 2, background: i % 2 === 0 ? '#0a0d14' : 'transparent' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e8edf3', width: 220 }}>{d.domain}</span>
                  <span style={{ fontSize: 11, color: '#6a7a8a', width: 80 }}>{d.pages} pages</span>
                  <span style={{ fontSize: 11, color: '#8b5cf6', width: 90 }}>{d.entities} entities</span>
                  <span style={{ fontSize: 11, color: '#4a5a6a', width: 80 }}>{d.lastCrawl}</span>
                  <div style={{ flex: 1 }}><ProgressBar value={d.health} color={d.health > 95 ? '#10b981' : '#f59e0b'} /></div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: d.health > 95 ? '#10b981' : '#f59e0b', width: 35, textAlign: 'right' }}>{d.health}%</span>
                </div>
              ))}
            </div>
          )}

          {view === 'crawl' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, marginBottom: 20 }}>
                {[
                  { label: 'Crawled Today', value: CRAWL_METRICS.today.crawled, color: '#10b981' },
                  { label: 'Succeeded', value: CRAWL_METRICS.today.succeeded, color: '#10b981' },
                  { label: 'Failed', value: CRAWL_METRICS.today.failed, color: '#e85c5c' },
                  { label: 'Skipped', value: CRAWL_METRICS.today.skipped, color: '#f59e0b' },
                  { label: 'New Pages', value: CRAWL_METRICS.today.newPages, color: '#06b6d4' },
                  { label: 'Updated', value: CRAWL_METRICS.today.updatedPages, color: '#8b5cf6' },
                  { label: 'Unchanged', value: CRAWL_METRICS.today.unchanged, color: '#4a5a6a' },
                  { label: 'Avg Crawl Time', value: CRAWL_METRICS.today.avgCrawlMs + 'ms', color: '#e8edf3' },
                ].map((m, i) => <MetricCard key={i} {...m} small />)}
              </div>

              <div style={{ fontSize: 11, color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Fetch Method Breakdown</div>
              {CRAWL_METRICS.byType.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#0a0d14', borderRadius: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.color, width: 180 }}>{t.type}</span>
                  <div style={{ flex: 1 }}><ProgressBar value={t.pct} color={t.color} height={8} /></div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e8edf3', width: 50, textAlign: 'right' }}>{t.pct}%</span>
                  <span style={{ fontSize: 11, color: '#5a6a7a', width: 80, textAlign: 'right' }}>{t.count} pages</span>
                  <span style={{ fontSize: 11, color: '#4a5a6a', width: 80, textAlign: 'right' }}>avg {t.avgMs}ms</span>
                </div>
              ))}

              <div style={{ marginTop: 16, padding: 14, background: '#f59e0b08', borderRadius: 8, border: '1px solid #f59e0b15', fontSize: 12, color: '#8a9ab0', lineHeight: 1.6 }}>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>Optimisation insight: </span>
                65% of pages are fetched via HTTP (fast, 340ms avg). The 35% using Playwright average 2.8s. Look for sites currently routed to Playwright that could use HTTP — checking if their important content loads without JS could save significant crawl time.
              </div>
            </div>
          )}

          {view === 'ai' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                <MetricCard label="Classification Accuracy" value={AI_METRICS.classification.accuracy + '%'} color={AI_METRICS.classification.accuracy > 90 ? '#10b981' : '#f59e0b'} />
                <MetricCard label="Entity Precision" value={AI_METRICS.entityExtraction.overall.precision + '%'} color="#8b5cf6" />
                <MetricCard label="Entity Recall" value={AI_METRICS.entityExtraction.overall.recall + '%'} color="#06b6d4" />
                <MetricCard label="F1 Score" value={AI_METRICS.entityExtraction.overall.f1 + '%'} sub="Target: >90%" color={AI_METRICS.entityExtraction.overall.f1 > 85 ? '#10b981' : '#f59e0b'} />
              </div>

              <div style={{ fontSize: 11, color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Accuracy by Entity Category</div>
              {AI_METRICS.entityExtraction.byCategory.map((cat, i) => (
                <div key={i} style={{ background: '#0a0d14', borderRadius: 10, border: '1px solid #1a2535', padding: 14, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e8edf3', width: 100, textTransform: 'capitalize' }}>{cat.category}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 11 }}><span style={{ color: '#4a5a6a' }}>P:</span> <span style={{ color: cat.precision > 90 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{cat.precision}%</span></span>
                      <span style={{ fontSize: 11 }}><span style={{ color: '#4a5a6a' }}>R:</span> <span style={{ color: cat.recall > 85 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{cat.recall}%</span></span>
                      <span style={{ fontSize: 11 }}><span style={{ color: '#4a5a6a' }}>F1:</span> <span style={{ color: cat.f1 > 85 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{cat.f1}%</span></span>
                    </div>
                    <Badge bg="#1a2535" fg="#6a7a8a">{cat.count.toLocaleString()} entities</Badge>
                    <div style={{ flex: 1 }}><ProgressBar value={cat.f1} color={cat.f1 > 85 ? '#10b981' : cat.f1 > 75 ? '#f59e0b' : '#e85c5c'} /></div>
                  </div>
                  <div style={{ fontSize: 11, color: '#e85c5c', paddingLeft: 112, lineHeight: 1.5 }}>⚠ {cat.issues}</div>
                </div>
              ))}

              <div style={{ fontSize: 11, color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Classification Confusion (Top Errors)</div>
              {AI_METRICS.classification.confused.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 12, borderRadius: 4, marginBottom: 2, background: i % 2 === 0 ? '#0a0d14' : 'transparent' }}>
                  <span style={{ color: '#e85c5c', width: 200 }}>{c.actual}</span>
                  <span style={{ color: '#4a5a6a' }}>→ misclassified as →</span>
                  <span style={{ color: '#f59e0b', width: 200 }}>{c.predicted}</span>
                  <span style={{ color: '#6a7a8a', fontFamily: "'JetBrains Mono', monospace" }}>×{c.count}</span>
                </div>
              ))}

              <div style={{ fontSize: 11, color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Cloud Escalation Reasons ({AI_METRICS.escalations.total} total — {((AI_METRICS.escalations.total / PIPELINE_HEALTH.database.pages) * 100).toFixed(1)}% of pages)</div>
              {AI_METRICS.escalations.reasons.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 4, marginBottom: 2, background: i % 2 === 0 ? '#0a0d14' : 'transparent' }}>
                  <span style={{ fontSize: 12, color: '#8a9ab0', flex: 1 }}>{r.reason}</span>
                  <div style={{ width: 100 }}><ProgressBar value={r.pct} color="#8b5cf6" /></div>
                  <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600, width: 40, textAlign: 'right' }}>{r.pct}%</span>
                  <span style={{ fontSize: 11, color: '#4a5a6a', width: 30, textAlign: 'right' }}>{r.count}</span>
                </div>
              ))}

              <div style={{ marginTop: 16, padding: 14, background: '#10b98108', borderRadius: 8, border: '1px solid #10b98115', fontSize: 12, color: '#8a9ab0', lineHeight: 1.6 }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>Fine-tuning priority: </span>
                Contact recall is 78.5% — lowest of all categories. The model misses contacts on image-based staff pages. Solution: add OCR to the image pipeline to extract names from staff photos, then feed those as context to the entity extractor. This alone could push overall F1 from 84.7% to ~89%.
              </div>
            </div>
          )}

          {view === 'actions' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                <MetricCard label="Total Submissions" value={ACTION_METRICS.formSubmissions.total} color="#e8edf3" />
                <MetricCard label="Successful" value={ACTION_METRICS.formSubmissions.successful} color="#10b981" />
                <MetricCard label="Failed" value={ACTION_METRICS.formSubmissions.failed} color="#e85c5c" />
                <MetricCard label="Success Rate" value={ACTION_METRICS.formSubmissions.successRate + '%'} color="#10b981" />
              </div>

              <div style={{ fontSize: 11, color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600 }}>Success Rate by Domain</div>
              {ACTION_METRICS.byDomain.map((d, i) => (
                <div key={i} style={{ background: '#0a0d14', borderRadius: 8, border: '1px solid #1a2535', padding: 14, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e8edf3', width: 200 }}>{d.domain}</span>
                    <span style={{ fontSize: 11, color: '#06b6d4', fontFamily: "'JetBrains Mono', monospace", flex: 1 }}>{d.endpoint}</span>
                    <span style={{ fontSize: 11, color: '#4a5a6a' }}>{d.attempts} attempts</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: d.rate === 100 ? '#10b981' : d.rate > 80 ? '#f59e0b' : '#e85c5c' }}>{d.rate}%</span>
                    <span style={{ fontSize: 11, color: '#4a5a6a' }}>{d.avgMs}ms</span>
                  </div>
                  {'issue' in d && d.issue && (
                    <div style={{ fontSize: 11, color: '#e85c5c', paddingLeft: 212 }}>⚠ {d.issue}</div>
                  )}
                </div>
              ))}

              <div style={{ fontSize: 11, color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Common Failure Types</div>
              {ACTION_METRICS.commonFailures.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, marginBottom: 3, background: i % 2 === 0 ? '#0a0d14' : 'transparent' }}>
                  <span style={{ fontSize: 12, color: '#8a9ab0', flex: 1 }}>{f.type}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: f.count > 0 ? '#e85c5c' : '#10b981' }}>{f.count}</span>
                </div>
              ))}
            </div>
          )}

          {view === 'logs' && (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {['all', 'info', 'warn', 'error'].map(f => (
                  <button key={f} onClick={() => setLogFilter(f)} style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                    background: logFilter === f ? '#1a2535' : 'transparent',
                    color: logFilter === f ? '#e8edf3' : '#4a5a6a',
                  }}>{f.toUpperCase()}</button>
                ))}
              </div>

              <div style={{ background: '#060a12', borderRadius: 10, border: '1px solid #1a2535', padding: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 2, maxHeight: 400, overflow: 'auto' }}>
                {RECENT_LOGS
                  .filter(l => logFilter === 'all' || l.level === logFilter)
                  .map((log, i) => {
                    const levelColors: Record<string, string> = { info: '#10b981', warn: '#f59e0b', error: '#e85c5c' };
                    return (
                      <div key={i} style={{ borderBottom: '1px solid #0d1520', padding: '2px 0' }}>
                        <span style={{ color: '#3a4a5a' }}>{log.ts}</span>
                        <span style={{ color: levelColors[log.level], width: 40, display: 'inline-block', textAlign: 'center', marginLeft: 8 }}>[{log.level.toUpperCase()}]</span>
                        <span style={{ color: '#06b6d4', marginLeft: 8 }}>[{log.component}]</span>
                        <span style={{ color: log.level === 'error' ? '#e85c5c' : log.level === 'warn' ? '#f59e0b' : '#8a9ab0', marginLeft: 8 }}>{log.msg}</span>
                      </div>
                    );
                  })}
              </div>

              <div style={{ marginTop: 12, fontSize: 11, color: '#4a5a6a' }}>
                Logs stream in real-time via WebSocket. Filter by component or level. Full logs stored in PostgreSQL with 30-day retention for fine-tuning analysis.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
