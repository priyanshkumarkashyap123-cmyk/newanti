# Changelog

All notable changes to the "BeamLab Ultimate" project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-01-07 (Production Ready Release)

### Added

- **Frontend Pages**: Complete implementation of `ContactPage`, `AboutPage`, `TermsPage`, and `PrivacyPolicyPage`.
- **Interoperability**: Added PDF Design Reports, DXF (CAD) Export, and IFC (BIM) Export to the `ReportsPage`.
- **Deployment Scripts**: Added `scripts/deploy-production.sh` for automated Azure deployment.
- **Routing**: Full route integration in `App.tsx` for all new public pages.

### Fixed

- **Build System**: Resolved TypeScript syntax errors in `DiagramOverlay.tsx` and duplicated keys in `DiagramRenderer.tsx`.
- **Documentation**: Updated `executive_summary.md` and `walkthrough.md` to reflect "Feature Complete" status.
- **QA**: Confirmed clean production build (`npm run build`).

### Changed

- **Versioning**: Bumped project version to 2.1.0 to signify completion of the initial roadmap.
- **Status**: Project status updated to "Production Ready".

## [2.0.0] - 2025-12-31 (Major Architecture Update)

### Added

- **Rust Solver**: High-performance WASM-based structural solver for client-side analysis.
- **Advanced Dynamics**: Response Spectrum Analysis, Time History Analysis.
- **Design Codes**: ACI 318, Eurocode 2, BS 5950, AS 4100 integration.
- **Plate Elements**: Support for quad shell elements with thickness and material properties.

## [1.5.0] - 2025-12-15

### Added

- **Section Designer**: Custom section builder for I-beams, Channels, and built-up sections.
- **AI Integration**: Google Gemini integration for natural language model generation.

## [1.0.0] - 2025-11-01

### Initial Release

- Basic 3D modeling and analysis.
- PyNiteFEA backend integration.
- MongoDB project storage.
