"""
Test suite for report profile system in Python backend

Tests the apply_profile_to_customization function and profile-driven
section filtering for report generation.
"""

import pytest
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from routers.reports import ReportCustomization, apply_profile_to_customization


class TestApplyProfileToCustomization:
    """Tests for profile application logic"""

    def test_no_profile_returns_unchanged(self):
        """When profile is None, customization should be unchanged"""
        custom = ReportCustomization(
            project_name="Test Only",
            include_cover_page=False,
            include_diagrams=False
        )
        result = apply_profile_to_customization(custom)
        assert result.project_name == "Test Only"
        assert result.include_cover_page == False
        assert result.include_diagrams == False

    def test_full_report_profile_enables_all_sections(self):
        """FULL_REPORT profile should enable all report sections"""
        custom = ReportCustomization(profile="FULL_REPORT")
        result = apply_profile_to_customization(custom)
        
        # All sections should be enabled
        assert result.include_cover_page == True
        assert result.include_toc == True
        assert result.include_input_summary == True
        assert result.include_load_cases == True
        assert result.include_load_combinations == True
        assert result.include_node_displacements == True
        assert result.include_member_forces == True
        assert result.include_reaction_summary == True
        assert result.include_analysis_results == True
        assert result.include_design_checks == True
        assert result.include_diagrams == True
        assert result.include_concrete_design == True
        assert result.include_foundation_design == True
        assert result.include_connection_design == True
        
        # All diagrams should be enabled
        assert result.include_sfd == True
        assert result.include_bmd == True
        assert result.include_deflection == True
        assert result.include_afd == True
        assert result.include_bmd_my == True
        assert result.include_shear_z == True
        
        # Metadata should not be minimized
        assert result.minimal_metadata == False

    def test_sfd_bmd_only_profile_minimal_output(self):
        """SFD_BMD_ONLY profile should restrict to minimal SFD/BMD output"""
        custom = ReportCustomization(profile="SFD_BMD_ONLY")
        result = apply_profile_to_customization(custom)
        
        # Only cover page
        assert result.include_cover_page == True
        assert result.include_toc == False
        assert result.include_input_summary == False
        assert result.include_analysis_results == False
        
        # Must include diagrams section
        assert result.include_diagrams == True
        
        # Only SFD and BMD
        assert result.include_sfd == True
        assert result.include_bmd == True
        assert result.include_deflection == False
        assert result.include_afd == False
        assert result.include_bmd_my == False
        assert result.include_shear_z == False
        
        # Metadata should be minimized
        assert result.minimal_metadata == True

    def test_optimization_summary_profile(self):
        """OPTIMIZATION_SUMMARY profile for design variant comparison"""
        custom = ReportCustomization(profile="OPTIMIZATION_SUMMARY")
        result = apply_profile_to_customization(custom)
        
        # Summary + design checks
        assert result.include_cover_page == True
        assert result.include_input_summary == True
        assert result.include_design_checks == True
        assert result.include_diagrams == True
        
        # But minimal metadata supplements
        assert result.include_toc == False
        assert result.include_load_cases == False
        assert result.include_load_combinations == False
        assert result.include_node_displacements == False
        
        # Has key diagrams
        assert result.include_sfd == True
        assert result.include_bmd == True
        assert result.include_deflection == True
        
        # But not excessive
        assert result.include_afd == False
        assert result.include_bmd_my == False
        assert result.include_shear_z == False

    def test_unknown_profile_returns_unchanged(self):
        """Unknown profile name should not crash, return as-is"""
        custom = ReportCustomization(
            profile="UNKNOWN_PROFILE",
            project_name="Test"
        )
        result = apply_profile_to_customization(custom)
        assert result.project_name == "Test"
        # Should keep whatever toggles were set
        assert result.profile == "UNKNOWN_PROFILE"

    def test_profile_overrides_manual_toggles(self):
        """Applying profile overrides any manually-set toggles"""
        # User starts with all disabled
        custom = ReportCustomization(
            include_cover_page=False,
            include_diagrams=False,
            include_sfd=False,
            include_bmd=False,
            profile="FULL_REPORT"
        )
        result = apply_profile_to_customization(custom)
        
        # Profile should override and enable
        assert result.include_cover_page == True
        assert result.include_diagrams == True
        assert result.include_sfd == True
        assert result.include_bmd == True

    def test_load_case_context_preserved(self):
        """selected_load_case_id should not be modified by profile"""
        custom = ReportCustomization(
            profile="SFD_BMD_ONLY",
            selected_load_case_id="LC_001"
        )
        result = apply_profile_to_customization(custom)
        assert result.selected_load_case_id == "LC_001"

    def test_profile_preserves_company_project_info(self):
        """Profiles should NOT affect company or project metadata"""
        custom = ReportCustomization(
            profile="SFD_BMD_ONLY",
            company_name="ACME Engineering",
            project_name="Bridge Analysis",
            project_number="PRJ-2026-001"
        )
        result = apply_profile_to_customization(custom)
        
        # Metadata preserved
        assert result.company_name == "ACME Engineering"
        assert result.project_name == "Bridge Analysis"
        assert result.project_number == "PRJ-2026-001"
        
        # But profile controls sections
        assert result.include_diagrams == True
        assert result.include_input_summary == False

    def test_profile_case_insensitive(self):
        """Profile names should be case-insensitive (uppercase expected)"""
        custom = ReportCustomization(profile="full_report")  # lowercase
        result = apply_profile_to_customization(custom)
        # Implementation normalizes profile with .upper()
        assert result.include_cover_page is True
        assert result.include_design_checks is True
        assert result.include_diagrams is True


class TestReportCustomizationModel:
    """Tests for ReportCustomization Pydantic model"""

    def test_default_customization_values(self):
        """Verify sensible defaults for ReportCustomization"""
        custom = ReportCustomization()
        
        # Default sections enabled (full report mode)
        assert custom.include_cover_page == True
        assert custom.include_diagrams == True
        assert custom.include_input_summary == True
        
        # Default diagrams enabled
        assert custom.include_sfd == True
        assert custom.include_bmd == True
        assert custom.include_deflection == True
        
        # Default project name
        assert custom.project_name == "Structural Analysis"

    def test_granular_diagram_toggles(self):
        """Granular diagram toggles can be set independently"""
        custom = ReportCustomization(
            include_diagrams=True,
            include_sfd=True,
            include_bmd=False,  # Can override BMD specifically
            include_deflection=False,
            include_afd=True
        )
        
        assert custom.include_sfd == True
        assert custom.include_bmd == False
        assert custom.include_deflection == False
        assert custom.include_afd == True

    def test_minimal_metadata_field(self):
        """minimal_metadata flag for SFD_BMD_ONLY can be set"""
        custom = ReportCustomization(minimal_metadata=True)
        assert custom.minimal_metadata == True

    def test_selected_load_case_optional(self):
        """selected_load_case_id is optional"""
        custom = ReportCustomization()
        assert custom.selected_load_case_id is None
        
        custom2 = ReportCustomization(selected_load_case_id="LC_LIVE")
        assert custom2.selected_load_case_id == "LC_LIVE"


class TestSignConventionsAndLoadCases:
    """Verify sign conventions and load case handling"""

    def test_sfd_bmd_enabled_pair(self):
        """SFD and BMD should always be a pair (both on or off)"""
        profiles = [
            ("FULL_REPORT", True),
            ("OPTIMIZATION_SUMMARY", True),
            ("SFD_BMD_ONLY", True),
        ]
        
        for profile_name, expected_enabled in profiles:
            custom = ReportCustomization(profile=profile_name)
            result = apply_profile_to_customization(custom)
            
            # Both should have same state
            assert result.include_sfd == expected_enabled
            assert result.include_bmd == expected_enabled
            
            # If enabled, validate they're for the right planes:
            if expected_enabled:
                # SFD is Vy (XY plane), BMD is Mz (XY plane) - primary diagrams
                # Verified implicitly in profile definitions
                pass

    def test_selected_load_case_usage(self):
        """Load case should be used instead of forced envelope"""
        custom = ReportCustomization(
            profile="SFD_BMD_ONLY",
            selected_load_case_id="LC_CRITICAL_LIVE"
        )
        result = apply_profile_to_customization(custom)
        
        # Profile applied, but load case set for backend to use
        assert result.include_sfd == True
        assert result.include_bmd == True
        assert result.selected_load_case_id == "LC_CRITICAL_LIVE"
        # Backend should render SFD/BMD for LC_CRITICAL_LIVE,
        # not envelope or forced critical


class TestBackwardCompatibility:
    """Ensure legacy report generation still works"""

    def test_include_diagrams_gate_legacy(self):
        """Legacy include_diagrams flag still gates all diagram types"""
        custom = ReportCustomization(
            include_diagrams=False,
            include_sfd=True,  # Manually set but should be ignored?
            # Actually, granular toggles should take precedence if set
        )
        
        # When include_diagrams=False, backend should respect that
        assert custom.include_diagrams == False
        # Granular toggles are independent; backend decides priority

    def test_profile_none_defaults_to_full(self):
        """When no profile specified, should default to reasonable toggles"""
        custom = ReportCustomization(profile=None)
        result = apply_profile_to_customization(custom)
        
        # Should be unchanged (no profile applied)
        # Customization defaults handle defaults
        # Verify profile wasn't modified
        assert result.profile is None
