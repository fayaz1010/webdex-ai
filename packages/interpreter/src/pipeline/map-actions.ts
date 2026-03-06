import type { ActionEntity } from '@webdex/shared';

export interface ActionMap {
  url: string;
  domain: string;
  actions: ActionEntity[];
  primaryAction: ActionEntity | null;
  hasContactForm: boolean;
  hasQuoteForm: boolean;
  hasBooking: boolean;
  hasLiveChat: boolean;
  hasPhone: boolean;
  hasCalculator: boolean;
  totalActions: number;
}

export function mapActions(url: string, domain: string, entities: ActionEntity[]): ActionMap {
  const actions = entities.filter(e => e.category === 'action');

  const hasContactForm = actions.some(a =>
    a.data.type === 'form_submit' &&
    /contact|enquir|message|feedback/i.test(a.data.purpose)
  );

  const hasQuoteForm = actions.some(a =>
    a.data.type === 'form_submit' &&
    /quote|estimate|proposal|price|cost/i.test(a.data.purpose)
  );

  const hasBooking = actions.some(a => a.data.type === 'booking');
  const hasLiveChat = actions.some(a => a.data.type === 'chat_widget');
  const hasPhone = actions.some(a => a.data.type === 'phone_link');
  const hasCalculator = actions.some(a => a.data.type === 'calculator');

  // Rank primary action: quote > contact > booking > phone > chat > calculator
  const rankOrder: ActionEntity['data']['type'][] = [
    'form_submit', 'booking', 'phone_link', 'chat_widget', 'calculator', 'callback',
  ];

  const primaryAction = actions
    .filter(a => a.data.endpoint || a.data.type !== 'form_submit')
    .sort((a, b) => {
      const aRank = rankOrder.indexOf(a.data.type);
      const bRank = rankOrder.indexOf(b.data.type);
      const rankDiff = aRank - bRank;
      if (rankDiff !== 0) return rankDiff;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    })[0] ?? null;

  return {
    url,
    domain,
    actions,
    primaryAction,
    hasContactForm,
    hasQuoteForm,
    hasBooking,
    hasLiveChat,
    hasPhone,
    hasCalculator,
    totalActions: actions.length,
  };
}
