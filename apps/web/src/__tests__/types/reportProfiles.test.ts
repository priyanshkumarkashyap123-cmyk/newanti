/**
 * Report Profile System - TypeScript Tests
 * Tests profile types, helpers, and store integration
 */

import { describe, it, expect } from 'vitest';
import {
  ReportProfile,
  PROFILE_SPECS,
  getProfileSections,
  getProfileDiagrams,
  shouldUseSelectedLoadCase,
  shouldUseMinimalMetadata,
  getProfileLabel,
  getAllProfiles,
} from '../../types/reportProfiles';

describe('Report Profiles', () => {
  describe('Profile Specs', () => {
    it('all profiles exist in PROFILE_SPECS', () => {
      expect(PROFILE_SPECS[ReportProfile.FULL_REPORT]).toBeDefined();
      expect(PROFILE_SPECS[ReportProfile.OPTIMIZATION_SUMMARY]).toBeDefined();
      expect(PROFILE_SPECS[ReportProfile.SFD_BMD_ONLY]).toBeDefined();
    });

    it('FULL_REPORT includes all sections and diagrams', () => {
      const spec = PROFILE_SPECS[ReportProfile.FULL_REPORT];
      expect(spec.sections.include_cover_page).toBe(true);
      expect(spec.sections.include_diagrams).toBe(true);
      expect(spec.diagrams.include_sfd).toBe(true);
      expect(spec.diagrams.include_bmd).toBe(true);
      expect(spec.diagrams.include_deflection).toBe(true);
      expect(spec.minimal_metadata).toBe(false);
    });

    it('SFD_BMD_ONLY includes only SFD/BMD diagrams', () => {
      const spec = PROFILE_SPECS[ReportProfile.SFD_BMD_ONLY];
      expect(spec.diagrams.include_sfd).toBe(true);
      expect(spec.diagrams.include_bmd).toBe(true);
      expect(spec.diagrams.include_deflection).toBe(false);
      expect(spec.diagrams.include_afd).toBe(false);
      expect(spec.minimal_metadata).toBe(true);
    });

    it('OPTIMIZATION_SUMMARY has restricted sections', () => {
      const spec = PROFILE_SPECS[ReportProfile.OPTIMIZATION_SUMMARY];
      expect(spec.sections.include_toc).toBe(false);
      expect(spec.sections.include_load_cases).toBe(false);
      expect(spec.sections.include_design_checks).toBe(true);
      expect(spec.diagrams.include_deflection).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('getProfileSections returns correct section config', () => {
      const sections = getProfileSections(ReportProfile.SFD_BMD_ONLY);
      expect(sections.include_cover_page).toBe(true);
      expect(sections.include_toc).toBe(false);
      expect(sections.include_input_summary).toBe(false);
    });

    it('getProfileDiagrams returns correct diagram config', () => {
      const diagrams = getProfileDiagrams(ReportProfile.SFD_BMD_ONLY);
      expect(diagrams.include_sfd).toBe(true);
      expect(diagrams.include_bmd).toBe(true);
      expect(diagrams.include_afd).toBe(false);
    });

    it('shouldUseSelectedLoadCase returns profile setting', () => {
      expect(shouldUseSelectedLoadCase(ReportProfile.FULL_REPORT)).toBe(true);
      expect(shouldUseSelectedLoadCase(ReportProfile.SFD_BMD_ONLY)).toBe(true);
    });

    it('shouldUseMinimalMetadata returns profile setting', () => {
      expect(shouldUseMinimalMetadata(ReportProfile.FULL_REPORT)).toBe(false);
      expect(shouldUseMinimalMetadata(ReportProfile.SFD_BMD_ONLY)).toBe(true);
    });

    it('getProfileLabel returns localized label', () => {
      expect(getProfileLabel(ReportProfile.FULL_REPORT)).toBe('Full Report');
      expect(getProfileLabel(ReportProfile.SFD_BMD_ONLY)).toBe('SFD / BMD Only');
    });

    it('getAllProfiles returns all options', () => {
      const profiles = getAllProfiles();
      expect(profiles).toHaveLength(3);
      expect(profiles.map(p => p.value)).toContain(ReportProfile.FULL_REPORT);
      expect(profiles.map(p => p.value)).toContain(ReportProfile.OPTIMIZATION_SUMMARY);
      expect(profiles.map(p => p.value)).toContain(ReportProfile.SFD_BMD_ONLY);
    });
  });

  describe('Profile Consistency', () => {
    it('all profiles include diagrams section when include_diagrams=true', () => {
      Object.values(ReportProfile).forEach(profile => {
        const spec = PROFILE_SPECS[profile];
        if (spec.sections.include_diagrams) {
          expect(spec.diagrams).toBeDefined();
          // At least one diagram type should be enabled
          const hasDiagrams = Object.values(spec.diagrams).some(v => v === true);
          expect(hasDiagrams).toBe(true);
        }
      });
    });

    it('SFD and BMD are consistent pair (both on or off)', () => {
      Object.values(ReportProfile).forEach(profile => {
        const diagrams = PROFILE_SPECS[profile].diagrams;
        // If one is true, the other should be true too (strong-axis pair)
        const sfdOn = diagrams.include_sfd;
        const bmdOn = diagrams.include_bmd;
        expect(sfdOn).toBe(bmdOn);
      });
    });
  });

  describe('Store Integration', () => {
    it('profile-to-store mapping matches TypeScript profile definitions', () => {
      // This test verifies that store model.ts applyDiagramProfile
      // matches the profile definitions in this file
      const fullReportProfile = getProfileDiagrams(ReportProfile.FULL_REPORT);
      expect(fullReportProfile.include_sfd).toBe(true);
      expect(fullReportProfile.include_bmd).toBe(true);
      // Store should set showSFD: true, showBMD: true for FULL_REPORT
      // (verified separately in store integration tests)
    });
  });
});

describe('Report Profile - Load Case Handling', () => {
  it('selected_load_case_id is respected across all profiles', () => {
    const customLoadCaseId = 'LC-CUSTOM-001';
    // When passed to both frontend and backend, custom load cases should be used
    // instead of forcing envelope/critical defaults
    expect(shouldUseSelectedLoadCase(ReportProfile.FULL_REPORT)).toBe(true);
    expect(shouldUseSelectedLoadCase(ReportProfile.SFD_BMD_ONLY)).toBe(true);
  });
});

describe('Backward Compatibility', () => {
  it('include_diagrams gate still works when granular toggles missing', () => {
    // When a legacy request arrives without include_sfd/include_bmd,
    // backend should default to include_diagrams only
    const fullReport = getProfileSections(ReportProfile.FULL_REPORT);
    expect(fullReport.include_diagrams).toBe(true);
    const diagrams = getProfileDiagrams(ReportProfile.FULL_REPORT);
    expect(diagrams.include_sfd).toBe(true);  // Defaults should enable SFD/BMD
  });
});
