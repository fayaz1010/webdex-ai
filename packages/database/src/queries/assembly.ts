import { query } from '../client.js';

export async function assembleByDomain(domain: string, categories?: string[]) {
  const conditions = ['domain = $1'];
  const values: unknown[] = [domain];
  if (categories?.length) { conditions.push('category = ANY($2)'); values.push(categories); }
  const where = conditions.join(' AND ');
  const result = await query(`SELECT * FROM entities WHERE ${where} ORDER BY category, aieo_score DESC`, values);

  const grouped: Record<string, unknown[]> = {};
  for (const row of result.rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }
  return grouped;
}

export async function assembleByLocation(location: string, categories?: string[], limit = 100) {
  const conditions = ["searchable_text ILIKE $1"];
  const values: unknown[] = [`%${location}%`];
  if (categories?.length) { conditions.push('category = ANY($2)'); values.push(categories); }
  return (await query(
    `SELECT * FROM entities WHERE ${conditions.join(' AND ')} ORDER BY aieo_score DESC LIMIT ${limit}`,
    values
  )).rows;
}

export async function crossCategoryJoin(primaryCategory: string, secondaryCategory: string, domain?: string) {
  const domainFilter = domain ? 'AND e1.domain = $3' : '';
  const values: unknown[] = [primaryCategory, secondaryCategory];
  if (domain) values.push(domain);

  return (await query(
    `SELECT e1.id as primary_id, e1.data as primary_data, e1.domain,
            e2.id as secondary_id, e2.data as secondary_data, e2.category as secondary_category
     FROM entities e1
     JOIN relationships r ON r.from_entity_id = e1.id
     JOIN entities e2 ON r.to_entity_id = e2.id AND e2.category = $2
     WHERE e1.category = $1 ${domainFilter}
     ORDER BY e1.aieo_score DESC
     LIMIT 200`,
    values
  )).rows;
}
