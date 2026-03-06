import type { CrawlResult } from '@webdex/shared';

export interface DetectedFlow {
  name: string;
  steps: FlowStep[];
  requiresAuth: boolean;
  entryUrl: string;
}

export interface FlowStep {
  step: number;
  action: string;
  page?: string;
  expects?: string;
  contains?: string;
}

export function detectFlows(crawlResult: CrawlResult, url: string): DetectedFlow[] {
  const flows: DetectedFlow[] = [];

  for (const form of crawlResult.forms) {
    if (form.fields.length < 2) continue;

    const flow: DetectedFlow = {
      name: inferFlowName(form),
      entryUrl: url,
      requiresAuth: false,
      steps: [
        { step: 1, action: `fill_form`, page: url },
        { step: 2, action: `submit_form`, expects: form.action ? 'redirect' : 'inline_response' },
      ],
    };

    // Check if form action suggests a thank-you/confirmation page
    if (form.action && (form.action.includes('thank') || form.action.includes('confirm') || form.action.includes('success'))) {
      flow.steps.push({ step: 3, action: 'confirmation_page', page: form.action });
    }

    // Detect if the page has calendar/booking embeds suggesting a follow-up step
    if (crawlResult.cleanedDom.includes('calendly') || crawlResult.cleanedDom.includes('acuity') || crawlResult.cleanedDom.includes('booking')) {
      flow.steps.push({ step: flow.steps.length + 1, action: 'booking_calendar', contains: 'calendar_embed' });
    }

    flows.push(flow);
  }

  // Detect login flows
  const hasLoginForm = crawlResult.forms.some(f =>
    f.fields.some(field => field.type === 'password') || f.fields.some(field => field.name.toLowerCase().includes('password'))
  );
  if (hasLoginForm) {
    flows.push({
      name: 'login_flow',
      entryUrl: url,
      requiresAuth: true,
      steps: [
        { step: 1, action: 'fill_credentials', page: url },
        { step: 2, action: 'submit_login', expects: 'redirect_to_dashboard' },
      ],
    });
  }

  return flows;
}

function inferFlowName(form: { fields: unknown[]; submitLabel?: string; action: string }): string {
  const label = (form.submitLabel || '').toLowerCase();
  const action = (form.action || '').toLowerCase();
  if (label.includes('quote') || action.includes('quote')) return 'quote_request_flow';
  if (label.includes('book') || action.includes('book')) return 'booking_flow';
  if (label.includes('enquir') || label.includes('inquir')) return 'enquiry_flow';
  if (label.includes('subscribe') || label.includes('newsletter')) return 'subscription_flow';
  if (label.includes('contact')) return 'contact_flow';
  if (label.includes('apply') || label.includes('application')) return 'application_flow';
  return 'general_form_flow';
}
