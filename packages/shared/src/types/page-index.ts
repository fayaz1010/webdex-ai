export interface PageIndex {
  id?: string;
  url: string;
  domain: string;
  contentHash?: string;
  pageType?: string;
  pageTypeConfidence?: number;
  httpStatus?: number;
  lastCrawled?: Date;
  lastChanged?: Date;
  crawlFrequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  version?: number;
  requiresJs?: boolean;
  cmsDetected?: string;
  meta?: Record<string, unknown>;
}
