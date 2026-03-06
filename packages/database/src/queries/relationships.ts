import { query } from '../client.js';

export async function createRelationship(fromId: string, toId: string, type: string, meta?: Record<string, unknown>) {
  const result = await query(
    'INSERT INTO relationships (from_entity_id, to_entity_id, relationship_type, meta) VALUES ($1, $2, $3, $4) RETURNING id',
    [fromId, toId, type, JSON.stringify(meta || {})]
  );
  return result.rows[0].id;
}

export async function getRelationships(entityId: string) {
  return (await query(
    `SELECT r.*, e.category, e.data, e.domain
     FROM relationships r
     JOIN entities e ON (CASE WHEN r.from_entity_id = $1 THEN r.to_entity_id ELSE r.from_entity_id END) = e.id
     WHERE r.from_entity_id = $1 OR r.to_entity_id = $1`,
    [entityId]
  )).rows;
}

export async function findConnectedEntities(entityId: string, relationshipType: string) {
  return (await query(
    `SELECT e.* FROM relationships r
     JOIN entities e ON r.to_entity_id = e.id
     WHERE r.from_entity_id = $1 AND r.relationship_type = $2`,
    [entityId, relationshipType]
  )).rows;
}
