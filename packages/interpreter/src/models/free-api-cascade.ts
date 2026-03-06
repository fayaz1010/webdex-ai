/**
 * Free API inference cascade.
 *
 * Priority order (cost: free → paid):
 *   1. Groq  — Llama 3.3 70B, 14,400 req/day free, ~0.3s latency
 *   2. Gemini Flash — 15 RPM / 1M TPM free, good reasoning
 *   3. OpenRouter free — Llama 3.1 8B free tier, lowest quality
 *   4. Anthropic Claude — paid fallback, highest quality
 *
 * Each provider is tried in order. On rate-limit (429) or failure,
 * the next provider is used. A provider is temporarily disabled after
 * 3 consecutive failures (re-enabled after 5 minutes).
 */

interface Provider {
  name: string;
  infer: (system: string, user: string) => Promise<string>;
  failureCount: number;
  disabledUntil: number;
}

const providers: Provider[] = [];

// ── Groq ─────────────────────────────────────────────────────────────────────
async function groqInfer(system: string, user: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json() as any;
  return data.choices[0]?.message?.content || '';
}

// ── Google Gemini Flash ───────────────────────────────────────────────────────
async function geminiInfer(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── OpenRouter (free tier) ────────────────────────────────────────────────────
async function openrouterInfer(system: string, user: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://webdex.ai',
      'X-Title': 'WebDex AI Indexer',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

// ── Anthropic Claude (paid fallback) ─────────────────────────────────────────
async function claudeInfer(system: string, user: string): Promise<string> {
  const key = process.env.ESCALATION_API_KEY;
  if (!key) throw new Error('ESCALATION_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ESCALATION_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json() as any;
  return data.content?.find((b: any) => b.type === 'text')?.text || '';
}

// ── Register providers ────────────────────────────────────────────────────────
function register(name: string, infer: (s: string, u: string) => Promise<string>) {
  providers.push({ name, infer, failureCount: 0, disabledUntil: 0 });
}

register('groq', groqInfer);
register('gemini', geminiInfer);
register('openrouter', openrouterInfer);
register('claude', claudeInfer);

const DISABLE_AFTER_FAILURES = 3;
const DISABLE_DURATION_MS = 5 * 60 * 1000;

/**
 * Try each provider in order. Skip disabled ones.
 * On failure, increment failure count; on success, reset it.
 */
export async function cascadeInfer(system: string, user: string): Promise<string> {
  const now = Date.now();
  const errors: string[] = [];

  for (const provider of providers) {
    // Skip if temporarily disabled
    if (provider.disabledUntil > now) {
      errors.push(`${provider.name}: disabled until ${new Date(provider.disabledUntil).toISOString()}`);
      continue;
    }

    try {
      const result = await provider.infer(system, user);
      if (result) {
        provider.failureCount = 0; // reset on success
        return result;
      }
    } catch (err) {
      const msg = String(err);
      errors.push(`${provider.name}: ${msg.slice(0, 80)}`);
      provider.failureCount++;

      if (provider.failureCount >= DISABLE_AFTER_FAILURES) {
        provider.disabledUntil = now + DISABLE_DURATION_MS;
        console.warn(`[cascade] ${provider.name} disabled for 5min after ${DISABLE_AFTER_FAILURES} failures`);
      }

      if (msg.includes('not set')) continue; // API key missing — skip silently
      console.warn(`[cascade] ${provider.name} failed: ${msg.slice(0, 100)}`);
    }
  }

  throw new Error(`All inference providers failed:\n${errors.join('\n')}`);
}

export function getProviderStatus() {
  const now = Date.now();
  return providers.map(p => ({
    name: p.name,
    failureCount: p.failureCount,
    available: p.disabledUntil <= now,
    disabledUntil: p.disabledUntil > now ? new Date(p.disabledUntil).toISOString() : null,
  }));
}
