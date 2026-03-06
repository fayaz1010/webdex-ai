import type { Entity } from '@webdex/shared';

export interface AieoScore {
  total: number;
  actionRichness: number;
  semanticClarity: number;
  breakdown: Record<string, number>;
}

export function calculateAieoScore(entities: Entity[], pageTypeConfidence: number): AieoScore {
  const actions = entities.filter(e => e.category === 'action');
  const contacts = entities.filter(e => e.category === 'contact');
  const products = entities.filter(e => e.category === 'product');

  // Action Richness (30%)
  const formScore = Math.min(actions.filter(a => (a.data as any).type === 'form_submit').length, 3) / 3 * 25;
  const actionDiversity = new Set(actions.map(a => (a.data as any).type)).size;
  const diversityScore = Math.min(actionDiversity, 5) / 5 * 25;
  const fieldCompleteness = actions.reduce((sum, a) => {
    const fields = (a.data as any).fields || [];
    return sum + (fields.length > 0 ? 1 : 0);
  }, 0) / Math.max(actions.length, 1) * 25;
  const endpointMapped = actions.filter(a => (a.data as any).endpoint).length / Math.max(actions.length, 1) * 25;
  const actionRichness = (formScore + diversityScore + fieldCompleteness + endpointMapped) * 0.30;

  // Semantic Clarity (25%)
  const confidenceScore = pageTypeConfidence * 25;
  const entityRichness = Math.min(entities.length, 15) / 15 * 25;
  const hasContacts = contacts.length > 0 ? 25 : 0;
  const hasProducts = products.length > 0 ? 25 : 0;
  const semanticClarity = (confidenceScore + entityRichness + hasContacts + hasProducts) * 0.25;

  // Freshness placeholder (15%)
  const freshness = 80 * 0.15; // Assume fresh for now

  // Trust placeholder (10%)
  const trust = 60 * 0.10;

  const total = actionRichness + semanticClarity + freshness + trust;

  return {
    total: Math.round(total * 10) / 10,
    actionRichness: Math.round(actionRichness * 10) / 10,
    semanticClarity: Math.round(semanticClarity * 10) / 10,
    breakdown: { formScore, diversityScore, fieldCompleteness, endpointMapped, confidenceScore, entityRichness },
  };
}
