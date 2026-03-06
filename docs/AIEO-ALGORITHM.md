# AIEO (AI Engine Optimisation) Algorithm

## Ranking Formula
`final_score = (action_score × action_weight) + (knowledge_score × knowledge_weight)`

Weights are set dynamically by query intent classification.

## Action Score (30% default weight)
- Form completeness: fields mapped / fields detected
- API discoverability: endpoints found via XHR intercept
- Action diversity: unique action types count
- Flow completeness: multi-step processes fully mapped
- Reliability history: form submission success rate over time

## Knowledge Score (25% default weight)
- Information density: facts per paragraph
- Structure quality: clean headings, semantic HTML
- Entity richness: extractable named entities, prices, dates
- Authority/citations: primary source, cited claims
- Extraction ease: how cleanly structured facts can be pulled

## Agent Reliability (20%)
- Form submission success rate
- Endpoint stability (days since last breaking change)
- Response predictability (schema consistency)
- Rate limit tolerance

## Freshness & Coverage (15%)
- Hours since last crawl
- Content hash stability
- Domain coverage depth

## Trust & Legitimacy (10%)
- SSL/HTTPS (mandatory for forms)
- Known CMS/framework
- Bot policy compliance
- Cross-reference validation (ABN, CEC, CRICOS)
