import { query } from '../client.js';

export async function getIndexStats() {
  const [entities, pages, domains, categories] = await Promise.all([
    query('SELECT COUNT(*) as count FROM entities'),
    query('SELECT COUNT(*) as count FROM pages'),
    query('SELECT COUNT(DISTINCT domain) as count FROM entities'),
    query('SELECT category, COUNT(*) as count FROM entities GROUP BY category ORDER BY count DESC'),
  ]);

  return {
    totalEntities: parseInt(entities.rows[0].count),
    totalPages: parseInt(pages.rows[0].count),
    totalDomains: parseInt(domains.rows[0].count),
    entitiesByCategory: categories.rows,
  };
}

export async function getDomainStats(domain: string) {
  const [entities, pages, actions] = await Promise.all([
    query('SELECT category, COUNT(*) as count FROM entities WHERE domain = $1 GROUP BY category', [domain]),
    query('SELECT COUNT(*) as count, MAX(last_crawled) as last_crawled FROM pages WHERE domain = $1', [domain]),
    query("SELECT COUNT(*) as count FROM entities WHERE domain = $1 AND category = 'action'", [domain]),
  ]);

  return {
    domain,
    entities: entities.rows,
    pages: parseInt(pages.rows[0].count),
    lastCrawled: pages.rows[0].last_crawled,
    actionCount: parseInt(actions.rows[0].count),
  };
}

export async function getRecentCrawls(limit = 20) {
  return (await query(
    'SELECT url, domain, page_type, http_status, last_crawled, version FROM pages ORDER BY last_crawled DESC LIMIT $1',
    [limit]
  )).rows;
}
