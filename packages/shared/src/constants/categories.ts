import type { EntityCategory } from '../types/entities.js';

export interface CategoryDefinition {
  id: EntityCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const ENTITY_CATEGORIES: CategoryDefinition[] = [
  { id: 'contact', name: 'Contacts', description: 'Named people with roles and contact methods', icon: '👤', color: '#8b5cf6' },
  { id: 'organisation', name: 'Organisations', description: 'Businesses, institutions, government bodies', icon: '🏢', color: '#10b981' },
  { id: 'product', name: 'Products & Services', description: 'Offerings with pricing and specifications', icon: '📦', color: '#f59e0b' },
  { id: 'action', name: 'Actions', description: 'Forms, APIs, booking systems, interactive elements', icon: '⚡', color: '#06b6d4' },
  { id: 'location', name: 'Locations', description: 'Physical locations with addresses and coordinates', icon: '📍', color: '#ec4899' },
  { id: 'event', name: 'Events & Dates', description: 'Time-bound entities and deadlines', icon: '📅', color: '#f97316' },
  { id: 'review', name: 'Reviews & Sentiment', description: 'Aggregated ratings and review data', icon: '⭐', color: '#eab308' },
  { id: 'regulation', name: 'Regulations', description: 'Legal requirements and compliance rules', icon: '📜', color: '#64748b' },
];
