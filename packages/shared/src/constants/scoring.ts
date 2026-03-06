export const AIEO_WEIGHTS = {
  action_richness: 0.30,
  semantic_clarity: 0.25,
  agent_reliability: 0.20,
  freshness_coverage: 0.15,
  trust_legitimacy: 0.10,
} as const;

export const ACTION_RICHNESS_SIGNALS = {
  form_completeness: 0.30,
  api_discoverability: 0.25,
  action_diversity: 0.20,
  flow_completeness: 0.15,
  reliability_history: 0.10,
} as const;

export const KNOWLEDGE_WEIGHTS = {
  information_density: 0.25,
  structure_quality: 0.25,
  entity_richness: 0.20,
  authority_citations: 0.15,
  extraction_ease: 0.15,
} as const;

export const INTENT_BLEND_DEFAULTS: Record<string, { knowledge: number; action: number }> = {
  knowledge: { knowledge: 0.90, action: 0.10 },
  action: { knowledge: 0.05, action: 0.95 },
  research: { knowledge: 0.65, action: 0.35 },
  compound: { knowledge: 0.40, action: 0.60 },
  navigation: { knowledge: 0.50, action: 0.50 },
};

export const RECRAWL_INTERVALS: Record<string, number> = {
  hourly: 3600000,
  daily: 86400000,
  weekly: 604800000,
  monthly: 2592000000,
};
