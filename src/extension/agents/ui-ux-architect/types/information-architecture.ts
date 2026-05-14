/**
 * Information Architecture Type Definitions
 * Task 1.8: Create information architecture type definitions
 * Requirements: 2.1, 2.2, 2.3
 */

/** Individual navigation item */
export interface NavigationItem {
  /** Display label */
  label: string;
  /** Route/path */
  path?: string;
  /** Icon identifier (if applicable) */
  icon?: string;
  /** Child items (for nested navigation) */
  children?: NavigationItem[];
  /** Whether this item is visible */
  visible: boolean;
  /** Required roles to see this item */
  requiredRoles?: string[];
}

/** Navigation structure definition */
export interface NavigationStructure {
  /** Primary navigation items */
  primary: NavigationItem[];
  /** Secondary navigation items */
  secondary?: NavigationItem[];
  /** Breadcrumb configuration */
  breadcrumbs?: BreadcrumbConfig;
  /** Footer links */
  footer?: NavigationItem[];
}

/** Breadcrumb configuration */
export interface BreadcrumbConfig {
  /** Show home link */
  showHome: boolean;
  /** Home label */
  homeLabel: string;
  /** Separator character */
  separator: string;
}

/** Individual sitemap node */
export interface SitemapNode {
  /** Page identifier */
  id: string;
  /** Page title */
  title: string;
  /** Page route */
  path: string;
  /** Page description */
  description: string;
  /** Parent page ID (null for root) */
  parentId: string | null;
  /** Child pages */
  children: SitemapNode[];
  /** Page metadata */
  meta?: {
    requiresAuth?: boolean;
    layout?: string;
  };
}

/** Individual step in a user flow */
export interface FlowStep {
  /** Step identifier */
  id: string;
  /** Step name */
  name: string;
  /** Step description */
  description: string;
  /** Screen/page for this step */
  screen: string;
  /** Possible next steps */
  nextSteps: string[];
  /** Step type */
  type: 'input' | 'decision' | 'action' | 'confirmation' | 'end';
}

/** User flow definition */
export interface UserFlow {
  /** Flow identifier */
  id: string;
  /** Flow name */
  name: string;
  /** Flow description */
  description: string;
  /** Starting step ID */
  startStep: string;
  /** All steps in the flow */
  steps: FlowStep[];
}

/** Labeling system for consistent terminology */
export interface LabelingSystem {
  /** Term definitions */
  terms: Record<string, {
    /** Preferred label */
    preferred: string;
    /** Alternative labels */
    alternatives: string[];
    /** When to use this term */
    usage: string;
    /** When NOT to use this term */
    avoid: string;
  }>;
}

/** Complete information architecture */
export interface InformationArchitecture {
  /** IA name/version */
  name: string;
  version: string;
  /** Sitemap */
  sitemap: SitemapNode[];
  /** Navigation structure */
  navigation: NavigationStructure;
  /** Key user flows */
  userFlows: UserFlow[];
  /** Labeling system */
  labeling: LabelingSystem;
}
