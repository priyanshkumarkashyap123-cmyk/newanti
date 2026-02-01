/**
 * ============================================================================
 * CONFIGURATION INDEX
 * ============================================================================
 * 
 * Central export for all application configurations.
 * 
 * @version 2.0.0
 */

// Environment Configuration
export { default as env } from './env';
export * from './env';

// Navigation Configuration
export * from './navigation.config';
export { default as ROUTES } from './navigation.config';

// Structural UI Configuration  
export * from './structural-ui.config';

// App Constants
export const APP_CONFIG = {
  name: 'Structural Design Center',
  version: '1.0.0',
  description: 'Professional civil & structural engineering design platform',
  author: 'Engineering Team',
  
  // API Endpoints
  api: {
    baseUrl: import.meta.env.VITE_API_URL || '/api',
    timeout: 30000,
  },
  
  // Feature Flags
  features: {
    aiAssistant: true,
    cloudSync: true,
    collaboration: false,
    advancedAnalysis: true,
    exportToDXF: true,
    exportToRevit: false,
  },
  
  // Limits
  limits: {
    maxProjectsPerUser: 100,
    maxFileSizeMB: 50,
    maxRecentProjects: 10,
  },
  
  // Default Values
  defaults: {
    units: 'SI' as const,
    language: 'en',
    theme: 'dark' as const,
    designCode: 'IS456',
    steelCode: 'IS800',
  },
};

// Backwards-compatible API base constant
export const API_BASE = APP_CONFIG.api.baseUrl;

// Design Standards Information
export const DESIGN_STANDARDS = {
  concrete: {
    IS456: { name: 'IS 456:2000', country: 'India', description: 'Plain and Reinforced Concrete - Code of Practice' },
    ACI318: { name: 'ACI 318-19', country: 'USA', description: 'Building Code Requirements for Structural Concrete' },
    EN1992: { name: 'EN 1992-1-1', country: 'Europe', description: 'Eurocode 2: Design of Concrete Structures' },
    AS3600: { name: 'AS 3600', country: 'Australia', description: 'Concrete Structures' },
    BS8110: { name: 'BS 8110', country: 'UK', description: 'Structural Use of Concrete' },
  },
  steel: {
    IS800: { name: 'IS 800:2007', country: 'India', description: 'General Construction in Steel - Code of Practice' },
    AISC360: { name: 'AISC 360-22', country: 'USA', description: 'Specification for Structural Steel Buildings' },
    EN1993: { name: 'EN 1993-1-1', country: 'Europe', description: 'Eurocode 3: Design of Steel Structures' },
    AS4100: { name: 'AS 4100', country: 'Australia', description: 'Steel Structures' },
  },
  loading: {
    IS875: { name: 'IS 875', country: 'India', description: 'Code of Practice for Design Loads' },
    ASCE7: { name: 'ASCE 7-22', country: 'USA', description: 'Minimum Design Loads' },
    EN1991: { name: 'EN 1991', country: 'Europe', description: 'Eurocode 1: Actions on Structures' },
  },
  seismic: {
    IS1893: { name: 'IS 1893:2016', country: 'India', description: 'Criteria for Earthquake Resistant Design' },
    ASCE7_SEISMIC: { name: 'ASCE 7 Seismic', country: 'USA', description: 'Seismic Design Requirements' },
    EN1998: { name: 'EN 1998', country: 'Europe', description: 'Eurocode 8: Design for Earthquake Resistance' },
  },
};

// Material Database
export const MATERIAL_DATABASE = {
  concrete: {
    indian: ['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M55', 'M60', 'M65', 'M70', 'M75', 'M80'],
    american: ['C20', 'C25', 'C28', 'C30', 'C35', 'C40', 'C45', 'C50', 'C55', 'C60'],
    european: ['C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60'],
  },
  rebar: {
    indian: ['Fe250', 'Fe415', 'Fe500', 'Fe500D', 'Fe550', 'Fe550D', 'Fe600'],
    american: ['Grade 40', 'Grade 60', 'Grade 75', 'Grade 80', 'Grade 100'],
    european: ['B500A', 'B500B', 'B500C'],
  },
  structuralSteel: {
    indian: ['E250', 'E300', 'E350', 'E410', 'E450'],
    american: ['A36', 'A572 Gr 50', 'A992', 'A588'],
    european: ['S235', 'S275', 'S355', 'S420', 'S460'],
  },
};

export default APP_CONFIG;
