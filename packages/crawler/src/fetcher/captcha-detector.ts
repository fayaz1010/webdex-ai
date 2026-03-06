/**
 * CAPTCHA and bot-challenge detection.
 * Identifies the type of challenge and attempts resolution where possible.
 */

export type CaptchaType =
  | 'cloudflare_challenge'   // CF "Just a moment..." JS challenge (often auto-resolves in Playwright)
  | 'cloudflare_turnstile'   // CF Turnstile widget
  | 'recaptcha_v2'
  | 'recaptcha_v3'
  | 'hcaptcha'
  | 'arkose_labs'            // FunCaptcha
  | 'imperva_incapsula'
  | 'datadome'
  | 'perimeterx'
  | 'akamai_bot_manager'
  | 'generic_captcha'
  | 'none';

export interface CaptchaDetectionResult {
  detected: boolean;
  type: CaptchaType;
  autoResolvable: boolean;    // true = Playwright wait may bypass it
  needsService: boolean;      // true = needs 2captcha/CapSolver
  confidence: number;
  indicators: string[];
}

const PATTERNS: Array<{ pattern: RegExp | string; type: CaptchaType; autoResolvable: boolean; needsService: boolean }> = [
  // Cloudflare JS challenge — usually auto-resolves with Playwright wait
  { pattern: /just a moment/i,                       type: 'cloudflare_challenge',  autoResolvable: true,  needsService: false },
  { pattern: /cf-browser-verification/,              type: 'cloudflare_challenge',  autoResolvable: true,  needsService: false },
  { pattern: /cf_chl_opt/,                           type: 'cloudflare_challenge',  autoResolvable: true,  needsService: false },
  { pattern: /cloudflare ray id/i,                   type: 'cloudflare_challenge',  autoResolvable: true,  needsService: false },
  // Cloudflare Turnstile
  { pattern: /turnstile\.cloudflare\.com/,           type: 'cloudflare_turnstile',  autoResolvable: false, needsService: true  },
  // reCAPTCHA
  { pattern: /google\.com\/recaptcha/,               type: 'recaptcha_v2',          autoResolvable: false, needsService: true  },
  { pattern: /recaptcha\/api2/,                      type: 'recaptcha_v2',          autoResolvable: false, needsService: true  },
  { pattern: /grecaptcha\.execute/,                  type: 'recaptcha_v3',          autoResolvable: false, needsService: false }, // v3 is invisible
  // hCaptcha
  { pattern: /hcaptcha\.com/,                        type: 'hcaptcha',              autoResolvable: false, needsService: true  },
  { pattern: /data-hcaptcha-sitekey/,                type: 'hcaptcha',              autoResolvable: false, needsService: true  },
  // Arkose Labs / FunCaptcha
  { pattern: /arkoselabs\.com/,                      type: 'arkose_labs',           autoResolvable: false, needsService: true  },
  { pattern: /funcaptcha/i,                          type: 'arkose_labs',           autoResolvable: false, needsService: true  },
  // Imperva
  { pattern: /incapsula\.com/,                       type: 'imperva_incapsula',     autoResolvable: false, needsService: false },
  { pattern: /_Incapsula_Resource/,                  type: 'imperva_incapsula',     autoResolvable: false, needsService: false },
  // DataDome
  { pattern: /datadome\.co/,                         type: 'datadome',              autoResolvable: false, needsService: false },
  { pattern: /dd_cookie_test/,                       type: 'datadome',              autoResolvable: false, needsService: false },
  // PerimeterX
  { pattern: /perimeterx\.net/,                      type: 'perimeterx',            autoResolvable: false, needsService: false },
  { pattern: /_pxAppId/,                             type: 'perimeterx',            autoResolvable: false, needsService: false },
  // Akamai
  { pattern: /ak_bmsc/,                              type: 'akamai_bot_manager',    autoResolvable: false, needsService: false },
  { pattern: /bm_sz/,                                type: 'akamai_bot_manager',    autoResolvable: false, needsService: false },
];

export function detectCaptcha(html: string, pageTitle?: string): CaptchaDetectionResult {
  const content = html + (pageTitle || '');
  const indicators: string[] = [];
  let detected = false;
  let type: CaptchaType = 'none';
  let autoResolvable = false;
  let needsService = false;
  let matchCount = 0;

  for (const { pattern, type: t, autoResolvable: ar, needsService: ns } of PATTERNS) {
    const matched = typeof pattern === 'string'
      ? content.includes(pattern)
      : pattern.test(content);

    if (matched) {
      matchCount++;
      indicators.push(typeof pattern === 'string' ? pattern : pattern.source);
      if (!detected) {
        detected = true;
        type = t;
        autoResolvable = ar;
        needsService = ns;
      }
    }
  }

  // Generic CAPTCHA fallback
  if (!detected && (/captcha/i.test(content) || /bot.?check/i.test(content) || /human.?verification/i.test(content))) {
    detected = true;
    type = 'generic_captcha';
    needsService = true;
    indicators.push('generic captcha keyword');
    matchCount = 1;
  }

  return {
    detected,
    type,
    autoResolvable,
    needsService,
    confidence: Math.min(matchCount / 2, 1),
    indicators,
  };
}

/**
 * Attempt to bypass a Cloudflare JS challenge by waiting for it to auto-resolve.
 * Playwright usually passes CF bot checks when waiting for networkidle.
 * Returns true if bypass was successful.
 */
export async function attemptCloudflareBypass(
  page: import('playwright').Page,
  url: string,
  maxWaitMs = 15_000
): Promise<boolean> {
  try {
    // Wait for the challenge to complete (CF JS challenges run and redirect)
    await page.waitForFunction(
      () => !document.title.toLowerCase().includes('just a moment'),
      { timeout: maxWaitMs }
    );
    // Additional wait for the real page to settle
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    const html = await page.content();
    const check = detectCaptcha(html, await page.title());
    return !check.detected || check.type !== 'cloudflare_challenge';
  } catch {
    return false;
  }
}

/**
 * Optionally solve CAPTCHAs using 2captcha service.
 * Requires CAPTCHA_API_KEY env var (2captcha or CapSolver use same API format).
 */
export async function solveCaptchaViaService(
  siteKey: string,
  pageUrl: string,
  type: 'recaptcha_v2' | 'hcaptcha' = 'recaptcha_v2'
): Promise<string | null> {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.CAPTCHA_SERVICE_URL || 'https://2captcha.com';

  try {
    // Submit CAPTCHA task
    const submitRes = await fetch(`${baseUrl}/in.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: apiKey,
        method: type === 'hcaptcha' ? 'hcaptcha' : 'userrecaptcha',
        googlekey: siteKey,
        pageurl: pageUrl,
        json: '1',
      }).toString(),
    });
    const submitData = await submitRes.json() as any;
    if (submitData.status !== 1) return null;

    const taskId = submitData.request;
    // Poll for result (CAPTCHA solving takes 15-60s)
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const resultRes = await fetch(`${baseUrl}/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`);
      const resultData = await resultRes.json() as any;
      if (resultData.status === 1) return resultData.request;
      if (resultData.request !== 'CAPCHA_NOT_READY') return null;
    }
  } catch {}

  return null;
}
