/**
 * Room Planner Library - Main Index
 * 
 * Exports all room planner types, utilities, and components
 */

// Types
export * from './types';

// Geometry & Math utilities
export * from './geometry';

// Validation engine
export { ValidationEngine, createValidationEngine } from './validation';

// Rendering
export { CanvasRenderer, type RenderOptions } from './renderer';

// Interaction management
export { CanvasInteractionManager, type InteractionHandler, type InteractionEvent } from './interaction';
