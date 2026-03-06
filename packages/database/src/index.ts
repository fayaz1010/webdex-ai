export { getPool, query, closePool } from './client.js';
export { insertEntity, updateEntityAieoScore, searchEntities, insertPage } from './queries/entities.js';
export { createRelationship, getRelationships, findConnectedEntities } from './queries/relationships.js';
export { assembleByDomain, assembleByLocation, crossCategoryJoin } from './queries/assembly.js';
export { getIndexStats, getDomainStats, getRecentCrawls } from './queries/analytics.js';
