/**
 * Component Library Type Definitions
 * Task 1.5: Create component library type definitions
 * Requirements: 3.1, 3.5, 5.1
 */

/** Individual prop definition for a component */
export interface PropDefinition {
  /** Prop name (camelCase) */
  name: string;
  /** Type annotation */
  type: string;
  /** Whether the prop is required */
  required: boolean;
  /** Default value (if any) */
  defaultValue?: string;
  /** Description for documentation */
  description: string;
}

/** Component variant (e.g., button variants: solid, outline, ghost) */
export interface ComponentVariant {
  /** Variant identifier */
  name: string;
  /** Display label */
  label: string;
  /** Token overrides for this variant */
  tokenOverrides?: Record<string, string>;
  /** Description */
  description: string;
}

/** Component state (e.g., hover, focus, disabled) */
export interface ComponentState {
  /** State identifier */
  name: string;
  /** Display label */
  label: string;
  /** CSS selector or pseudo-class */
  selector: string;
  /** Token overrides for this state */
  tokenOverrides?: Record<string, string>;
  /** Whether this state requires ARIA attributes */
  requiresAria?: boolean;
}

/** Example/demo configuration for a component */
export interface ComponentExample {
  /** Example name */
  name: string;
  /** Description of what this example demonstrates */
  description: string;
  /** Props to set for this example */
  props: Record<string, unknown>;
}

/** WCAG accessibility requirements for a component */
export interface AccessibilityRequirements {
  /** Minimum WCAG level (AA or AAA) */
  wcagLevel: 'AA' | 'AAA';
  /** Required ARIA roles */
  requiredRoles?: string[];
  /** Required ARIA states/properties */
  requiredAria?: string[];
  /** Keyboard interaction requirements */
  keyboardInteraction?: string;
  /** Focus management requirements */
  focusManagement?: string;
  /** Screen reader announcements */
  screenReader?: string;
  /** Color contrast requirements */
  contrastRatio?: {
    normal: number;
    large: number;
  };
}

/** Base interface that all component types extend */
export interface BaseComponent {
  /** Component name (PascalCase) */
  name: string;
  /** Component description */
  description: string;
  /** Atomic Design level */
  atomicLevel: 'atom' | 'molecule' | 'organism' | 'template' | 'page';
  /** Component props */
  props: PropDefinition[];
  /** Available variants */
  variants: ComponentVariant[];
  /** Supported states */
  states: ComponentState[];
  /** Usage examples */
  examples: ComponentExample[];
  /** Accessibility requirements */
  accessibility: AccessibilityRequirements;
  /** Child component names (for composition validation) */
  children?: string[];
  /** Parent component names (for hierarchy validation) */
  parents?: string[];
}

/** Atomic component (smallest building blocks) */
export interface AtomComponent extends BaseComponent {
  atomicLevel: 'atom';
}

/** Molecule component (group of atoms) */
export interface MoleculeComponent extends BaseComponent {
  atomicLevel: 'molecule';
  /** References to atom children */
  atoms: string[];
}

/** Organism component (complex group of molecules) */
export interface OrganismComponent extends BaseComponent {
  atomicLevel: 'organism';
  /** References to molecule children */
  molecules: string[];
}

/** Template component (page layout structure) */
export interface TemplateComponent extends BaseComponent {
  atomicLevel: 'template';
  /** Regions/slots in the template */
  regions: string[];
}

/** Complete component library */
export interface ComponentLibrary {
  /** Library name */
  name: string;
  /** Library version */
  version: string;
  /** Atomic components */
  atoms: AtomComponent[];
  /** Molecule components */
  molecules: MoleculeComponent[];
  /** Organism components */
  organisms: OrganismComponent[];
  /** Template components */
  templates: TemplateComponent[];
  /** Page-level compositions */
  pages?: BaseComponent[];
}
