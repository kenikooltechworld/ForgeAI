/**
 * UI/UX Architect Agent RAG Configuration
 * Task 1.11: Reuses existing RAG infrastructure from src/extension/rag/
 * Requirements: 11.1, 11.2, 18.5
 *
 * NOTE: This does NOT duplicate the RAG system. It only defines:
 * - Which collections the UI/UX agent needs
 * - Chunk strategies for design documents
 * - Re-exports the existing RAG types for convenience
 */

import type { DocSourceId, CleanedChunk, RagRetrievedContext } from '../../../rag/types';

// Re-export existing RAG types for UI/UX agent convenience
export type { DocSourceId, CleanedChunk, RagRetrievedContext };

/** Collections the UI/UX agent queries for design knowledge */
export const UIUX_RAG_COLLECTIONS: DocSourceId[] = [
  'material-design-3',
  'apple-hig',
  'wcag-guidelines',
  'tailwind-docs',
  'design-patterns',
  'animation-patterns',
];

/** Chunk strategy per document type */
export type UIUXChunkStrategy = 'semantic' | 'section-based' | 'fixed-size';

/** Document type to chunk strategy mapping */
export const UIUX_CHUNK_STRATEGIES: Record<string, UIUXChunkStrategy> = {
  guidelines: 'section-based', // WCAG, HIG — structured sections
  'api-reference': 'semantic', // Component APIs — semantic boundaries
  patterns: 'semantic', // Design patterns — conceptual boundaries
  examples: 'fixed-size', // Code examples — fixed character chunks
};

/** Configuration for seeding a design knowledge collection */
export interface UIUXCollectionSeedConfig {
  sourceId: DocSourceId;
  /** Human-readable name */
  name: string;
  /** Description of what this collection contains */
  description: string;
  /** Base URLs to scrape */
  seedUrls: string[];
  /** Preferred chunk strategy */
  chunkStrategy: UIUXChunkStrategy;
  /** Max chunk size in characters */
  maxChunkSize: number;
  /** Chunk overlap in characters */
  chunkOverlap: number;
}

/** Seeding configurations for all UI/UX knowledge collections */
export const UIUX_COLLECTION_SEEDS: UIUXCollectionSeedConfig[] = [
  {
    sourceId: 'material-design-3',
    name: 'Material Design 3',
    description: 'Google Material Design 3 guidelines, components, and tokens',
    seedUrls: ['https://m3.material.io/'],
    chunkStrategy: 'section-based',
    maxChunkSize: 2000,
    chunkOverlap: 200,
  },
  {
    sourceId: 'apple-hig',
    name: 'Apple Human Interface Guidelines',
    description: 'Apple HIG for iOS, macOS, and visionOS design patterns',
    seedUrls: ['https://developer.apple.com/design/human-interface-guidelines/'],
    chunkStrategy: 'section-based',
    maxChunkSize: 2000,
    chunkOverlap: 200,
  },
  {
    sourceId: 'wcag-guidelines',
    name: 'WCAG 2.1 Guidelines',
    description: 'Web Content Accessibility Guidelines 2.1',
    seedUrls: ['https://www.w3.org/WAI/WCAG21/Understanding/'],
    chunkStrategy: 'section-based',
    maxChunkSize: 3000,
    chunkOverlap: 300,
  },
  {
    sourceId: 'tailwind-docs',
    name: 'Tailwind CSS Documentation',
    description: 'Tailwind CSS utility classes, theming, and customization',
    seedUrls: ['https://tailwindcss.com/docs/'],
    chunkStrategy: 'section-based',
    maxChunkSize: 1500,
    chunkOverlap: 150,
  },
  {
    sourceId: 'design-patterns',
    name: 'Design Patterns Catalog',
    description: 'Common UI/UX design patterns and anti-patterns',
    seedUrls: [],
    chunkStrategy: 'semantic',
    maxChunkSize: 2500,
    chunkOverlap: 250,
  },
  {
    sourceId: 'animation-patterns',
    name: 'Animation Patterns',
    description: 'Motion design principles and micro-interaction patterns',
    seedUrls: [],
    chunkStrategy: 'semantic',
    maxChunkSize: 2000,
    chunkOverlap: 200,
  },
];
