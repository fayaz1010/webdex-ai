export type EntityCategory =
  | 'contact'
  | 'organisation'
  | 'product'
  | 'action'
  | 'location'
  | 'event'
  | 'review'
  | 'regulation';

export interface BaseEntity {
  id?: string;
  category: EntityCategory;
  subcategory?: string;
  data: Record<string, unknown>;
  domain: string;
  pageId?: string;
  confidence: number;
  aieoScore?: number;
  embedding?: number[];
  searchableText: string;
  isVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContactEntity extends BaseEntity {
  category: 'contact';
  data: {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    department?: string;
    seniority?: 'junior' | 'mid' | 'senior' | 'manager' | 'director' | 'executive';
  };
}

export interface OrganisationEntity extends BaseEntity {
  category: 'organisation';
  data: {
    name: string;
    type?: string;
    industry?: string;
    address?: string;
    phone?: string;
    website?: string;
    abn?: string;
    accreditations?: string[];
    employees?: string;
    operatingHours?: Record<string, string>;
    serviceArea?: string[];
  };
}

export interface ProductEntity extends BaseEntity {
  category: 'product';
  data: {
    name: string;
    provider?: string;
    productType?: string;
    price?: { amount: number; currency: string; qualifier?: string };
    specs?: Record<string, string>;
    warranty?: Record<string, string>;
    rating?: { score: number; count: number };
    availability?: string;
    finance?: { available: boolean; amount?: number; period?: string };
  };
}

export interface ActionEntity extends BaseEntity {
  category: 'action';
  data: {
    type: 'form_submit' | 'phone_link' | 'chat_widget' | 'booking' | 'calculator' | 'callback';
    purpose: string;
    endpoint?: string;
    method?: string;
    contentType?: string;
    fields?: FormField[];
    hiddenFields?: Record<string, string>;
    submitLabel?: string;
    successRate?: number;
    responseHandling?: { success: string; error: string };
  };
}

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  label?: string;
  validation?: string;
  options?: string[];
}

export interface LocationEntity extends BaseEntity {
  category: 'location';
  data: {
    address: string;
    suburb?: string;
    postcode?: string;
    state?: string;
    country?: string;
    lat?: number;
    lng?: number;
    locationType?: string;
    name?: string;
  };
}

export interface EventEntity extends BaseEntity {
  category: 'event';
  data: {
    name: string;
    date?: string;
    time?: string;
    type?: string;
    registrationUrl?: string;
    deadline?: string;
    audience?: string[];
  };
}

export interface ReviewEntity extends BaseEntity {
  category: 'review';
  data: {
    subject: string;
    sources: Array<{ platform: string; rating: number; count: number }>;
    overallRating?: number;
    totalReviews?: number;
    sentiment?: { positive: string[]; negative: string[]; trending?: string };
  };
}

export type Entity =
  | ContactEntity
  | OrganisationEntity
  | ProductEntity
  | ActionEntity
  | LocationEntity
  | EventEntity
  | ReviewEntity
  | BaseEntity;
