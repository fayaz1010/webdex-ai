export interface SearchRequest {
  q: string;
  category?: string;
  domain?: string;
  location?: string;
  semantic?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  query: string;
  filters: Record<string, string | undefined>;
  total: number;
  latency_ms: number;
  results: EntityResult[];
}

export interface EntityResult {
  id: string;
  category: string;
  subcategory?: string;
  data: Record<string, unknown>;
  domain: string;
  confidence: number;
  aieo_score: number;
  vector_similarity?: number;
  created_at: string;
}

export interface AssembleRequest {
  categories?: string[];
  domain?: string;
  location?: string;
  include_relationships?: boolean;
  limit?: number;
}

export interface ExecuteActionRequest {
  action_id: string;
  data: Record<string, string>;
}

export interface ExecuteActionResponse {
  success: boolean;
  status: number;
  action_id: string;
  endpoint: string;
  message?: string;
  error?: string;
}

export interface CrawlRequest {
  url: string;
  priority?: number;
  deep?: boolean;
}

export interface PersonalIndexRequest {
  urls: string[];
  user_id: string;
  tier: 'basic' | 'pro';
}

export interface PersonalIndexStatus {
  user_id: string;
  total_urls: number;
  crawled: number;
  entities_extracted: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
}
