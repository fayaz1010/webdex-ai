export interface CrawlJob {
  id?: string;
  url: string;
  domain: string;
  priority: number;
  source: 'seed' | 'discovered' | 're-crawl' | 'on-demand';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  scheduledFor?: Date;
  error?: string;
}

export interface CrawlResult {
  url: string;
  status: number;
  html: string;
  htmlSizeBytes: number;
  domNodes: number;
  accessibilityTreeNodes: number;
  networkRequestsCaptured: number;
  loadTimeMs: number;
  requiresJs: boolean;
  headers: Record<string, string>;
  forms: ExtractedForm[];
  links: ExtractedLink[];
  images: ExtractedImage[];
  videos: ExtractedVideo[];
  apiEndpoints: DiscoveredApi[];
  cleanedDom: string;
  accessibilityTree: string;
}

export interface ExtractedForm {
  action: string;
  method: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    label?: string;
    placeholder?: string;
    options?: string[];
    pattern?: string;
  }>;
  submitLabel?: string;
  encoding?: string;
}

export interface ExtractedLink {
  href: string;
  text: string;
  location: 'nav' | 'body' | 'footer' | 'sidebar';
  isExternal: boolean;
  rel?: string;
}

export interface ExtractedImage {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
  context?: string;
}

export interface ExtractedVideo {
  platform: 'youtube' | 'vimeo' | 'wistia' | 'self_hosted' | 'unknown';
  videoId?: string;
  src: string;
  title?: string;
  duration?: string;
  thumbnailUrl?: string;
}

export interface DiscoveredApi {
  url: string;
  method: string;
  discoveredVia: 'form_action' | 'xhr_intercept' | 'link_analysis';
  contentType?: string;
  params?: string[];
}
