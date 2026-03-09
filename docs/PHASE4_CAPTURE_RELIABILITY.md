/**
 * Phase 4: Capture/Render Reliability for SFD/BMD-Only Profile
 *
 * CONTEXT:
 * - Profile system applies diagram visibility flags to store (showSFD, showBMD, etc.)
 * - Store updates trigger React re-renders
 * - Diagrams are conditionally rendered based on store flags in SharedScene.tsx
 * - useReportCapture is called to capture visible diagram elements
 *
 * FLOW FOR SFD_BMD_ONLY PROFILE:
 * 1. User selects "SFD_BMD_ONLY" profile from ReportCustomizationDialog
 * 2. applyProfile() calls store.applyDiagramProfile('SFD_BMD_ONLY')
 * 3. Store sets: showSFD=true, showBMD=true, showAFD=false, showDeflectedShape=false
 * 4. React re-renders SharedScene with conditional diagram components visible
 * 5. html2canvas captures active #sfd, #bmd chart elements from DOM
 * 6. Captured images are embedded in PDF/DOCX report
 *
 * RELIABILITY CONSIDERATIONS:
 * ✓ IMPLEMENTED: Diagram elements are queried by ID (getElementById in captureCharts)
 * ✓ IMPLEMENTED: html2canvas scales to 2x resolution for print quality
 * ✓ IMPLEMENTED: gl.flush() + setTimeout ensure WebGL buffer is complete
 * ✓ IMPLEMENTED: Dark background (#1a1a24) matches BeamLab theme
 *
 * TODO (Future Enhancement):
 * [ ] Add explicit render-wait for SFD/BMD profile:
 *     - After applying profile, wait for MutationObserver to detect diagram DOM changes
 *     - Or add explicit requestAnimationFrame() / setTimeout() before capture
 * [ ] Verify DPI for print (currently 2x scale, may need calibration for 300 DPI)
 * [ ] Test with slow/degraded network (ensure diagrams fully load before capture)
 * [ ] Add error recovery for missing diagrams (fallback to diagram description)
 *
 * CURRENT STATUS:
 * - Capture pipeline is production-ready for typical environments
 * - No known issues with diagram capture for SFD_BMD_ONLY profile
 * - Sign conventions verified: BMD sagging (+), SFD right-hand rule
 *
 * FILES INVOLVED:
 * - apps/web/src/components/reporting/useReportCapture.ts (capture logic)
 * - apps/web/src/components/SharedScene.tsx (conditional diagram rendering)
 * - apps/web/src/store/model.ts (diagram visibility flags)
 * - apps/web/src/types/reportProfiles.ts (profile definitions)
 * - apps/backend-python/analysis/report_generator.py (PDF assembly)
 */
