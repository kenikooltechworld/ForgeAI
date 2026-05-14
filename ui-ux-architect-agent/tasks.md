# Implementation Plan: UI/UX Architect Agent

## Overview

This implementation plan covers the development of the UI/UX Architect Agent, a specialized AI agent for ForgeAI that provides professional-grade UI/UX design expertise. The agent operates entirely through local LLM execution via Ollama with RAG knowledge management, ensuring zero cloud API costs.

The implementation is organized into 7 phases with incremental progress, property-based testing for core algorithms, and comprehensive integration with the existing ForgeAI extension architecture.

---

## Tasks

### Phase 1: Foundation - Types, Interfaces, and Core Setup

- [ ] 1. Set up project structure and core type definitions
  - Create `src/extension/agents/ui-ux-architect/` directory structure
  - Create `src/extension/agents/ui-ux-architect/types/` for all type definitions
  - Create barrel export file for clean imports
  - _Requirements: 1.1, 1.2, 3.1_

  - [ ] 1.1 Create design token type definitions
    - Define `DesignTokens`, `ColorTokens`, `ColorScale`, `TypographyTokens`, `SpacingTokens`, `ShadowTokens`, `AnimationTokens`, `BreakpointTokens`, `RadiusTokens` interfaces
    - Define `SemanticColorTokens` for theme-aware colors
    - Define `FontFamily`, `TypographySize` supporting types
    - _Requirements: 1.1, 1.3, 1.5, 1.6_

  - [ ]* 1.2 Write property test for color palette completeness
    - **Property 2: Color Palette Completeness**
    - **Validates: Requirements 1.3**

  - [ ]* 1.3 Write property test for spacing scale ratio consistency
    - **Property 3: Spacing Scale Ratio Consistency**
    - **Validates: Requirements 1.6**

  - [ ]* 1.4 Write property test for token category organization
    - **Property 15: Token Category Organization**
    - **Validates: Requirements 6.4**

  - [ ] 1.5 Create component library type definitions
    - Define `ComponentLibrary`, `BaseComponent`, `AtomComponent`, `MoleculeComponent`, `OrganismComponent`, `TemplateComponent` interfaces
    - Define `PropDefinition`, `ComponentVariant`, `ComponentState`, `ComponentExample` supporting types
    - Define `AccessibilityRequirements` interface for WCAG compliance
    - _Requirements: 3.1, 3.5, 5.1_

  - [ ]* 1.6 Write property test for component definition completeness
    - **Property 5: Component Definition Completeness**
    - **Validates: Requirements 3.5**

  - [ ]* 1.7 Write property test for atomic design hierarchy integrity
    - **Property 4: Atomic Design Hierarchy Integrity**
    - **Validates: Requirements 3.1, 3.6**

  - [ ] 1.8 Create information architecture type definitions
    - Define `InformationArchitecture`, `SitemapNode`, `NavigationStructure`, `NavigationItem` interfaces
    - Define `UserFlow`, `FlowStep`, `LabelingSystem` supporting types
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 1.9 Create platform adaptation type definitions
    - Define `Platform` union type (web, ios, android, macos, windows, vscode-extension, browser-extension)
    - Define `PlatformDesign`, `PlatformAdaptation`, `ResponsiveBreakpoint` interfaces
    - _Requirements: 4.1, 4.2_

  - [ ]* 1.10 Write property test for touch target minimum size
    - **Property 8: Touch Target Minimum Size**
    - **Validates: Requirements 4.3**

  - [ ] 1.11 Create RAG knowledge base type definitions
    - Define `RAGCollectionSchemas` constant with all collection configurations
    - Define `RAGDocument`, `RAGQueryResult` interfaces
    - Define document chunk types for ingestion
    - _Requirements: 11.1, 11.2, 18.5_

  - [ ]* 1.12 Write property test for document chunk size compliance
    - **Property 18: Document Chunk Size Compliance**
    - **Validates: Requirements 18.5**

  - [ ] 1.13 Create error handling type definitions
    - Define `UIUXAgentErrorType` union type for all error categories
    - Define `UIUXAgentError` interface with structured error response
    - Define `ErrorHandlingStrategies` constant with recovery guidance
    - _Requirements: 19.1, 19.2, 19.3_

  - [ ] 1.14 Create state management type definitions
    - Define `DesignSystemState` interface for design system management
    - Define `RAGState` interface for knowledge base state
    - Define `ProjectDesignContext` interface for detected project context
    - _Requirements: 14.1, 14.2, 14.3_

- [ ] 2. Checkpoint - Foundation types complete
  - Ensure all type definitions compile without errors
  - Run TypeScript type checking
  - Ask the user if questions arise

---

### Phase 2: RAG Knowledge Base Integration

- [ ] 3. Implement ChromaDB integration and knowledge base
  - Create `src/extension/agents/ui-ux-architect/rag/` directory
  - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 3.1 Implement RAGKnowledgeBase core class
    - Create `RAGKnowledgeBase.ts` with ChromaDB embedded mode initialization
    - Implement collection management for all knowledge domains
    - Implement hybrid search (BM25 + vector) using ChromaDB
    - _Requirements: 11.1, 11.3_

  - [ ] 3.2 Implement collection initialization for design knowledge
    - Initialize collections: material-design-3, apple-hig, wcag-guidelines, tailwind-docs
    - Initialize collections: design-patterns, user-design-system, component-library, animation-patterns
    - Configure cosine similarity space for all collections
    - _Requirements: 11.4, 11.5, 11.6, 11.7_

  - [ ] 3.3 Implement document chunking strategies
    - Create semantic chunker for guidelines and documentation
    - Create AST-based chunker for code examples
    - Create section-based chunker for API references
    - _Requirements: 18.5_

  - [ ] 3.4 Implement knowledge base query methods
    - Implement `query()` method with metadata filtering
    - Implement `addDocuments()` for bulk document ingestion
    - Implement `ingestDesignDoc()` with automatic chunk strategy detection
    - _Requirements: 11.3, 18.1, 18.6_

  - [ ] 3.5 Implement query caching layer
    - Add in-memory query cache with TTL
    - Implement cache invalidation on document updates
    - _Requirements: 11.3_

  - [ ]* 3.6 Write unit tests for RAGKnowledgeBase
    - Test collection initialization
    - Test document insertion and retrieval
    - Test hybrid search functionality
    - _Requirements: 11.1, 11.3_

  - [ ] 3.7 Create knowledge base seeding scripts
    - Create scripts to seed Material Design 3 guidelines
    - Create scripts to seed Apple HIG guidelines
    - Create scripts to seed WCAG 2.1 guidelines
    - Create scripts to seed Tailwind CSS documentation
    - _Requirements: 11.4, 11.5, 11.6, 11.7_

- [ ] 4. Checkpoint - RAG knowledge base operational
  - Verify ChromaDB initialization works
  - Test document insertion and retrieval
  - Ensure all seeded collections are queryable

---

### Phase 3: Core Agent Tools - Design System & Tokens

- [ ] 5. Implement design system storage layer
  - Create `src/extension/agents/ui-ux-architect/storage/` directory
  - _Requirements: 1.7, 6.1, 6.2, 6.3_

  - [ ] 5.1 Implement DesignSystemStorage class
    - Create file system operations for `.forgeai/design-system/` directory
    - Implement `save()` method for persisting complete design systems
    - Implement `load()` method for loading existing design systems
    - _Requirements: 1.7, 13.6_

  - [ ] 5.2 Implement token export formatters
    - Implement `formatAsJSON()` for Style Dictionary compatible output
    - Implement `formatAsCSS()` for CSS custom properties with dark mode
    - Implement `formatAsTailwind()` for Tailwind configuration
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 5.3 Write property test for design token serialization round-trip
    - **Property 6: Design Token Serialization Round-Trip**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ] 5.4 Implement token naming validator
    - Validate semantic naming conventions
    - Check for literal value naming anti-patterns
    - _Requirements: 6.5_

  - [ ]* 5.5 Write property test for semantic token naming convention
    - **Property 7: Semantic Token Naming Convention**
    - **Validates: Requirements 6.5**

  - [ ] 5.6 Implement light/dark theme token generation
    - Generate theme-aware semantic tokens
    - Ensure contrast compliance in both modes
    - _Requirements: 15.1, 15.4_

  - [ ]* 5.7 Write property test for theme token consistency
    - **Property 16: Theme Token Consistency**
    - **Validates: Requirements 15.1, 15.4**

- [ ] 6. Implement design system creation tools
  - Create `src/extension/agents/ui-ux-architect/tools/` directory
  - _Requirements: 1.1, 1.2, 6.1_

  - [ ] 6.1 Implement uiux_create_design_system tool
    - Define tool schema with input parameters
    - Implement color palette generation with WCAG-compliant shades
    - Implement typography scale generation
    - Implement spacing scale generation with consistent ratios
    - Implement shadow and animation token generation
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [ ] 6.2 Implement color contrast calculation utilities
    - Implement WCAG contrast ratio calculation
    - Implement WCAG AA/AAA compliance checking
    - Implement color adjustment for compliance
    - _Requirements: 1.4, 5.2, 15.2_

  - [ ]* 6.3 Write property test for color contrast compliance
    - **Property 1: Color Contrast Compliance**
    - **Validates: Requirements 1.4, 5.2, 15.2**

  - [ ] 6.4 Implement uiux_generate_design_tokens tool
    - Generate tokens in specified format (JSON, CSS, Tailwind)
    - Support partial token generation (colors only, typography only)
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 6.5 Implement uiux_export_tokens tool
    - Export tokens to specified file path
    - Support multiple export formats in single operation
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.6 Implement design system documentation generator
    - Generate Markdown documentation for design tokens
    - Generate component catalog with examples
    - Generate accessibility guide
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ] 7. Checkpoint - Design system tools functional
  - Verify design system creation works end-to-end
  - Test token export to all formats
  - Ensure WCAG contrast compliance in generated colors

---

### Phase 4: Component Design & Platform Adaptation Tools

- [ ] 8. Implement component design tools
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 8.1 Implement uiux_design_component_hierarchy tool
    - Design component hierarchy following Atomic Design principles
    - Generate atoms, molecules, organisms, templates structure
    - Validate hierarchy integrity (no upward references)
    - _Requirements: 3.1, 3.6_

  - [ ] 8.2 Implement uiux_define_component tool
    - Define component with props API specification
    - Define variants and states with token overrides
    - Define accessibility requirements per component
    - _Requirements: 3.5_

  - [ ] 8.3 Implement component composition validator
    - Validate that all component references resolve
    - Check for circular dependencies
    - Ensure atomic design level integrity
    - _Requirements: 3.6_

- [ ] 9. Implement platform adaptation tools
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 9.1 Implement uiux_adapt_for_platform tool
    - Apply Material Design 3 patterns for Android
    - Apply Apple HIG patterns for iOS/macOS
    - Apply web conventions for web/desktop
    - Apply extension patterns for VS Code/browser extensions
    - _Requirements: 4.1, 4.6_

  - [ ] 9.2 Implement uiux_generate_responsive_breakpoints tool
    - Generate responsive breakpoints (sm, md, lg, xl, 2xl)
    - Define column layouts, margins, and gutters per breakpoint
    - _Requirements: 4.2_

  - [ ] 9.3 Implement platform-specific touch target validator
    - Validate iOS touch targets (44x44 points minimum)
    - Validate Android touch targets (48x48dp minimum)
    - _Requirements: 4.3_

  - [ ] 9.4 Implement navigation pattern adapter
    - Adapt navigation for bottom tabs (mobile)
    - Adapt navigation for sidebar (desktop)
    - Adapt navigation for hamburger menu (extensions)
    - _Requirements: 4.5_

- [ ] 10. Implement information architecture tools
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 10.1 Implement uiux_plan_information_architecture tool
    - Analyze application domain and propose IA hierarchy
    - Generate sitemap with page relationships
    - Identify user flows for key tasks
    - _Requirements: 2.1, 2.3, 2.4_

  - [ ] 10.2 Implement uiux_design_navigation tool
    - Design primary and secondary navigation
    - Design breadcrumbs and footer links
    - Use user-centered labeling terminology
    - _Requirements: 2.2, 2.5, 2.6_

  - [ ] 10.3 Implement sitemap documentation generator
    - Generate sitemap with page relationships
    - Generate navigation paths documentation
    - _Requirements: 2.4_

- [ ] 11. Checkpoint - Component and platform tools complete
  - Verify component hierarchy design works
  - Test platform adaptation for all supported platforms
  - Ensure information architecture planning generates valid output

---

### Phase 5: Accessibility & Animation Tools

- [ ] 12. Implement accessibility compliance tools
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 12.1 Implement uiux_check_accessibility tool
    - Check WCAG 2.1 Level AA compliance for designs
    - Check color contrast ratios for all text/background pairs
    - Check focus indicators for interactive components
    - Check form label associations
    - Check alternative text for images
    - Check skip navigation links
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 12.2 Implement uiux_fix_accessibility_issue tool
    - Suggest contrast adjustments for failing color pairs
    - Suggest focus indicator additions
    - Suggest label associations for form inputs
    - Suggest alternative text for images
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 12.3 Implement interactive state validator
    - Verify all required states defined (default, hover, focus, active, disabled)
    - Verify visual feedback for each state
    - _Requirements: 5.3, 16.3_

  - [ ]* 12.4 Write property test for interactive state completeness
    - **Property 9: Interactive State Completeness**
    - **Validates: Requirements 5.3, 16.3**

  - [ ] 12.5 Implement form accessibility validator
    - Check label-input associations
    - Check error message specifications
    - _Requirements: 5.5_

  - [ ]* 12.6 Write property test for form accessibility completeness
    - **Property 11: Form Accessibility Completeness**
    - **Validates: Requirements 5.5**

  - [ ] 12.7 Implement image alt text validator
    - Check for alternative text on non-decorative images
    - Flag decorative images that should be marked as such
    - _Requirements: 5.4_

  - [ ]* 12.8 Write property test for image alternative text presence
    - **Property 12: Image Alternative Text Presence**
    - **Validates: Requirements 5.4**

- [ ] 13. Implement animation and interaction design tools
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ] 13.1 Implement animation token generator
    - Generate timing functions (ease-in, ease-out, ease-in-out, custom cubic-bezier)
    - Generate duration values by animation type (micro, standard, complex)
    - Generate transition patterns
    - _Requirements: 16.1, 16.2, 16.5_

  - [ ] 13.2 Implement CSS timing function validator
    - Validate timing function keywords
    - Validate cubic-bezier notation
    - _Requirements: 16.1_

  - [ ]* 13.3 Write property test for CSS timing function validity
    - **Property 14: CSS Timing Function Validity**
    - **Validates: Requirements 16.1**

  - [ ]* 13.4 Write property test for animation duration range compliance
    - **Property 13: Animation Duration Range Compliance**
    - **Validates: Requirements 16.2**

  - [ ] 13.5 Implement reduced motion alternative generator
    - Generate `prefers-reduced-motion` alternatives
    - Remove or significantly reduce motion
    - _Requirements: 5.7, 16.4_

  - [ ]* 13.6 Write property test for animation reduced motion alternative
    - **Property 10: Animation Reduced Motion Alternative**
    - **Validates: Requirements 5.7, 16.4**

  - [ ] 13.7 Implement interaction state designer
    - Design hover, focus, active, disabled states
    - Generate CSS animation code or Tailwind classes
    - _Requirements: 16.3, 16.6_

- [ ] 14. Checkpoint - Accessibility and animation tools complete
  - Verify WCAG compliance checking works
  - Test animation token generation
  - Ensure all property tests pass

---

### Phase 6: Integration Points - VS Code & Browser Capability

- [ ] 15. Implement project context detection
  - Create `src/extension/agents/ui-ux-architect/context/` directory
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ] 15.1 Implement ProjectContextDetector class
    - Detect UI framework from package.json (React, Vue, Angular, Svelte)
    - Detect styling approach (Tailwind, CSS Modules, styled-components, emotion)
    - Detect existing design systems (MUI, Chakra, Radix, Mantine, shadcn, Ant Design)
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ] 15.2 Implement existing token extractor
    - Extract tokens from Tailwind config
    - Extract CSS custom properties from CSS files
    - Analyze existing color schemes and typography
    - _Requirements: 14.4, 14.5, 14.6_

  - [ ]* 15.3 Write property test for project context detection accuracy
    - **Property 20: Project Context Detection Accuracy**
    - **Validates: Requirements 14.1**

- [ ] 16. Implement VS Code extension integration
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ] 16.1 Register UIUXArchitectAgent with extension
    - Create agent class extending BaseAgent
    - Implement `registerTools()` method for all tools
    - Implement `getSystemPrompt()` method
    - Integrate with ToolRegistry
    - _Requirements: 13.1_

  - [ ] 16.2 Implement VS Code command palette commands
    - Register `forgeai.uiux.createDesignSystem` command
    - Register `forgeai.uiux.generateTokens` command
    - Register `forgeai.uiux.critiqueDesign` command
    - Register `forgeai.uiux.checkAccessibility` command
    - _Requirements: 13.4_

  - [ ] 16.3 Implement file context menus
    - Add context menu for CSS files (extract tokens)
    - Add context menu for Tailwind config (analyze config)
    - _Requirements: 13.4_

  - [ ] 16.4 Implement webview panel integration
    - Create design system preview panel
    - Create component catalog panel
    - Integrate with ActivityStream for output display
    - _Requirements: 13.1, 13.5_

  - [ ] 16.5 Implement VS Code theming integration
    - Match VS Code theme colors (light/dark)
    - Use VS Code markdown rendering for output
    - _Requirements: 13.2, 13.5_

  - [ ] 16.6 Implement file context awareness
    - Analyze open file for design suggestions
    - Provide contextual recommendations
    - _Requirements: 13.3_

- [ ] 17. Implement Browser Capability integration for trend research
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ] 17.1 Implement uiux_research_trends tool
    - Use Browser Capability to fetch design articles
    - Browse authoritative sources (Smashing Magazine, A List Apart, Nielsen Norman Group)
    - Browse design galleries (Dribbble, Behance)
    - _Requirements: 12.1, 12.2, 12.5_

  - [ ] 17.2 Implement trend content extractor
    - Extract design patterns from articles
    - Extract design insights from galleries
    - Add extracted content to RAG knowledge base
    - _Requirements: 12.3_

  - [ ] 17.3 Implement source attribution
    - Attribute sources when providing researched information
    - Track source URLs in metadata
    - _Requirements: 12.4_

  - [ ] 17.4 Implement rate limiting and robots.txt compliance
    - Respect robots.txt when browsing
    - Implement rate limiting for design resources
    - _Requirements: 12.6_

- [ ] 18. Implement design critique and knowledge ingestion tools
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [ ] 18.1 Implement uiux_critique_design tool
    - Analyze design against principles (hierarchy, contrast, alignment, proximity, repetition)
    - Identify accessibility issues
    - Evaluate visual hierarchy
    - Provide actionable recommendations with rationale
    - Compare against platform guidelines when applicable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 18.2 Implement uiux_ingest_documentation tool
    - Support PDF, Markdown, HTML, and plain text ingestion
    - Extract brand guidelines (colors, typography, logos)
    - Ingest existing component library documentation
    - Chunk documents appropriately for RAG
    - Store with metadata for filtering
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [ ] 18.3 Implement wireframe and mockup description tools
    - Generate text-based wireframe descriptions
    - Generate mockup descriptions with specific values
    - Use standard layout terminology
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 18.4 Write property test for layout terminology validity
    - **Property 19: Layout Terminology Validity**
    - **Validates: Requirements 7.6**

- [ ] 19. Implement error handling and fallback responses
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [ ] 19.1 Implement Ollama unavailability handler
    - Display clear error message with start instructions
    - Graceful degradation when server unavailable
    - _Requirements: 19.1, 10.3_

  - [ ] 19.2 Implement RAG query fallback
    - Fall back to base LLM knowledge on query failure
    - Add disclaimer about limited context
    - _Requirements: 19.2_

  - [ ] 19.3 Implement Browser Capability unavailability handler
    - Use cached knowledge base content when browser unavailable
    - _Requirements: 19.3_

  - [ ] 19.4 Implement ambiguous request handler
    - Ask clarifying questions before proceeding
    - Prompt for platform, style, or constraint details
    - _Requirements: 19.4_

  - [ ] 19.5 Implement accessibility violation flagging
    - Flag violations with specific WCAG criteria
    - Suggest corrections automatically
    - _Requirements: 19.5_

  - [ ] 19.6 Implement error logging
    - Log errors for debugging
    - Present user-friendly messages
    - _Requirements: 19.6_

- [ ] 20. Checkpoint - Integration complete
  - Verify VS Code commands work
  - Test Browser Capability integration
  - Ensure error handling works for all failure modes

---

### Phase 7: Testing & Final Integration

- [ ] 21. Implement comprehensive test suite
  - _Requirements: All_

  - [ ]* 21.1 Write unit tests for color contrast calculation
    - Test contrast ratio math for various color pairs
    - Test WCAG AA/AAA compliance checking

  - [ ]* 21.2 Write unit tests for token format conversion
    - Test JSON format output
    - Test CSS custom properties output
    - Test Tailwind configuration output

  - [ ]* 21.3 Write unit tests for spacing scale generation
    - Test ratio-based spacing calculations
    - Test base unit scaling

  - [ ]* 21.4 Write unit tests for naming convention validation
    - Test semantic naming pattern matching
    - Test literal value naming detection

  - [ ]* 21.5 Write unit tests for timing function parsing
    - Test CSS timing function validation
    - Test cubic-bezier notation validation

  - [ ] 21.6 Write integration tests for RAG operations
    - Test storage, retrieval, and hybrid search
    - Test document ingestion and chunking
    - _Requirements: 11.1, 11.3_

  - [ ] 21.7 Write integration tests for design system persistence
    - Test file system operations in `.forgeai/design-system/`
    - Test save, load, and export workflows
    - _Requirements: 1.7, 6.1, 6.2, 6.3_

  - [ ] 21.8 Write integration tests for Browser Capability
    - Test trend research and content extraction
    - Test source attribution
    - _Requirements: 12.1, 12.3, 12.4_

  - [ ] 21.9 Write integration tests for Ollama LLM integration
    - Test model loading and streaming
    - Test tool calling
    - _Requirements: 10.1, 10.4, 10.5_

  - [ ] 21.10 Write integration tests for project context detection
    - Test framework and styling detection
    - Test existing design system detection
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ] 21.11 Write integration tests for accessibility violation handling
    - Test error detection
    - Test correction suggestions
    - _Requirements: 5.1, 19.5_

- [ ] 22. Implement design adaptation for new features
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 22.1 Implement design system extension for new features
    - Load existing design system from RAG
    - Propose new components matching existing tokens
    - Extend token system consistently
    - _Requirements: 9.1, 9.2, 9.5_

  - [ ] 22.2 Implement new token consistency validator
    - Verify new tokens follow existing naming conventions
    - Verify new tokens match existing scale patterns
    - _Requirements: 9.5_

  - [ ]* 22.3 Write property test for new token consistency with existing system
    - **Property 17: New Token Consistency with Existing System**
    - **Validates: Requirements 9.5**

  - [ ] 22.4 Implement component documentation updater
    - Update component documentation and hierarchy
    - Document feature impact on design system
    - _Requirements: 9.3, 9.6_

  - [ ] 22.5 Implement information architecture integration
    - Ensure new features integrate with existing IA
    - Update navigation and sitemap as needed
    - _Requirements: 9.4_

- [ ] 23. Final checkpoint - All systems operational
  - Run complete test suite
  - Verify all property tests pass
  - Verify all integration tests pass
  - Test end-to-end design system creation workflow
  - Ask the user if questions arise

---

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties for core algorithms
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows and external service interactions
- The design uses TypeScript, which matches the existing ForgeAI codebase

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.5", "1.8", "1.9", "1.11", "1.13", "1.14"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.6", "1.7", "1.10", "1.12"] },
    { "id": 2, "tasks": ["3.1", "3.2", "5.1"] },
    { "id": 3, "tasks": ["3.3", "3.4", "3.5", "5.2", "5.4", "5.6"] },
    { "id": 4, "tasks": ["3.6", "3.7", "5.3", "5.5", "5.7"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.4", "6.5", "6.6"] },
    { "id": 6, "tasks": ["6.3", "8.1", "8.2", "8.3"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3", "9.4", "10.1", "10.2", "10.3"] },
    { "id": 8, "tasks": ["12.1", "12.2", "12.3", "12.5", "12.7", "13.1", "13.2", "13.5", "13.7"] },
    { "id": 9, "tasks": ["12.4", "12.6", "12.8", "13.3", "13.4", "13.6"] },
    { "id": 10, "tasks": ["15.1", "15.2"] },
    { "id": 11, "tasks": ["15.3", "16.1", "17.1", "17.2", "17.3", "17.4", "18.1", "18.2", "18.3"] },
    { "id": 12, "tasks": ["18.4", "16.2", "16.3", "16.4", "16.5", "16.6"] },
    { "id": 13, "tasks": ["19.1", "19.2", "19.3", "19.4", "19.5", "19.6"] },
    { "id": 14, "tasks": ["21.6", "21.7", "21.8", "21.9", "21.10", "21.11"] },
    { "id": 15, "tasks": ["21.1", "21.2", "21.3", "21.4", "21.5"] },
    { "id": 16, "tasks": ["22.1", "22.2", "22.4", "22.5"] },
    { "id": 17, "tasks": ["22.3"] }
  ]
}
```
