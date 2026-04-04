/**
 * Report Profile System
 *
 * Defines preset report/view configurations for different use cases.
 * Each profile maps to specific sections and diagram inclusions.
 *
 * Sign Conventions & Load Case:
 * - BMD: Sagging (+), hogging (−) per IS 456 / ACI / EC2
 * - SFD: Right-hand rule per beam convention
 * - Default load case source: Currently selected load case from UI (activeLoadCaseId)
 */

/**
 * Report Profile Enum
 *
 * FULL_REPORT: Complete engineering documentation with all sections
 * OPTIMIZATION_SUMMARY: Compact summary for comparing design alternatives
 * SFD_BMD_ONLY: Minimal diagram-centric output for quick field/design review
 */
export enum ReportProfile {
  FULL_REPORT = 'FULL_REPORT',
  OPTIMIZATION_SUMMARY = 'OPTIMIZATION_SUMMARY',
  SFD_BMD_ONLY = 'SFD_BMD_ONLY',
}

/**
 * Section Toggle Specification per Profile
 *
 * Used by both frontend (to control UI rendering) and backend
 * (to determine which sections are included in exported report)
 */
export interface ProfileSectionConfig {
  include_cover_page: boolean;
  include_toc: boolean;
  include_input_summary: boolean;
  include_load_cases: boolean;
  include_load_combinations: boolean;
  include_node_displacements: boolean;
  include_member_forces: boolean;
  include_reaction_summary: boolean;
  include_analysis_results: boolean;
  include_design_checks: boolean;
  include_diagrams: boolean;
  include_concrete_design: boolean;
  include_foundation_design: boolean;
  include_connection_design: boolean;
}

/**
 * Diagram Toggle Specification per Profile
 *
 * Granular control over which diagram types are rendered and exported.
 * These flags are OR'd with the legacy include_diagrams for backward compatibility.
 */
export interface ProfileDiagramConfig {
  include_sfd: boolean;           // Shear Force Diagram (Vy—XY plane)
  include_bmd: boolean;           // Bending Moment Diagram (Mz—XY plane)
  include_deflection: boolean;    // Deflected shape
  include_afd: boolean;           // Axial Force Diagram (Fx)
  include_bmd_my: boolean;        // Weak-axis moment (My—XZ plane)
  include_shear_z: boolean;       // Weak-axis shear (Vz—XZ plane)
}

/**
 * Profile Specification
 *
 * Complete configuration for a report/view preset including sections, diagrams,
 * and loading context.
 */
export interface ReportProfileSpec {
  profile: ReportProfile;
  sections: ProfileSectionConfig;
  diagrams: ProfileDiagramConfig;
  /** Use currently selected load case from UI (activeLoadCaseId) instead of envelope? */
  use_selected_load_case: boolean;
  /** Minimal header metadata only (e.g., for SFD_BMD_ONLY)? */
  minimal_metadata: boolean;
  /** Human-readable label for UI display */
  label: string;
  /** Description for tooltip/help */
  description: string;
}

/**
 * Profile Mapping Definitions
 *
 * Centralized source of truth for all preset configurations.
 */
export const PROFILE_SPECS: Record<ReportProfile, ReportProfileSpec> = {
  [ReportProfile.FULL_REPORT]: {
    profile: ReportProfile.FULL_REPORT,
    sections: {
      include_cover_page: true,
      include_toc: true,
      include_input_summary: true,
      include_load_cases: true,
      include_load_combinations: true,
      include_node_displacements: true,
      include_member_forces: true,
      include_reaction_summary: true,
      include_analysis_results: true,
      include_design_checks: true,
      include_diagrams: true,
      include_concrete_design: true,
      include_foundation_design: true,
      include_connection_design: true,
    },
    diagrams: {
      include_sfd: true,
      include_bmd: true,
      include_deflection: true,
      include_afd: true,
      include_bmd_my: true,
      include_shear_z: true,
    },
    use_selected_load_case: true,
    minimal_metadata: false,
    label: 'Full Report',
    description: 'Complete engineering documentation with all sections and diagrams',
  },

  [ReportProfile.OPTIMIZATION_SUMMARY]: {
    profile: ReportProfile.OPTIMIZATION_SUMMARY,
    sections: {
      include_cover_page: true,
      include_toc: false,
      include_input_summary: true,
      include_load_cases: false,
      include_load_combinations: false,
      include_node_displacements: false,
      include_member_forces: false,
      include_reaction_summary: false,
      include_analysis_results: false,
      include_design_checks: true,
      include_diagrams: true,
      include_concrete_design: false,
      include_foundation_design: false,
      include_connection_design: false,
    },
    diagrams: {
      include_sfd: true,
      include_bmd: true,
      include_deflection: true,
      include_afd: false,
      include_bmd_my: false,
      include_shear_z: false,
    },
    use_selected_load_case: true,
    minimal_metadata: false,
    label: 'Optimization Summary',
    description: 'Design checks and primary diagrams for variant comparison',
  },

  [ReportProfile.SFD_BMD_ONLY]: {
    profile: ReportProfile.SFD_BMD_ONLY,
    sections: {
      include_cover_page: true,
      include_toc: false,
      include_input_summary: false,
      include_load_cases: false,
      include_load_combinations: false,
      include_node_displacements: false,
      include_member_forces: false,
      include_reaction_summary: false,
      include_analysis_results: false,
      include_design_checks: false,
      include_diagrams: true,
      include_concrete_design: false,
      include_foundation_design: false,
      include_connection_design: false,
    },
    diagrams: {
      include_sfd: true,
      include_bmd: true,
      include_deflection: false,
      include_afd: false,
      include_bmd_my: false,
      include_shear_z: false,
    },
    use_selected_load_case: true,
    minimal_metadata: true,
    label: 'SFD / BMD Only',
    description: 'Minimal diagram-focused output for quick field review or comparison',
  },
};

/**
 * Extract section config from profile
 */
export function getProfileSections(profile: ReportProfile): ProfileSectionConfig {
  return PROFILE_SPECS[profile].sections;
}

/**
 * Extract diagram config from profile
 */
export function getProfileDiagrams(profile: ReportProfile): ProfileDiagramConfig {
  return PROFILE_SPECS[profile].diagrams;
}

/**
 * Check if profile should use selected load case
 */
export function shouldUseSelectedLoadCase(profile: ReportProfile): boolean {
  return PROFILE_SPECS[profile].use_selected_load_case;
}

/**
 * Check if profile should use minimal metadata
 */
export function shouldUseMinimalMetadata(profile: ReportProfile): boolean {
  return PROFILE_SPECS[profile].minimal_metadata;
}

/**
 * Get profile label for UI
 */
export function getProfileLabel(profile: ReportProfile): string {
  return PROFILE_SPECS[profile].label;
}

/**
 * Get all profile options for selector
 */
export function getAllProfiles(): Array<{ value: ReportProfile; label: string; description: string }> {
  return Object.values(ReportProfile).map((profile) => ({
    value: profile as ReportProfile,
    label: PROFILE_SPECS[profile as ReportProfile].label,
    description: PROFILE_SPECS[profile as ReportProfile].description,
  }));
}
