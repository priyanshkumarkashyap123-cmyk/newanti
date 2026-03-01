/**
 * ============================================================================
 * STRUCTURAL ENGINEERING CALCULATOR - INDUSTRY GRADE UI
 * ============================================================================
 * 
 * Professional-grade structural calculation interface with:
 * - Multi-code support (IS, AISC, ACI, Eurocode)
 * - Real-time validation
 * - Detailed calculation steps
 * - Export capabilities
 * - Code compliance checks
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */


import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Info,
  BookOpen,
  Settings,
  Ruler,
  Building2,
  Hammer,
  Layers,
  Columns,
  Box,
  CircleDot,
  Triangle,
  Square,
  LineChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type DesignCodeType = 
  | 'IS_456' | 'IS_800' | 'IS_1343' | 'IS_1893' | 'IS_1905' | 'IS_883' | 'IS_2911'
  | 'ACI_318' | 'AISC_360' | 'ASCE_7'
  | 'EC2' | 'EC3' | 'EC8';

export type CalculationType = 
  | 'beam_design' | 'column_design' | 'slab_design'
  | 'steel_beam' | 'steel_column' | 'connection'
  | 'prestressed_beam' | 'shear_wall'
  | 'foundation' | 'pile' | 'retaining_wall'
  | 'masonry_wall' | 'timber_beam'
  | 'seismic_analysis' | 'wind_load'
  // New comprehensive types
  | 'isolated_footing' | 'combined_footing'
  | 'seismic_equivalent_static' | 'seismic_response_spectrum'
  | 'bolted_connection' | 'welded_connection' | 'base_plate'
  // Frame & Load Analysis types
  | 'continuous_beam' | 'portal_frame' | 'deflection_analysis'
  | 'influence_line' | 'load_combination';

export interface CalculationInput {
  [key: string]: number | string | boolean;
}

export interface CalculationResult {
  isAdequate: boolean;
  utilization: number;
  capacity: number;
  demand: number;
  status: 'OK' | 'WARNING' | 'FAIL';
  message: string;
  steps: CalculationStep[];
  codeChecks: CodeCheck[];
  warnings: string[];
  // Optional extended results
  summary?: Record<string, string | number>;
  designSummary?: Record<string, string | number>;
  storeyForces?: Array<{ level: number; height: string; force: string; shear: string }>;
  modalResults?: Array<{ mode: number; period: string; participation: string; baseShear: string }>;
}

export interface CalculationStep {
  title: string;
  description: string;
  formula: string;
  values: Record<string, string | number>;
  reference?: string;
  result?: string;
}

export interface CodeCheck {
  clause: string;
  description: string;
  required?: string;
  provided?: string;
  limit?: string;
  actual?: string;
  utilization?: number;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'OK';
}

export interface InputField {
  name: string;
  label: string;
  type: 'number' | 'select' | 'checkbox';
  unit?: string;
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number | string | boolean;
  required?: boolean;
  tooltip?: string;
  group?: string;
  validation?: (value: number) => { valid: boolean; message?: string };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DESIGN_CODES: Record<DesignCodeType, { name: string; country: string; year: string }> = {
  IS_456: { name: 'IS 456', country: 'India', year: '2000' },
  IS_800: { name: 'IS 800', country: 'India', year: '2007' },
  IS_1343: { name: 'IS 1343', country: 'India', year: '2012' },
  IS_1893: { name: 'IS 1893', country: 'India', year: '2016' },
  IS_1905: { name: 'IS 1905', country: 'India', year: '1987' },
  IS_883: { name: 'IS 883', country: 'India', year: '1994' },
  IS_2911: { name: 'IS 2911', country: 'India', year: '2010' },
  ACI_318: { name: 'ACI 318', country: 'USA', year: '2019' },
  AISC_360: { name: 'AISC 360', country: 'USA', year: '2022' },
  ASCE_7: { name: 'ASCE 7', country: 'USA', year: '2022' },
  EC2: { name: 'Eurocode 2', country: 'Europe', year: '2004' },
  EC3: { name: 'Eurocode 3', country: 'Europe', year: '2005' },
  EC8: { name: 'Eurocode 8', country: 'Europe', year: '2004' },
};

const CALCULATION_TYPES: Record<CalculationType, { 
  name: string; 
  icon: React.ElementType; 
  codes: DesignCodeType[];
  description: string;
}> = {
  beam_design: { 
    name: 'RC Beam Design', 
    icon: Box, 
    codes: ['IS_456', 'ACI_318', 'EC2'],
    description: 'Reinforced concrete beam design for flexure and shear'
  },
  column_design: { 
    name: 'RC Column Design', 
    icon: Columns, 
    codes: ['IS_456', 'ACI_318', 'EC2'],
    description: 'Reinforced concrete column design with axial and bending'
  },
  slab_design: { 
    name: 'RC Slab Design', 
    icon: Square, 
    codes: ['IS_456', 'ACI_318', 'EC2'],
    description: 'One-way and two-way slab design'
  },
  steel_beam: { 
    name: 'Steel Beam Design', 
    icon: Box, 
    codes: ['IS_800', 'AISC_360', 'EC3'],
    description: 'Steel beam design with LTB and shear checks'
  },
  steel_column: { 
    name: 'Steel Column Design', 
    icon: Columns, 
    codes: ['IS_800', 'AISC_360', 'EC3'],
    description: 'Steel column design with buckling analysis'
  },
  connection: { 
    name: 'Connection Design', 
    icon: CircleDot, 
    codes: ['IS_800', 'AISC_360', 'EC3'],
    description: 'Bolted and welded connection design'
  },
  prestressed_beam: { 
    name: 'Prestressed Concrete', 
    icon: Hammer, 
    codes: ['IS_1343', 'ACI_318'],
    description: 'Pre and post-tensioned beam design'
  },
  shear_wall: { 
    name: 'Shear Wall Design', 
    icon: Layers, 
    codes: ['IS_456', 'ACI_318'],
    description: 'Shear wall design for lateral loads'
  },
  foundation: { 
    name: 'Foundation Design', 
    icon: Building2, 
    codes: ['IS_456', 'ACI_318'],
    description: 'Isolated and combined footing design'
  },
  pile: { 
    name: 'Pile Foundation', 
    icon: Columns, 
    codes: ['IS_2911'],
    description: 'Pile capacity and settlement analysis'
  },
  retaining_wall: { 
    name: 'Retaining Wall', 
    icon: Layers, 
    codes: ['IS_456'],
    description: 'Cantilever and gravity retaining wall design'
  },
  masonry_wall: { 
    name: 'Masonry Wall', 
    icon: Building2, 
    codes: ['IS_1905'],
    description: 'Load-bearing masonry wall design'
  },
  timber_beam: { 
    name: 'Timber Design', 
    icon: Box, 
    codes: ['IS_883'],
    description: 'Timber beam and column design'
  },
  seismic_analysis: { 
    name: 'Seismic Analysis', 
    icon: Triangle, 
    codes: ['IS_1893', 'ASCE_7', 'EC8'],
    description: 'Seismic load calculation and analysis'
  },
  wind_load: { 
    name: 'Wind Load', 
    icon: Triangle, 
    codes: ['IS_875', 'ASCE_7'] as any,
    description: 'Wind load calculation for structures'
  },
  // New comprehensive calculation types
  isolated_footing: {
    name: 'Isolated Footing',
    icon: Building2,
    codes: ['IS_456', 'ACI_318'],
    description: 'Isolated/pad footing design with punching shear check'
  },
  combined_footing: {
    name: 'Combined Footing',
    icon: Building2,
    codes: ['IS_456', 'ACI_318'],
    description: 'Combined footing supporting multiple columns'
  },
  seismic_equivalent_static: {
    name: 'Seismic Equivalent Static',
    icon: Triangle,
    codes: ['IS_1893', 'ASCE_7', 'EC8'],
    description: 'Equivalent static seismic analysis per IS 1893'
  },
  seismic_response_spectrum: {
    name: 'Response Spectrum Analysis',
    icon: Triangle,
    codes: ['IS_1893', 'ASCE_7', 'EC8'],
    description: 'Dynamic response spectrum analysis per IS 1893'
  },
  bolted_connection: {
    name: 'Bolted Connection',
    icon: CircleDot,
    codes: ['IS_800', 'AISC_360', 'EC3'],
    description: 'Bearing and friction-type bolted connections'
  },
  welded_connection: {
    name: 'Welded Connection',
    icon: Hammer,
    codes: ['IS_800', 'AISC_360', 'EC3'],
    description: 'Fillet and butt weld connection design'
  },
  base_plate: {
    name: 'Base Plate Design',
    icon: Layers,
    codes: ['IS_800', 'AISC_360', 'EC3'],
    description: 'Steel column base plate design'
  },
  // Frame & Load Analysis types
  continuous_beam: {
    name: 'Continuous Beam Analysis',
    icon: Box,
    codes: ['IS_456', 'ACI_318'],
    description: 'Multi-span continuous beam analysis with moment distribution'
  },
  portal_frame: {
    name: 'Portal Frame Analysis',
    icon: Building2,
    codes: ['IS_456', 'IS_800'],
    description: 'Portal frame analysis using approximate methods'
  },
  deflection_analysis: {
    name: 'Deflection Analysis',
    icon: Ruler,
    codes: ['IS_456', 'ACI_318'],
    description: 'Serviceability deflection check with cracked section analysis'
  },
  influence_line: {
    name: 'Influence Line',
    icon: LineChart,
    codes: ['IS_456', 'ACI_318'],
    description: 'Influence line generation for moving loads'
  },
  load_combination: {
    name: 'Load Combinations',
    icon: Layers,
    codes: ['IS_456', 'IS_875'] as any,
    description: 'IS 875/IS 456 load combination generator'
  },
};

// ============================================================================
// INPUT FIELD DEFINITIONS
// ============================================================================

const getInputFields = (calcType: CalculationType, code: DesignCodeType): InputField[] => {
  const baseFields: Record<CalculationType, InputField[]> = {
    beam_design: [
      // Geometry Group
      { name: 'width', label: 'Width', type: 'number', unit: 'mm', min: 150, max: 1000, step: 10, defaultValue: 300, required: true, group: 'Geometry', tooltip: 'Overall width of beam section' },
      { name: 'depth', label: 'Overall Depth', type: 'number', unit: 'mm', min: 200, max: 2000, step: 25, defaultValue: 500, required: true, group: 'Geometry', tooltip: 'Overall depth of beam section' },
      { name: 'effective_depth', label: 'Effective Depth', type: 'number', unit: 'mm', min: 150, max: 1900, step: 25, defaultValue: 450, required: true, group: 'Geometry', tooltip: 'd = D - cover - φ/2' },
      { name: 'span', label: 'Span', type: 'number', unit: 'mm', min: 1000, max: 15000, step: 100, defaultValue: 6000, required: true, group: 'Geometry' },
      { name: 'clear_cover', label: 'Clear Cover', type: 'number', unit: 'mm', min: 20, max: 75, step: 5, defaultValue: 25, required: true, group: 'Geometry' },
      
      // Material Group
      { name: 'fck', label: 'Concrete Grade (fck)', type: 'select', options: [
        { value: 20, label: 'M20' }, { value: 25, label: 'M25' }, { value: 30, label: 'M30' },
        { value: 35, label: 'M35' }, { value: 40, label: 'M40' }, { value: 45, label: 'M45' },
        { value: 50, label: 'M50' }, { value: 55, label: 'M55' }, { value: 60, label: 'M60' },
      ], defaultValue: 25, required: true, group: 'Material' },
      { name: 'fy', label: 'Steel Grade (fy)', type: 'select', options: [
        { value: 250, label: 'Fe 250' }, { value: 415, label: 'Fe 415' },
        { value: 500, label: 'Fe 500' }, { value: 550, label: 'Fe 550' },
      ], defaultValue: 500, required: true, group: 'Material' },
      
      // Loading Group
      { name: 'Mu', label: 'Factored Moment', type: 'number', unit: 'kN·m', min: 0, max: 5000, step: 1, defaultValue: 200, required: true, group: 'Loading', tooltip: 'Design factored bending moment' },
      { name: 'Vu', label: 'Factored Shear', type: 'number', unit: 'kN', min: 0, max: 2000, step: 1, defaultValue: 150, required: true, group: 'Loading', tooltip: 'Design factored shear force' },
      
      // Design Options
      { name: 'design_type', label: 'Design Type', type: 'select', options: [
        { value: 'singly', label: 'Singly Reinforced' },
        { value: 'doubly', label: 'Doubly Reinforced' },
      ], defaultValue: 'singly', group: 'Options' },
      { name: 'exposure', label: 'Exposure Condition', type: 'select', options: [
        { value: 'mild', label: 'Mild' }, { value: 'moderate', label: 'Moderate' },
        { value: 'severe', label: 'Severe' }, { value: 'very_severe', label: 'Very Severe' },
        { value: 'extreme', label: 'Extreme' },
      ], defaultValue: 'moderate', group: 'Options' },
    ],
    
    steel_beam: [
      // Section Group
      { name: 'section_type', label: 'Section Type', type: 'select', options: [
        { value: 'ISMB', label: 'ISMB' }, { value: 'ISWB', label: 'ISWB' },
        { value: 'ISLB', label: 'ISLB' }, { value: 'ISHB', label: 'ISHB' },
      ], defaultValue: 'ISMB', required: true, group: 'Section' },
      { name: 'section_size', label: 'Section Size', type: 'select', options: [
        { value: 'ISMB200', label: 'ISMB 200' }, { value: 'ISMB250', label: 'ISMB 250' },
        { value: 'ISMB300', label: 'ISMB 300' }, { value: 'ISMB350', label: 'ISMB 350' },
        { value: 'ISMB400', label: 'ISMB 400' }, { value: 'ISMB450', label: 'ISMB 450' },
        { value: 'ISMB500', label: 'ISMB 500' }, { value: 'ISMB550', label: 'ISMB 550' },
        { value: 'ISMB600', label: 'ISMB 600' },
      ], defaultValue: 'ISMB400', required: true, group: 'Section' },
      { name: 'span', label: 'Span', type: 'number', unit: 'mm', min: 1000, max: 20000, step: 100, defaultValue: 8000, required: true, group: 'Section' },
      { name: 'unbraced_length', label: 'Unbraced Length', type: 'number', unit: 'mm', min: 0, max: 20000, step: 100, defaultValue: 2000, required: true, group: 'Section', tooltip: 'Laterally unsupported length for LTB check' },
      
      // Material Group
      { name: 'steel_grade', label: 'Steel Grade', type: 'select', options: [
        { value: 'E250', label: 'E250 (fy=250 MPa)' },
        { value: 'E300', label: 'E300 (fy=300 MPa)' },
        { value: 'E350', label: 'E350 (fy=350 MPa)' },
        { value: 'E410', label: 'E410 (fy=410 MPa)' },
        { value: 'E450', label: 'E450 (fy=450 MPa)' },
      ], defaultValue: 'E250', required: true, group: 'Material' },
      
      // Loading Group
      { name: 'Mu', label: 'Factored Moment', type: 'number', unit: 'kN·m', min: 0, max: 5000, step: 1, defaultValue: 300, required: true, group: 'Loading' },
      { name: 'Vu', label: 'Factored Shear', type: 'number', unit: 'kN', min: 0, max: 2000, step: 1, defaultValue: 200, required: true, group: 'Loading' },
      { name: 'concentrated_load', label: 'Concentrated Load', type: 'number', unit: 'kN', min: 0, max: 1000, step: 1, defaultValue: 0, group: 'Loading', tooltip: 'For web crippling check' },
      
      // Options
      { name: 'check_ltb', label: 'Check LTB', type: 'checkbox', defaultValue: true, group: 'Options' },
      { name: 'check_web_crippling', label: 'Check Web Crippling', type: 'checkbox', defaultValue: false, group: 'Options' },
    ],
    
    column_design: [
      // Geometry
      { name: 'width', label: 'Width (b)', type: 'number', unit: 'mm', min: 200, max: 1500, step: 25, defaultValue: 400, required: true, group: 'Geometry' },
      { name: 'depth', label: 'Depth (D)', type: 'number', unit: 'mm', min: 200, max: 1500, step: 25, defaultValue: 400, required: true, group: 'Geometry' },
      { name: 'height', label: 'Unsupported Height', type: 'number', unit: 'mm', min: 2000, max: 10000, step: 100, defaultValue: 3500, required: true, group: 'Geometry' },
      { name: 'clear_cover', label: 'Clear Cover', type: 'number', unit: 'mm', min: 40, max: 75, step: 5, defaultValue: 40, required: true, group: 'Geometry' },
      
      // Material
      { name: 'fck', label: 'Concrete Grade', type: 'select', options: [
        { value: 25, label: 'M25' }, { value: 30, label: 'M30' }, { value: 35, label: 'M35' },
        { value: 40, label: 'M40' }, { value: 45, label: 'M45' }, { value: 50, label: 'M50' },
      ], defaultValue: 30, required: true, group: 'Material' },
      { name: 'fy', label: 'Steel Grade', type: 'select', options: [
        { value: 415, label: 'Fe 415' }, { value: 500, label: 'Fe 500' }, { value: 550, label: 'Fe 550' },
      ], defaultValue: 500, required: true, group: 'Material' },
      
      // Loading
      { name: 'Pu', label: 'Factored Axial Load', type: 'number', unit: 'kN', min: 0, max: 20000, step: 10, defaultValue: 2000, required: true, group: 'Loading' },
      { name: 'Mux', label: 'Moment about X-axis', type: 'number', unit: 'kN·m', min: 0, max: 2000, step: 1, defaultValue: 150, group: 'Loading' },
      { name: 'Muy', label: 'Moment about Y-axis', type: 'number', unit: 'kN·m', min: 0, max: 2000, step: 1, defaultValue: 100, group: 'Loading' },
      
      // Options
      { name: 'end_condition', label: 'End Condition', type: 'select', options: [
        { value: 'fixed_fixed', label: 'Fixed-Fixed' },
        { value: 'fixed_hinged', label: 'Fixed-Hinged' },
        { value: 'hinged_hinged', label: 'Hinged-Hinged' },
      ], defaultValue: 'fixed_hinged', group: 'Options' },
      { name: 'braced', label: 'Braced Column', type: 'checkbox', defaultValue: true, group: 'Options' },
    ],

    slab_design: [
      // Geometry
      { name: 'lx', label: 'Shorter Span (lx)', type: 'number', unit: 'mm', min: 2000, max: 8000, step: 100, defaultValue: 4000, required: true, group: 'Geometry' },
      { name: 'ly', label: 'Longer Span (ly)', type: 'number', unit: 'mm', min: 2000, max: 10000, step: 100, defaultValue: 5000, required: true, group: 'Geometry' },
      { name: 'thickness', label: 'Slab Thickness', type: 'number', unit: 'mm', min: 100, max: 300, step: 10, defaultValue: 150, required: true, group: 'Geometry' },
      { name: 'clear_cover', label: 'Clear Cover', type: 'number', unit: 'mm', min: 15, max: 50, step: 5, defaultValue: 20, required: true, group: 'Geometry' },
      // Material
      { name: 'fck', label: 'Concrete Grade', type: 'select', options: [
        { value: 20, label: 'M20' }, { value: 25, label: 'M25' }, { value: 30, label: 'M30' },
      ], defaultValue: 25, required: true, group: 'Material' },
      { name: 'fy', label: 'Steel Grade', type: 'select', options: [
        { value: 415, label: 'Fe 415' }, { value: 500, label: 'Fe 500' },
      ], defaultValue: 500, required: true, group: 'Material' },
      // Loading
      { name: 'dead_load', label: 'Dead Load', type: 'number', unit: 'kN/m²', min: 1, max: 20, step: 0.5, defaultValue: 5, required: true, group: 'Loading' },
      { name: 'live_load', label: 'Live Load', type: 'number', unit: 'kN/m²', min: 1, max: 10, step: 0.5, defaultValue: 3, required: true, group: 'Loading' },
      { name: 'floor_finish', label: 'Floor Finish Load', type: 'number', unit: 'kN/m²', min: 0, max: 3, step: 0.25, defaultValue: 1, group: 'Loading' },
      // Options
      { name: 'slab_type', label: 'Slab Type', type: 'select', options: [
        { value: 'one_way', label: 'One-Way Slab' }, { value: 'two_way', label: 'Two-Way Slab' }, { value: 'auto', label: 'Auto-Detect' },
      ], defaultValue: 'auto', group: 'Options' },
      { name: 'edge_condition', label: 'Edge Condition', type: 'select', options: [
        { value: 'four_edges_discontinuous', label: 'All Edges Discontinuous' },
        { value: 'one_edge_continuous', label: 'One Edge Continuous' },
        { value: 'two_adjacent_continuous', label: 'Two Adjacent Continuous' },
        { value: 'two_opposite_continuous', label: 'Two Opposite Continuous' },
        { value: 'three_edges_continuous', label: 'Three Edges Continuous' },
        { value: 'four_edges_continuous', label: 'All Edges Continuous' },
      ], defaultValue: 'four_edges_discontinuous', group: 'Options' },
    ],
    steel_column: [],
    connection: [],
    prestressed_beam: [],
    shear_wall: [],
    foundation: [],
    pile: [],
    retaining_wall: [],
    masonry_wall: [],
    timber_beam: [],
    seismic_analysis: [],
    
    // New comprehensive calculation types
    isolated_footing: [
      // Column
      { name: 'column_size_x', label: 'Column Size (X)', type: 'number', unit: 'mm', min: 200, max: 1000, step: 25, defaultValue: 400, required: true, group: 'Column' },
      { name: 'column_size_y', label: 'Column Size (Y)', type: 'number', unit: 'mm', min: 200, max: 1000, step: 25, defaultValue: 400, required: true, group: 'Column' },
      { name: 'column_shape', label: 'Column Shape', type: 'select', options: [
        { value: 'square', label: 'Square' }, { value: 'rectangular', label: 'Rectangular' }, { value: 'circular', label: 'Circular' },
      ], defaultValue: 'square', group: 'Column' },
      // Loading
      { name: 'axial_load', label: 'Axial Load (Service)', type: 'number', unit: 'kN', min: 100, max: 10000, step: 10, defaultValue: 1000, required: true, group: 'Loading' },
      { name: 'moment_x', label: 'Moment X', type: 'number', unit: 'kN·m', min: 0, max: 500, step: 1, defaultValue: 50, group: 'Loading' },
      { name: 'moment_y', label: 'Moment Y', type: 'number', unit: 'kN·m', min: 0, max: 500, step: 1, defaultValue: 50, group: 'Loading' },
      // Material
      { name: 'fck', label: 'Concrete Grade', type: 'select', options: [
        { value: 20, label: 'M20' }, { value: 25, label: 'M25' }, { value: 30, label: 'M30' },
      ], defaultValue: 25, required: true, group: 'Material' },
      { name: 'fy', label: 'Steel Grade', type: 'select', options: [
        { value: 415, label: 'Fe 415' }, { value: 500, label: 'Fe 500' },
      ], defaultValue: 500, required: true, group: 'Material' },
      { name: 'clear_cover', label: 'Clear Cover', type: 'number', unit: 'mm', min: 50, max: 75, step: 5, defaultValue: 50, required: true, group: 'Material' },
      // Soil
      { name: 'soil_type', label: 'Soil Type', type: 'select', options: [
        { value: 'soft_clay', label: 'Soft Clay (75 kN/m²)' },
        { value: 'medium_clay', label: 'Medium Clay (150 kN/m²)' },
        { value: 'stiff_clay', label: 'Stiff Clay (300 kN/m²)' },
        { value: 'loose_sand', label: 'Loose Sand (100 kN/m²)' },
        { value: 'medium_sand', label: 'Medium Sand (200 kN/m²)' },
        { value: 'dense_sand', label: 'Dense Sand (400 kN/m²)' },
      ], defaultValue: 'medium_sand', required: true, group: 'Soil' },
    ],
    
    combined_footing: [
      { name: 'col1_x', label: 'Column 1 Size X', type: 'number', unit: 'mm', min: 200, max: 800, step: 25, defaultValue: 400, required: true, group: 'Column 1' },
      { name: 'col1_y', label: 'Column 1 Size Y', type: 'number', unit: 'mm', min: 200, max: 800, step: 25, defaultValue: 400, required: true, group: 'Column 1' },
      { name: 'col1_load', label: 'Column 1 Load', type: 'number', unit: 'kN', min: 100, max: 5000, step: 10, defaultValue: 800, required: true, group: 'Column 1' },
      { name: 'col2_x', label: 'Column 2 Size X', type: 'number', unit: 'mm', min: 200, max: 800, step: 25, defaultValue: 400, required: true, group: 'Column 2' },
      { name: 'col2_y', label: 'Column 2 Size Y', type: 'number', unit: 'mm', min: 200, max: 800, step: 25, defaultValue: 400, required: true, group: 'Column 2' },
      { name: 'col2_load', label: 'Column 2 Load', type: 'number', unit: 'kN', min: 100, max: 5000, step: 10, defaultValue: 1200, required: true, group: 'Column 2' },
      { name: 'column_spacing', label: 'Column Spacing', type: 'number', unit: 'mm', min: 1000, max: 6000, step: 100, defaultValue: 3000, required: true, group: 'Geometry' },
      { name: 'fck', label: 'Concrete Grade', type: 'select', options: [
        { value: 25, label: 'M25' }, { value: 30, label: 'M30' },
      ], defaultValue: 25, required: true, group: 'Material' },
      { name: 'fy', label: 'Steel Grade', type: 'select', options: [
        { value: 415, label: 'Fe 415' }, { value: 500, label: 'Fe 500' },
      ], defaultValue: 500, required: true, group: 'Material' },
      { name: 'clear_cover', label: 'Clear Cover', type: 'number', unit: 'mm', min: 50, max: 75, step: 5, defaultValue: 50, group: 'Material' },
      { name: 'bearing_capacity', label: 'Bearing Capacity', type: 'number', unit: 'kN/m²', min: 50, max: 500, step: 10, defaultValue: 200, required: true, group: 'Soil' },
    ],
    
    seismic_equivalent_static: [
      { name: 'building_height', label: 'Building Height', type: 'number', unit: 'm', min: 3, max: 150, step: 1, defaultValue: 30, required: true, group: 'Building' },
      { name: 'num_storeys', label: 'Number of Storeys', type: 'number', unit: '', min: 1, max: 50, step: 1, defaultValue: 10, required: true, group: 'Building' },
      { name: 'zone', label: 'Seismic Zone', type: 'select', options: [
        { value: 'II', label: 'Zone II (Low)' }, { value: 'III', label: 'Zone III (Moderate)' },
        { value: 'IV', label: 'Zone IV (Severe)' }, { value: 'V', label: 'Zone V (Very Severe)' },
      ], defaultValue: 'III', required: true, group: 'Seismic' },
      { name: 'soil_type', label: 'Soil Type', type: 'select', options: [
        { value: 'I', label: 'Type I - Rock/Hard' }, { value: 'II', label: 'Type II - Medium' }, { value: 'III', label: 'Type III - Soft' },
      ], defaultValue: 'II', required: true, group: 'Seismic' },
      { name: 'importance', label: 'Importance Category', type: 'select', options: [
        { value: 'residential', label: 'Residential (I=1.0)' }, { value: 'commercial', label: 'Commercial (I=1.0)' },
        { value: 'hospital', label: 'Hospital (I=1.5)' }, { value: 'emergency', label: 'Emergency (I=1.5)' },
      ], defaultValue: 'commercial', required: true, group: 'Seismic' },
      { name: 'structural_system', label: 'Structural System', type: 'select', options: [
        { value: 'OMRF', label: 'OMRF (R=3.0)' }, { value: 'SMRF', label: 'SMRF (R=5.0)' },
        { value: 'Dual', label: 'Dual System (R=4.0)' }, { value: 'RC_SW', label: 'RC Shear Wall (R=4.0)' },
      ], defaultValue: 'SMRF', required: true, group: 'Seismic' },
    ],
    
    seismic_response_spectrum: [
      { name: 'building_height', label: 'Building Height', type: 'number', unit: 'm', min: 3, max: 150, step: 1, defaultValue: 30, required: true, group: 'Building' },
      { name: 'num_storeys', label: 'Number of Storeys', type: 'number', unit: '', min: 1, max: 50, step: 1, defaultValue: 10, required: true, group: 'Building' },
      { name: 'zone', label: 'Seismic Zone', type: 'select', options: [
        { value: 'II', label: 'Zone II' }, { value: 'III', label: 'Zone III' },
        { value: 'IV', label: 'Zone IV' }, { value: 'V', label: 'Zone V' },
      ], defaultValue: 'III', required: true, group: 'Seismic' },
      { name: 'soil_type', label: 'Soil Type', type: 'select', options: [
        { value: 'I', label: 'Type I' }, { value: 'II', label: 'Type II' }, { value: 'III', label: 'Type III' },
      ], defaultValue: 'II', required: true, group: 'Seismic' },
      { name: 'importance', label: 'Importance', type: 'select', options: [
        { value: 'residential', label: 'Residential' }, { value: 'hospital', label: 'Hospital' },
      ], defaultValue: 'residential', group: 'Seismic' },
      { name: 'structural_system', label: 'Structural System', type: 'select', options: [
        { value: 'OMRF', label: 'OMRF' }, { value: 'SMRF', label: 'SMRF' }, { value: 'Dual', label: 'Dual' },
      ], defaultValue: 'SMRF', group: 'Seismic' },
    ],
    
    bolted_connection: [
      { name: 'bolt_grade', label: 'Bolt Grade', type: 'select', options: [
        { value: '4.6', label: '4.6' }, { value: '8.8', label: '8.8' }, { value: '10.9', label: '10.9' },
      ], defaultValue: '8.8', required: true, group: 'Bolt' },
      { name: 'bolt_diameter', label: 'Bolt Diameter', type: 'select', options: [
        { value: 12, label: 'M12' }, { value: 16, label: 'M16' }, { value: 20, label: 'M20' },
        { value: 24, label: 'M24' }, { value: 27, label: 'M27' }, { value: 30, label: 'M30' },
      ], defaultValue: 20, required: true, group: 'Bolt' },
      { name: 'num_bolts', label: 'Number of Bolts', type: 'number', unit: '', min: 2, max: 20, step: 1, defaultValue: 4, required: true, group: 'Bolt' },
      { name: 'bolt_rows', label: 'Bolt Rows', type: 'number', unit: '', min: 1, max: 10, step: 1, defaultValue: 2, group: 'Bolt' },
      { name: 'bolt_columns', label: 'Bolt Columns', type: 'number', unit: '', min: 1, max: 10, step: 1, defaultValue: 2, group: 'Bolt' },
      { name: 'plate_thickness', label: 'Plate Thickness', type: 'number', unit: 'mm', min: 6, max: 40, step: 2, defaultValue: 12, required: true, group: 'Plate' },
      { name: 'plate_fu', label: 'Plate Ultimate Strength', type: 'number', unit: 'MPa', min: 300, max: 500, step: 10, defaultValue: 410, required: true, group: 'Plate' },
      { name: 'plate_fy', label: 'Plate Yield Strength', type: 'number', unit: 'MPa', min: 200, max: 450, step: 10, defaultValue: 250, required: true, group: 'Plate' },
      { name: 'connection_type', label: 'Connection Type', type: 'select', options: [
        { value: 'bearing', label: 'Bearing Type' }, { value: 'friction', label: 'Friction Type (HSFG)' },
      ], defaultValue: 'bearing', group: 'Options' },
      { name: 'shear_plane', label: 'Shear Plane', type: 'select', options: [
        { value: 'threads_in', label: 'Threads in Shear Plane' }, { value: 'threads_excluded', label: 'Threads Excluded' },
      ], defaultValue: 'threads_excluded', group: 'Options' },
      { name: 'num_shear_planes', label: 'Number of Shear Planes', type: 'number', unit: '', min: 1, max: 2, step: 1, defaultValue: 1, group: 'Options' },
      { name: 'shear_force', label: 'Shear Force', type: 'number', unit: 'kN', min: 0, max: 1000, step: 5, defaultValue: 100, required: true, group: 'Loading' },
      { name: 'edge_distance', label: 'Edge Distance', type: 'number', unit: 'mm', min: 20, max: 100, step: 5, defaultValue: 40, required: true, group: 'Geometry' },
      { name: 'pitch', label: 'Pitch', type: 'number', unit: 'mm', min: 40, max: 200, step: 5, defaultValue: 60, required: true, group: 'Geometry' },
    ],
    
    welded_connection: [
      { name: 'weld_type', label: 'Weld Type', type: 'select', options: [
        { value: 'fillet', label: 'Fillet Weld' }, { value: 'butt', label: 'Butt Weld' },
      ], defaultValue: 'fillet', required: true, group: 'Weld' },
      { name: 'weld_size', label: 'Weld Size/Throat', type: 'number', unit: 'mm', min: 3, max: 25, step: 1, defaultValue: 6, required: true, group: 'Weld' },
      { name: 'weld_length', label: 'Weld Length', type: 'number', unit: 'mm', min: 40, max: 2000, step: 10, defaultValue: 150, required: true, group: 'Weld' },
      { name: 'electrode_grade', label: 'Electrode Grade', type: 'select', options: [
        { value: 'E410', label: 'E410 (410 MPa)' }, { value: 'E450', label: 'E450 (450 MPa)' }, { value: 'E550', label: 'E550 (550 MPa)' },
      ], defaultValue: 'E410', required: true, group: 'Weld' },
      { name: 'plate_fu', label: 'Base Metal fu', type: 'number', unit: 'MPa', min: 300, max: 500, step: 10, defaultValue: 410, required: true, group: 'Material' },
      { name: 'plate_thickness', label: 'Plate Thickness', type: 'number', unit: 'mm', min: 6, max: 40, step: 2, defaultValue: 12, required: true, group: 'Material' },
      { name: 'shear_force', label: 'Shear Force', type: 'number', unit: 'kN', min: 0, max: 500, step: 5, defaultValue: 80, group: 'Loading' },
      { name: 'tension_force', label: 'Tension Force', type: 'number', unit: 'kN', min: 0, max: 500, step: 5, defaultValue: 0, group: 'Loading' },
      { name: 'weld_position', label: 'Weld Position', type: 'select', options: [
        { value: 'longitudinal', label: 'Longitudinal' }, { value: 'transverse', label: 'Transverse' },
      ], defaultValue: 'longitudinal', group: 'Options' },
    ],
    
    base_plate: [
      { name: 'column_depth', label: 'Column Depth', type: 'number', unit: 'mm', min: 150, max: 600, step: 10, defaultValue: 300, required: true, group: 'Column' },
      { name: 'column_flange_width', label: 'Column Flange Width', type: 'number', unit: 'mm', min: 100, max: 400, step: 5, defaultValue: 150, required: true, group: 'Column' },
      { name: 'column_flange_thickness', label: 'Flange Thickness', type: 'number', unit: 'mm', min: 8, max: 30, step: 1, defaultValue: 12, required: true, group: 'Column' },
      { name: 'column_web_thickness', label: 'Web Thickness', type: 'number', unit: 'mm', min: 5, max: 20, step: 1, defaultValue: 8, required: true, group: 'Column' },
      { name: 'fy_column', label: 'Column fy', type: 'number', unit: 'MPa', min: 200, max: 450, step: 10, defaultValue: 250, group: 'Material' },
      { name: 'fy_plate', label: 'Plate fy', type: 'number', unit: 'MPa', min: 200, max: 450, step: 10, defaultValue: 250, required: true, group: 'Material' },
      { name: 'fck', label: 'Concrete Grade', type: 'select', options: [
        { value: 20, label: 'M20' }, { value: 25, label: 'M25' }, { value: 30, label: 'M30' },
      ], defaultValue: 25, required: true, group: 'Material' },
      { name: 'axial_load', label: 'Axial Load', type: 'number', unit: 'kN', min: 100, max: 5000, step: 10, defaultValue: 500, required: true, group: 'Loading' },
      { name: 'moment', label: 'Moment', type: 'number', unit: 'kN·m', min: 0, max: 500, step: 5, defaultValue: 0, group: 'Loading' },
    ],
    
    // ==================== FRAME & LOAD ANALYSIS ====================
    
    continuous_beam: [
      // Geometry
      { name: 'num_spans', label: 'Number of Spans', type: 'select', options: [
        { value: 2, label: '2 Spans' }, { value: 3, label: '3 Spans' }, { value: 4, label: '4 Spans' }, { value: 5, label: '5 Spans' },
      ], defaultValue: 3, required: true, group: 'Geometry' },
      { name: 'span_1', label: 'Span 1', type: 'number', unit: 'mm', min: 2000, max: 15000, step: 100, defaultValue: 6000, required: true, group: 'Geometry' },
      { name: 'span_2', label: 'Span 2', type: 'number', unit: 'mm', min: 2000, max: 15000, step: 100, defaultValue: 6000, required: true, group: 'Geometry' },
      { name: 'span_3', label: 'Span 3', type: 'number', unit: 'mm', min: 0, max: 15000, step: 100, defaultValue: 6000, group: 'Geometry', tooltip: 'Leave 0 if less than 3 spans' },
      { name: 'span_4', label: 'Span 4', type: 'number', unit: 'mm', min: 0, max: 15000, step: 100, defaultValue: 0, group: 'Geometry' },
      { name: 'span_5', label: 'Span 5', type: 'number', unit: 'mm', min: 0, max: 15000, step: 100, defaultValue: 0, group: 'Geometry' },
      // Section
      { name: 'width', label: 'Beam Width', type: 'number', unit: 'mm', min: 200, max: 600, step: 25, defaultValue: 300, required: true, group: 'Section' },
      { name: 'depth', label: 'Beam Depth', type: 'number', unit: 'mm', min: 300, max: 1200, step: 50, defaultValue: 500, required: true, group: 'Section' },
      // Material
      { name: 'fck', label: 'Concrete Grade', type: 'select', options: [
        { value: 25, label: 'M25' }, { value: 30, label: 'M30' }, { value: 35, label: 'M35' }, { value: 40, label: 'M40' },
      ], defaultValue: 30, required: true, group: 'Material' },
      // Loading
      { name: 'udl', label: 'UDL on All Spans', type: 'number', unit: 'kN/m', min: 5, max: 100, step: 1, defaultValue: 25, required: true, group: 'Loading' },
      { name: 'point_load', label: 'Point Load (mid-span)', type: 'number', unit: 'kN', min: 0, max: 500, step: 5, defaultValue: 0, group: 'Loading' },
      // Options
      { name: 'redistribution', label: 'Moment Redistribution (%)', type: 'number', unit: '%', min: 0, max: 30, step: 5, defaultValue: 15, group: 'Options', tooltip: 'IS 456 Cl. 37.1.1 (max 30%)' },
    ],
    
    portal_frame: [
      // Geometry
      { name: 'bay_width', label: 'Bay Width', type: 'number', unit: 'mm', min: 4000, max: 20000, step: 500, defaultValue: 8000, required: true, group: 'Geometry' },
      { name: 'column_height', label: 'Column Height', type: 'number', unit: 'mm', min: 3000, max: 12000, step: 500, defaultValue: 4000, required: true, group: 'Geometry' },
      { name: 'num_storeys', label: 'Number of Storeys', type: 'select', options: [
        { value: 1, label: '1 Storey' }, { value: 2, label: '2 Storeys' }, { value: 3, label: '3 Storeys' },
      ], defaultValue: 1, required: true, group: 'Geometry' },
      { name: 'num_bays', label: 'Number of Bays', type: 'select', options: [
        { value: 1, label: '1 Bay' }, { value: 2, label: '2 Bays' }, { value: 3, label: '3 Bays' },
      ], defaultValue: 2, required: true, group: 'Geometry' },
      // Section
      { name: 'beam_width', label: 'Beam Width', type: 'number', unit: 'mm', min: 200, max: 600, step: 25, defaultValue: 300, required: true, group: 'Beam Section' },
      { name: 'beam_depth', label: 'Beam Depth', type: 'number', unit: 'mm', min: 300, max: 900, step: 50, defaultValue: 500, required: true, group: 'Beam Section' },
      { name: 'column_width', label: 'Column Width', type: 'number', unit: 'mm', min: 250, max: 800, step: 25, defaultValue: 400, required: true, group: 'Column Section' },
      { name: 'column_depth', label: 'Column Depth', type: 'number', unit: 'mm', min: 250, max: 800, step: 25, defaultValue: 400, required: true, group: 'Column Section' },
      // Material
      { name: 'fck', label: 'Concrete Grade', type: 'select', options: [
        { value: 25, label: 'M25' }, { value: 30, label: 'M30' }, { value: 35, label: 'M35' },
      ], defaultValue: 30, required: true, group: 'Material' },
      // Loading
      { name: 'gravity_load', label: 'Gravity Load on Beams', type: 'number', unit: 'kN/m', min: 10, max: 100, step: 5, defaultValue: 30, required: true, group: 'Loading' },
      { name: 'lateral_load', label: 'Lateral Load per Storey', type: 'number', unit: 'kN', min: 0, max: 500, step: 10, defaultValue: 100, required: true, group: 'Loading', tooltip: 'Wind or seismic lateral force' },
      // Options
      { name: 'analysis_method', label: 'Analysis Method', type: 'select', options: [
        { value: 'portal', label: 'Portal Method' }, { value: 'cantilever', label: 'Cantilever Method' },
      ], defaultValue: 'portal', group: 'Options' },
      { name: 'base_condition', label: 'Base Condition', type: 'select', options: [
        { value: 'fixed', label: 'Fixed Base' }, { value: 'pinned', label: 'Pinned Base' },
      ], defaultValue: 'fixed', group: 'Options' },
    ],
    
    deflection_analysis: [
      // Beam Geometry
      { name: 'span', label: 'Span Length', type: 'number', unit: 'mm', min: 2000, max: 15000, step: 100, defaultValue: 6000, required: true, group: 'Geometry' },
      { name: 'width', label: 'Beam Width', type: 'number', unit: 'mm', min: 200, max: 600, step: 25, defaultValue: 300, required: true, group: 'Geometry' },
      { name: 'depth', label: 'Overall Depth', type: 'number', unit: 'mm', min: 250, max: 1000, step: 25, defaultValue: 500, required: true, group: 'Geometry' },
      { name: 'effective_depth', label: 'Effective Depth', type: 'number', unit: 'mm', min: 200, max: 950, step: 25, defaultValue: 450, required: true, group: 'Geometry' },
      { name: 'clear_cover', label: 'Clear Cover', type: 'number', unit: 'mm', min: 25, max: 50, step: 5, defaultValue: 25, group: 'Geometry' },
      // Material
      { name: 'fck', label: 'Concrete Grade', type: 'select', options: [
        { value: 25, label: 'M25' }, { value: 30, label: 'M30' }, { value: 35, label: 'M35' }, { value: 40, label: 'M40' },
      ], defaultValue: 30, required: true, group: 'Material' },
      { name: 'fy', label: 'Steel Grade', type: 'select', options: [
        { value: 415, label: 'Fe 415' }, { value: 500, label: 'Fe 500' },
      ], defaultValue: 500, required: true, group: 'Material' },
      // Reinforcement
      { name: 'Ast', label: 'Tension Steel Area', type: 'number', unit: 'mm²', min: 200, max: 5000, step: 50, defaultValue: 1200, required: true, group: 'Reinforcement', tooltip: 'Total area of tension reinforcement' },
      { name: 'Asc', label: 'Compression Steel Area', type: 'number', unit: 'mm²', min: 0, max: 3000, step: 50, defaultValue: 0, group: 'Reinforcement' },
      // Loading
      { name: 'dead_load', label: 'Dead Load', type: 'number', unit: 'kN/m', min: 5, max: 50, step: 1, defaultValue: 15, required: true, group: 'Loading' },
      { name: 'live_load', label: 'Live Load', type: 'number', unit: 'kN/m', min: 2, max: 30, step: 1, defaultValue: 10, required: true, group: 'Loading' },
      // Options
      { name: 'support_type', label: 'Support Type', type: 'select', options: [
        { value: 'simply_supported', label: 'Simply Supported' },
        { value: 'fixed_fixed', label: 'Fixed-Fixed' },
        { value: 'cantilever', label: 'Cantilever' },
        { value: 'fixed_pinned', label: 'Fixed-Pinned' },
        { value: 'continuous', label: 'Continuous' },
      ], defaultValue: 'simply_supported', group: 'Options' },
      { name: 'creep_factor', label: 'Creep Factor', type: 'number', min: 1.5, max: 3.0, step: 0.1, defaultValue: 2.0, group: 'Options', tooltip: 'Long-term creep multiplier (1.5-3.0)' },
      { name: 'humidity', label: 'Relative Humidity', type: 'number', unit: '%', min: 40, max: 90, step: 5, defaultValue: 60, group: 'Options' },
      { name: 'age_at_loading', label: 'Age at Loading', type: 'number', unit: 'days', min: 7, max: 90, step: 7, defaultValue: 28, group: 'Options' },
    ],
    
    influence_line: [
      // Beam Geometry
      { name: 'span', label: 'Span Length', type: 'number', unit: 'mm', min: 5000, max: 30000, step: 500, defaultValue: 10000, required: true, group: 'Geometry' },
      { name: 'support_type', label: 'Support Type', type: 'select', options: [
        { value: 'simply_supported', label: 'Simply Supported' },
        { value: 'continuous_2span', label: 'Continuous (2 Spans)' },
        { value: 'continuous_3span', label: 'Continuous (3 Spans)' },
      ], defaultValue: 'simply_supported', required: true, group: 'Geometry' },
      // Response Type
      { name: 'response_type', label: 'Response Type', type: 'select', options: [
        { value: 'reaction', label: 'Support Reaction' },
        { value: 'shear', label: 'Shear Force' },
        { value: 'moment', label: 'Bending Moment' },
      ], defaultValue: 'moment', required: true, group: 'Analysis' },
      { name: 'section_position', label: 'Section Position', type: 'number', unit: 'mm', min: 0, max: 30000, step: 100, defaultValue: 5000, required: true, group: 'Analysis', tooltip: 'Distance from left support where IL is calculated' },
      // Load
      { name: 'unit_load', label: 'Unit Load', type: 'number', unit: 'kN', min: 1, max: 100, step: 1, defaultValue: 1, group: 'Loading' },
      { name: 'load_increment', label: 'Load Position Increment', type: 'number', unit: 'mm', min: 100, max: 1000, step: 100, defaultValue: 500, group: 'Analysis', tooltip: 'Step size for moving load positions' },
    ],
    
    wind_load: [
      // Building Geometry
      { name: 'building_height', label: 'Building Height', type: 'number', unit: 'm', min: 5, max: 200, step: 1, defaultValue: 30, required: true, group: 'Geometry' },
      { name: 'building_width', label: 'Building Width', type: 'number', unit: 'm', min: 5, max: 100, step: 1, defaultValue: 20, required: true, group: 'Geometry' },
      { name: 'building_depth', label: 'Building Depth', type: 'number', unit: 'm', min: 5, max: 100, step: 1, defaultValue: 15, required: true, group: 'Geometry' },
      // Location
      { name: 'wind_zone', label: 'Wind Zone', type: 'select', options: [
        { value: 1, label: 'Zone 1 (33 m/s)' }, { value: 2, label: 'Zone 2 (39 m/s)' },
        { value: 3, label: 'Zone 3 (44 m/s)' }, { value: 4, label: 'Zone 4 (47 m/s)' },
        { value: 5, label: 'Zone 5 (50 m/s)' }, { value: 6, label: 'Zone 6 (55 m/s)' },
      ], defaultValue: 3, required: true, group: 'Location', tooltip: 'IS 875 Part 3 Wind Zone' },
      { name: 'terrain_category', label: 'Terrain Category', type: 'select', options: [
        { value: 1, label: 'Category 1 (Open Sea/Coast)' },
        { value: 2, label: 'Category 2 (Open Terrain)' },
        { value: 3, label: 'Category 3 (Suburban)' },
        { value: 4, label: 'Category 4 (Urban)' },
      ], defaultValue: 2, required: true, group: 'Location' },
      // Structure Class
      { name: 'structure_class', label: 'Structure Class', type: 'select', options: [
        { value: 'A', label: 'Class A (≤10m, clad)' },
        { value: 'B', label: 'Class B (10-50m or partially open)' },
        { value: 'C', label: 'Class C (>50m or open)' },
      ], defaultValue: 'B', required: true, group: 'Structure' },
      { name: 'topography', label: 'Topography Factor k3', type: 'number', min: 1.0, max: 1.36, step: 0.02, defaultValue: 1.0, group: 'Factors', tooltip: 'IS 875 Part 3 Cl. 6.3.3' },
      { name: 'importance_factor', label: 'Importance Factor k4', type: 'number', min: 1.0, max: 1.2, step: 0.05, defaultValue: 1.0, group: 'Factors' },
      { name: 'cladding_pressure', label: 'Include Cladding Pressure', type: 'checkbox', defaultValue: true, group: 'Options' },
    ],
    
    load_combination: [
      // Dead Load
      { name: 'dead_load', label: 'Dead Load', type: 'number', unit: 'kN/m²', min: 1, max: 50, step: 0.5, defaultValue: 5, required: true, group: 'Dead Load' },
      { name: 'super_dead_load', label: 'Superimposed DL', type: 'number', unit: 'kN/m²', min: 0, max: 10, step: 0.5, defaultValue: 1.5, group: 'Dead Load', tooltip: 'Floor finish, partitions, etc.' },
      // Live Load
      { name: 'live_load', label: 'Imposed Load', type: 'number', unit: 'kN/m²', min: 0.5, max: 25, step: 0.5, defaultValue: 3, required: true, group: 'Live Load' },
      { name: 'occupancy_type', label: 'Occupancy Type', type: 'select', options: [
        { value: 'residential', label: 'Residential (2.0 kN/m²)' },
        { value: 'office', label: 'Office (2.5 kN/m²)' },
        { value: 'assembly', label: 'Assembly (4.0 kN/m²)' },
        { value: 'storage', label: 'Storage (5.0 kN/m²)' },
        { value: 'retail', label: 'Retail (4.0 kN/m²)' },
      ], defaultValue: 'office', group: 'Live Load' },
      // Wind Load
      { name: 'wind_load', label: 'Wind Load', type: 'number', unit: 'kN/m²', min: 0, max: 10, step: 0.1, defaultValue: 1.2, group: 'Wind Load' },
      // Seismic
      { name: 'seismic_load', label: 'Seismic Base Shear', type: 'number', unit: 'kN', min: 0, max: 5000, step: 10, defaultValue: 0, group: 'Seismic' },
      // Options
      { name: 'code', label: 'Design Code', type: 'select', options: [
        { value: 'IS_456', label: 'IS 456:2000' },
        { value: 'IS_875', label: 'IS 875 Part 5' },
      ], defaultValue: 'IS_456', required: true, group: 'Options' },
      { name: 'limit_state', label: 'Limit State', type: 'select', options: [
        { value: 'ULS', label: 'Ultimate Limit State' },
        { value: 'SLS', label: 'Serviceability Limit State' },
        { value: 'both', label: 'Both ULS and SLS' },
      ], defaultValue: 'both', group: 'Options' },
    ],
  };
  
  return baseFields[calcType] || [];
};

// ============================================================================
// COMPONENTS
// ============================================================================

/** Input Field Component */
const InputFieldComponent: React.FC<{
  field: InputField;
  value: number | string | boolean;
  onChange: (name: string, value: number | string | boolean) => void;
  error?: string;
}> = ({ field, value, onChange, error }) => {
  const id = `input-${field.name}`;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
          {field.tooltip && (
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50">
                <div className="bg-gray-50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs rounded py-1 px-2 max-w-xs whitespace-normal">
                  {field.tooltip}
                </div>
              </div>
            </div>
          )}
        </label>
        {field.unit && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{field.unit}</span>
        )}
      </div>
      
      {field.type === 'number' && (
        <input
          id={id}
          type="number"
          value={value as number}
          onChange={(e) => onChange(field.name, parseFloat(e.target.value) || 0)}
          min={field.min}
          max={field.max}
          step={field.step}
          className={cn(
            "w-full px-3 py-2 rounded-lg border text-sm transition-colors",
            "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
            "focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            error ? "border-red-500" : "border-gray-300 dark:border-gray-600"
          )}
        />
      )}
      
      {field.type === 'select' && (
        <select
          id={id}
          value={value as string}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={cn(
            "w-full px-3 py-2 rounded-lg border text-sm transition-colors",
            "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
            "focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            error ? "border-red-500" : "border-gray-300 dark:border-gray-600"
          )}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      
      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            id={id}
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(field.name, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
        </label>
      )}
      
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};

/** Result Status Badge */
const StatusBadge: React.FC<{ status: 'OK' | 'WARNING' | 'FAIL' | 'PASS' }> = ({ status }) => {
  const config = {
    OK: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', text: 'ADEQUATE' },
    PASS: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', text: 'PASS' },
    WARNING: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', text: 'WARNING' },
    FAIL: { icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', text: 'INADEQUATE' },
  };
  
  const { icon: Icon, color, text } = config[status];
  
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", color)}>
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  );
};

/** Utilization Gauge */
const UtilizationGauge: React.FC<{ value: number; label?: string }> = ({ value, label }) => {
  const percentage = Math.min(value * 100, 150);
  const color = value <= 0.75 ? '#22c55e' : value <= 1.0 ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50" cy="50" r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-gray-700 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx="50" cy="50" r="40"
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.min(percentage, 100) * 2.51} 251`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {(value * 100).toFixed(1)}%
        </span>
        {label && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        )}
      </div>
    </div>
  );
};

/** Calculation Step Display */
const CalculationStepDisplay: React.FC<{ step: CalculationStep; index: number }> = ({ step, index }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{step.title}</span>
        </div>
        <ChevronRight className={cn("h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform", expanded && "rotate-90")} />
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3 bg-white dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
              
              {step.formula && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Formula:</p>
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400">{step.formula}</code>
                </div>
              )}
              
              {Object.keys(step.values).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(step.values).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{key}:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{val}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {step.reference && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{step.reference}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Code Check Table */
const CodeCheckTable: React.FC<{ checks: CodeCheck[] }> = ({ checks }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800">
          <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Clause</th>
          <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Check</th>
          <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-400">Required</th>
          <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-400">Provided</th>
          <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {checks.map((check, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td className="px-4 py-2 font-mono text-xs text-gray-500">{check.clause}</td>
            <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{check.description}</td>
            <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400">{check.required}</td>
            <td className="px-4 py-2 text-center font-medium text-gray-900 dark:text-gray-100">{check.provided}</td>
            <td className="px-4 py-2 text-center">
              <StatusBadge status={check.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface StructuralCalculatorProps {
  defaultType?: CalculationType;
  defaultCode?: DesignCodeType;
  onCalculate?: (inputs: CalculationInput, result: CalculationResult) => void;
  className?: string;
}

export const StructuralCalculator: React.FC<StructuralCalculatorProps> = ({
  defaultType = 'beam_design',
  defaultCode = 'IS_456',
  onCalculate,
  className,
}) => {
  // State
  const [calculationType, setCalculationType] = useState<CalculationType>(defaultType);
  const [designCode, setDesignCode] = useState<DesignCodeType>(defaultCode);
  const [inputs, setInputs] = useState<CalculationInput>({});
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'inputs' | 'results' | 'steps' | 'checks'>('inputs');
  
  // Get input fields for current selection
  const inputFields = useMemo(() => getInputFields(calculationType, designCode), [calculationType, designCode]);
  
  // Group fields by category
  const groupedFields = useMemo(() => {
    const groups: Record<string, InputField[]> = {};
    inputFields.forEach(field => {
      const group = field.group || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(field);
    });
    return groups;
  }, [inputFields]);
  
  // Initialize default values when calculation type changes
  React.useEffect(() => {
    const defaults: CalculationInput = {};
    inputFields.forEach(field => {
      defaults[field.name] = field.defaultValue;
    });
    setInputs(defaults);
    setResult(null);
    setErrors({});
  }, [calculationType, designCode]);
  
  // Handle input change
  const handleInputChange = useCallback((name: string, value: number | string | boolean) => {
    setInputs(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);
  
  // Validate inputs
  const validateInputs = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    
    inputFields.forEach(field => {
      if (field.required && (inputs[field.name] === undefined || inputs[field.name] === '')) {
        newErrors[field.name] = 'This field is required';
      }
      
      if (field.type === 'number') {
        const val = inputs[field.name] as number;
        if (field.min !== undefined && val < field.min) {
          newErrors[field.name] = `Minimum value is ${field.min}`;
        }
        if (field.max !== undefined && val > field.max) {
          newErrors[field.name] = `Maximum value is ${field.max}`;
        }
        if (field.validation) {
          const { valid, message } = field.validation(val);
          if (!valid) {
            newErrors[field.name] = message || 'Invalid value';
          }
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [inputs, inputFields]);
  
  // Perform calculation
  const performCalculation = useCallback(async () => {
    if (!validateInputs()) return;
    
    setIsCalculating(true);
    
    try {
      // Simulate calculation delay for realistic feel
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock calculation result - in production, this would call the actual calculation modules
      const mockResult: CalculationResult = {
        isAdequate: true,
        utilization: 0.78,
        capacity: 350,
        demand: 273,
        status: 'OK',
        message: 'Section is adequate for the applied loads',
        steps: [
          {
            title: 'Material Properties',
            description: 'Calculate design strength of materials',
            formula: 'fcd = 0.67 × fck / γc = 0.67 × 25 / 1.5 = 11.17 MPa',
            values: {
              'fck': '25 MPa',
              'γc': '1.5',
              'fcd': '11.17 MPa',
              'fyd': '434.78 MPa',
            },
            reference: 'IS 456:2000 Cl. 38.1',
          },
          {
            title: 'Limiting Moment Capacity',
            description: 'Calculate maximum moment capacity for balanced section',
            formula: 'Mu,lim = 0.36 × fck × b × xu,max × (d - 0.42 × xu,max)',
            values: {
              'xu,max/d': '0.48 (Fe 500)',
              'xu,max': '216 mm',
              'd': '450 mm',
              'Mu,lim': '287.5 kN·m',
            },
            reference: 'IS 456:2000 Cl. 38.1, Annex G',
          },
          {
            title: 'Tension Reinforcement',
            description: 'Calculate required area of tension steel',
            formula: 'Ast = Mu / (0.87 × fy × (d - 0.42 × xu))',
            values: {
              'Mu': '200 kN·m',
              'xu': '119.4 mm',
              'Ast,required': '1156 mm²',
            },
            reference: 'IS 456:2000 Cl. 38.1',
          },
          {
            title: 'Shear Capacity Check',
            description: 'Check shear capacity of concrete section',
            formula: 'τv = Vu / (b × d) ≤ τc',
            values: {
              'Vu': '150 kN',
              'τv': '1.11 MPa',
              'pt': '0.86%',
              'τc': '0.62 MPa',
              'τc,max': '3.1 MPa',
            },
            reference: 'IS 456:2000 Cl. 40.2, Table 19',
          },
        ],
        codeChecks: [
          { clause: '26.5.1.1', description: 'Minimum tension reinforcement', required: '0.12%', provided: '0.86%', status: 'PASS' },
          { clause: '26.5.1.2', description: 'Maximum tension reinforcement', required: '≤ 4%', provided: '0.86%', status: 'PASS' },
          { clause: '40.1', description: 'Maximum shear stress', required: '≤ 3.1 MPa', provided: '1.11 MPa', status: 'PASS' },
          { clause: '23.2', description: 'Deflection limit (L/d)', required: '≥ 13.3', provided: '13.3', status: 'WARNING' },
          { clause: '26.3.1', description: 'Clear cover for moderate exposure', required: '≥ 30 mm', provided: '25 mm', status: 'FAIL' },
        ],
        warnings: [
          'Span-to-depth ratio is at the limit. Consider increasing beam depth.',
          'Clear cover is less than required for moderate exposure. Increase to 30mm.',
        ],
      };
      
      setResult(mockResult);
      setActiveTab('results');
      onCalculate?.(inputs, mockResult);
    } catch (error) {
      console.error('Calculation error:', error);
      setErrors({ _general: 'Calculation failed. Please check inputs.' });
    } finally {
      setIsCalculating(false);
    }
  }, [inputs, validateInputs, onCalculate]);
  
  // Available codes for selected calculation type
  const availableCodes = CALCULATION_TYPES[calculationType]?.codes || [];
  
  return (
    <div className={cn("bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator className="h-8 w-8 text-white" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Structural Calculator</h1>
              <p className="text-blue-100 text-sm">Industry-grade design calculations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <Settings className="h-5 w-5 text-slate-900 dark:text-white" />
            </button>
            <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <Download className="h-5 w-5 text-slate-900 dark:text-white" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Calculation Type & Code Selection */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Calculation Type
            </label>
            <select
              value={calculationType}
              onChange={(e) => {
                setCalculationType(e.target.value as CalculationType);
                const codes = CALCULATION_TYPES[e.target.value as CalculationType]?.codes || [];
                if (!codes.includes(designCode)) {
                  setDesignCode(codes[0]);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CALCULATION_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Design Code
            </label>
            <select
              value={designCode}
              onChange={(e) => setDesignCode(e.target.value as DesignCodeType)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              {availableCodes.map(code => (
                <option key={code} value={code}>
                  {DESIGN_CODES[code].name} ({DESIGN_CODES[code].country}, {DESIGN_CODES[code].year})
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {CALCULATION_TYPES[calculationType]?.description}
        </p>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px">
          {(['inputs', 'results', 'steps', 'checks'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              disabled={!result && tab !== 'inputs'}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                !result && tab !== 'inputs' && "opacity-50 cursor-not-allowed"
              )}
            >
              {tab === 'inputs' && 'Input Parameters'}
              {tab === 'results' && 'Results Summary'}
              {tab === 'steps' && 'Calculation Steps'}
              {tab === 'checks' && 'Code Checks'}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* Inputs Tab */}
          {activeTab === 'inputs' && (
            <motion.div
              key="inputs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {Object.entries(groupedFields).map(([group, fields]) => (
                <div key={group}>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    {group}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fields.map(field => (
                      <InputFieldComponent
                        key={field.name}
                        field={field}
                        value={inputs[field.name] ?? field.defaultValue}
                        onChange={handleInputChange}
                        error={errors[field.name]}
                      />
                    ))}
                  </div>
                </div>
              ))}
              
              {errors._general && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span>{errors._general}</span>
                </div>
              )}
              
              <div className="flex justify-end pt-4">
                <button
                  onClick={performCalculation}
                  disabled={isCalculating}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-slate-900 dark:text-white transition-all",
                    isCalculating
                      ? "bg-blue-400 cursor-wait"
                      : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
                  )}
                >
                  {isCalculating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-5 w-5" />
                      Calculate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
          
          {/* Results Tab */}
          {activeTab === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Summary Card */}
              <div className={cn(
                "p-6 rounded-xl border-2",
                result.isAdequate
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <StatusBadge status={result.status} />
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Design {result.isAdequate ? 'Passed' : 'Failed'}
                      </h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{result.message}</p>
                  </div>
                  <UtilizationGauge value={result.utilization} label="Utilization" />
                </div>
              </div>
              
              {/* Key Values */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Capacity</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.capacity}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">kN·m</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Demand</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.demand}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">kN·m</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Utilization</p>
                  <p className="text-2xl font-bold" style={{ color: result.utilization <= 1 ? '#22c55e' : '#ef4444' }}>
                    {(result.utilization * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">D/C Ratio</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Reserve</p>
                  <p className="text-2xl font-bold text-green-600">{((1 - result.utilization) * 100).toFixed(1)}%</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Safety Margin</p>
                </div>
              </div>
              
              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Warnings</h3>
                  </div>
                  <ul className="space-y-1">
                    {result.warnings.map((warning, i) => (
                      <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
          
          {/* Steps Tab */}
          {activeTab === 'steps' && result && (
            <motion.div
              key="steps"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Calculation Steps
                </h2>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <FileText className="h-4 w-4" />
                  Export PDF
                </button>
              </div>
              
              {result.steps.map((step, i) => (
                <CalculationStepDisplay key={i} step={step} index={i} />
              ))}
            </motion.div>
          )}
          
          {/* Code Checks Tab */}
          {activeTab === 'checks' && result && (
            <motion.div
              key="checks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Code Compliance Checks
                </h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {result.codeChecks.filter(c => c.status === 'PASS').length} Passed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    {result.codeChecks.filter(c => c.status === 'WARNING').length} Warnings
                  </span>
                  <span className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-red-500" />
                    {result.codeChecks.filter(c => c.status === 'FAIL').length} Failed
                  </span>
                </div>
              </div>
              
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <CodeCheckTable checks={result.codeChecks} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StructuralCalculator;
