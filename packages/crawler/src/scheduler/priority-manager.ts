export function calculatePriority(params: {
  source: string;
  isPersonal?: boolean;
  domainAuthority?: number;
  isRecrawl?: boolean;
  hasFormsLastCrawl?: boolean;
}): number {
  let priority = 5;

  if (params.isPersonal) priority = 1;
  else if (params.source === 'on-demand') priority = 2;
  else if (params.source === 'seed') priority = 3;
  else if (params.isRecrawl && params.hasFormsLastCrawl) priority = 4;
  else if (params.source === 'discovered') priority = 6;
  else if (params.isRecrawl) priority = 7;

  if (params.domainAuthority && params.domainAuthority > 50) priority = Math.max(1, priority - 1);

  return Math.min(10, Math.max(1, priority));
}
