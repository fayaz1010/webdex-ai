export const PAGE_TYPES = [
  // Core business pages
  'homepage',
  'about_page',
  'contact_page',
  'staff_directory',
  'legal_page',

  // Products & services
  'product_landing',
  'product_listing',
  'product_catalog',
  'pricing_page',
  'business_service_landing',
  'business_service_hub',

  // Content
  'blog_article',
  'news_article',
  'encyclopedia_article',
  'case_study',
  'faq_page',
  'resource_hub',
  'review_page',
  'discussion_thread',

  // Action pages
  'booking_page',
  'calculator_page',
  'checkout_page',
  'login_page',
  'search_results',
  'category_page',

  // Specialised
  'government_regulation',
  'government_directory',
  'event_page',
  'social_profile',
  'course_listing',

  'unknown',
] as const;

export type PageType = (typeof PAGE_TYPES)[number];
