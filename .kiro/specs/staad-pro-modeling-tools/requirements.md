# Requirements Document

## Introduction

This feature brings Beamlab Ultimate's structural modeling workspace to parity with STAAD.Pro's
analytical modeling capabilities. The work covers three areas:

1. **Tool placement fixes** — existing panel components (BucklingAnalysisPanel, PDeltaAnalysisPanel,
   NonLinearAnalysisPanel, TimeHistoryPanel, DynamicsPanel, PlateResultsVisualization) are already
   implemented but are not wired into the main workspace toolbar. They must be registered as toolbar
   tools and connected via the existing `openModal` / custom-event dispatch pattern used throughout
   ModernModeler.tsx.

2. **Missing property-assignment tools** — the Properties toolbar section lacks tools for partial
   moment releases, tension/compression-only members, inactive members, diaphragm assignment,
   master/slave joints, and property reduction factors. These must be added to ToolGroups.ts and
   surfaced through new dialog components.

3. **Missing load generators, analysis types, post-processing tools, structure wizard templates,
   section builder enhancements, and design codes** — all identified from the STAAD.Pro research
   and confirmed absent from the current codebase.


## Glossary

- **Toolbar**: The `ModelingToolbar` component rendered inside `ModernModeler.tsx` that reads tool
  definitions from `ToolGroups.ts` and dispatches `openModal` calls or custom DOM events.
- **ToolGroups.ts**: The single source of truth for all `ToolDefinition` and `ToolGroup` records
  used by the toolbar.
- **ModalPortal**: The component that renders simple dialogs keyed by modal name from `uiStore`.
- **ModernModeler**: The top-level workspace component that wires toolbar tool activations to
  dialog open/close logic via `useEffect` + `activeTool` watch and DOM event listeners.
- **uiStore**: Zustand store that holds `modals` map and `activeTool` state.
- **ASSIGN_RELEASE**: Existing toolbar tool for full DOF member-end releases.
- **Partial_Release**: A member-end release where a moment DOF is reduced by a factor 0–1 rather
  than fully released (STAAD `$MP$` specification).
- **Tension_Only_Member**: A member that carries axial tension only; removed from the stiffness
  matrix when it would go into compression during iteration.
- **Compression_Only_Member**: A member that carries axial compression only.
- **Inactive_Member**: A member temporarily excluded from the stiffness assembly (phased
  construction, progressive collapse).
- **Diaphragm**: A rigid, semi-rigid, or flexible floor plate constraint linking nodes in a
  horizontal plane.
- **Master_Slave**: A kinematic constraint where slave node DOFs are expressed as rigid-body
  functions of a master node.
- **Property_Reduction_Factor**: Scalar multipliers RAX, RIX, RIY, RIZ applied to section
  properties to model cracked-section behaviour.
- **Floor_Load**: A two-way yield-line load distributed from a floor panel to surrounding beams.
- **Area_Load**: A one-way tributary-area load distributed to beams in a single direction.
- **Snow_Load**: A gravity load generated per ASCE 7 or IS 875 Part 4 snow provisions.
- **P-Delta**: Second-order geometric nonlinearity accounting for axial-force amplification of
  lateral displacements.
- **Imperfection_Analysis**: Direct analysis method per AISC 360 Chapter C using notional loads
  and reduced stiffness.
- **Pushover_Analysis**: Nonlinear static analysis with incremental lateral load and plastic-hinge
  formation.
- **Response_Spectrum_Analysis**: Modal superposition analysis using a design spectrum (SRSS/CQC).
- **Steady_State_Analysis**: Harmonic response analysis for rotating-machinery excitation.
- **Story_Drift**: Inter-story lateral displacement divided by story height, reported per floor.
- **Force_Envelope**: Maximum and minimum force/moment values across all load combinations at
  each section cut.
- **Section_Forces_At_Fraction**: Internal forces evaluated at user-specified fractional positions
  along a member (0.0–1.0), not only at nodes.
- **Mode_Shape_Animation**: Animated visualisation of a selected eigenvector scaled to a
  user-defined amplitude.
- **Built_Up_Section**: A composite cross-section assembled from two or more standard shapes
  (e.g., cover-plated I-section, box from channels).
- **Structure_Wizard**: The existing `StructureWizard.tsx` parametric template generator.
- **Section_Builder**: The existing `SectionDesignerDialog.tsx` custom cross-section tool.


## Requirements

---

### Requirement 1: Wire Existing Analysis Panels into the Toolbar

**User Story:** As a structural engineer, I want to access P-Delta, buckling, time history,
nonlinear, and dynamics analyses directly from the workspace toolbar, so that I do not have to
navigate away from the modeler to run advanced analyses.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `PDELTA_ANALYSIS` in the Analysis tool group that, when
   activated, opens `PDeltaAnalysisPanel` via the existing `openModal` mechanism.
2. THE Toolbar SHALL expose a tool entry `BUCKLING_ANALYSIS` in the Analysis tool group that, when
   activated, opens `BucklingAnalysisPanel` via the existing `openModal` mechanism.
3. THE Toolbar SHALL expose a tool entry `TIME_HISTORY_ANALYSIS` in the Analysis tool group that,
   when activated, opens `TimeHistoryPanel` via the existing `openModal` mechanism.
4. THE Toolbar SHALL expose a tool entry `NONLINEAR_ANALYSIS` in the Analysis tool group that,
   when activated, opens `NonLinearAnalysisPanel` via the existing `openModal` mechanism.
5. THE Toolbar SHALL expose a tool entry `DYNAMICS_PANEL` in the Analysis tool group that, when
   activated, opens `DynamicsPanel` via the existing `openModal` mechanism.
6. THE Toolbar SHALL expose a tool entry `PLATE_STRESS_CONTOUR` in the Analysis tool group that,
   when activated, opens `PlateResultsVisualization` via the existing `openModal` mechanism.
7. WHEN a user activates any of the six tools listed above without having run analysis first,
   THE Toolbar SHALL display a notification stating that analysis must be completed before
   viewing results, and SHALL NOT open the panel.
8. THE ToolGroups.ts file SHALL register all six new tool IDs with appropriate icons, labels,
   tooltips, and `category: 'ANALYSIS'`.

---

### Requirement 2: Partial Moment Release Tool

**User Story:** As a structural engineer, I want to assign partial moment releases to member ends,
so that I can model semi-rigid connections with a user-defined rotational stiffness reduction
factor.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ASSIGN_PARTIAL_RELEASE` in the Properties tool group.
2. WHEN `ASSIGN_PARTIAL_RELEASE` is activated and one or more members are selected, THE
   PartialReleaseDialog SHALL open showing the selected member IDs.
3. THE PartialReleaseDialog SHALL allow the user to specify, for each of the six DOFs (FX, FY,
   FZ, MX, MY, MZ) at the start end and end end, whether the DOF is: fully fixed, fully released,
   or partially released with a reduction factor.
4. WHEN partial release is chosen for a DOF, THE PartialReleaseDialog SHALL accept a reduction
   factor value in the range 0.001 to 0.999 inclusive.
5. IF the user enters a reduction factor outside the range 0.001–0.999, THEN THE
   PartialReleaseDialog SHALL display a validation error and SHALL NOT save the value.
6. WHEN the user confirms the dialog, THE Modeler SHALL store the partial release specification
   on each selected member in the model store.
7. THE Modeler SHALL visually distinguish members with partial releases from those with full
   releases in the analytical rendering mode.

---

### Requirement 3: Tension-Only and Compression-Only Member Specification

**User Story:** As a structural engineer, I want to mark members as tension-only or
compression-only, so that the solver can correctly model bracing elements and compression struts
that cannot carry the opposite force type.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ASSIGN_TENSION_ONLY` in the Properties tool group.
2. THE Toolbar SHALL expose a tool entry `ASSIGN_COMPRESSION_ONLY` in the Properties tool group.
3. WHEN `ASSIGN_TENSION_ONLY` is activated and one or more members are selected, THE Modeler
   SHALL mark those members as tension-only in the model store and SHALL display a confirmation
   notification.
4. WHEN `ASSIGN_COMPRESSION_ONLY` is activated and one or more members are selected, THE Modeler
   SHALL mark those members as compression-only in the model store and SHALL display a
   confirmation notification.
5. THE Modeler SHALL render tension-only members with a distinct visual indicator (dashed line or
   colour) in the analytical view.
6. THE Modeler SHALL render compression-only members with a distinct visual indicator different
   from tension-only members in the analytical view.
7. IF a member is already marked tension-only and the user activates `ASSIGN_COMPRESSION_ONLY`
   on it, THEN THE Modeler SHALL replace the tension-only flag with compression-only and SHALL
   notify the user of the change.

---

### Requirement 4: Inactive Member Specification

**User Story:** As a structural engineer, I want to mark members as inactive for specific load
cases, so that I can model phased construction sequences and progressive collapse scenarios.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ASSIGN_INACTIVE` in the Properties tool group.
2. WHEN `ASSIGN_INACTIVE` is activated and one or more members are selected, THE
   InactiveMemberDialog SHALL open.
3. THE InactiveMemberDialog SHALL allow the user to select which load cases the inactive
   specification applies to, or to apply it globally to all load cases.
4. WHEN the user confirms the dialog, THE Modeler SHALL store the inactive specification on each
   selected member in the model store.
5. THE Modeler SHALL render inactive members with a greyed-out or dashed visual style in the
   analytical view to distinguish them from active members.
6. WHEN analysis is run, THE Solver SHALL exclude inactive members from the stiffness assembly
   for the load cases to which the inactive specification applies.

---

### Requirement 5: Diaphragm Assignment Tool

**User Story:** As a structural engineer, I want to assign rigid, semi-rigid, or flexible
diaphragm constraints to floor nodes, so that I can correctly model lateral load distribution
in multi-story buildings.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ASSIGN_DIAPHRAGM` in the Properties tool group.
2. WHEN `ASSIGN_DIAPHRAGM` is activated and two or more nodes are selected, THE
   DiaphragmAssignmentDialog SHALL open.
3. THE DiaphragmAssignmentDialog SHALL allow the user to choose the diaphragm type: Rigid,
   Semi-Rigid, or Flexible.
4. THE DiaphragmAssignmentDialog SHALL allow the user to specify the diaphragm plane (XY, XZ,
   or YZ) and a story label.
5. WHEN the user confirms a Rigid diaphragm, THE Modeler SHALL constrain all selected nodes to
   move as a rigid body in the diaphragm plane (in-plane translations and rotation about the
   normal axis are coupled).
6. WHEN the user confirms a Semi-Rigid diaphragm, THE Modeler SHALL store the semi-rigid
   specification for use by the solver, which applies in-plane stiffness reduction.
7. THE Modeler SHALL display diaphragm assignments as a shaded floor plate overlay in the
   analytical view.
8. THE Modeler SHALL calculate and display the center of rigidity for each Rigid diaphragm after
   analysis is complete.

---

### Requirement 6: Master/Slave Joint Specification

**User Story:** As a structural engineer, I want to define master/slave joint constraints between
nodes, so that I can model rigid connections between structural elements that share DOFs without
duplicating nodes.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ASSIGN_MASTER_SLAVE` in the Properties tool group.
2. WHEN `ASSIGN_MASTER_SLAVE` is activated and exactly two or more nodes are selected, THE
   MasterSlaveDialog SHALL open.
3. THE MasterSlaveDialog SHALL allow the user to designate one node as the master and the
   remaining nodes as slaves.
4. THE MasterSlaveDialog SHALL allow the user to select which DOFs (FX, FY, FZ, MX, MY, MZ) are
   coupled between master and slave nodes.
5. WHEN the user confirms the dialog, THE Modeler SHALL store the master/slave constraint in the
   model store.
6. IF fewer than two nodes are selected when `ASSIGN_MASTER_SLAVE` is activated, THEN THE
   Modeler SHALL display an error notification and SHALL NOT open the dialog.

---

### Requirement 7: Property Reduction Factors Tool

**User Story:** As a structural engineer, I want to apply property reduction factors to member
cross-sections, so that I can model cracked-section behaviour for reinforced concrete members
under seismic or serviceability conditions.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ASSIGN_PROPERTY_REDUCTION` in the Properties tool
   group.
2. WHEN `ASSIGN_PROPERTY_REDUCTION` is activated and one or more members are selected, THE
   PropertyReductionDialog SHALL open.
3. THE PropertyReductionDialog SHALL allow the user to specify reduction factors for: RAX
   (axial area), RIX (torsional inertia), RIY (weak-axis bending inertia), and RIZ (strong-axis
   bending inertia).
4. WHEN a reduction factor is specified, THE PropertyReductionDialog SHALL accept values in the
   range 0.01 to 1.00 inclusive.
5. IF the user enters a reduction factor outside the range 0.01–1.00, THEN THE
   PropertyReductionDialog SHALL display a validation error and SHALL NOT save the value.
6. WHEN the user confirms the dialog, THE Modeler SHALL store the reduction factors on each
   selected member in the model store.
7. THE Modeler SHALL display a visual indicator on members that have property reduction factors
   applied, distinguishable in the analytical view.


---

### Requirement 8: Floor Load Generator

**User Story:** As a structural engineer, I want to generate floor loads using a two-way
yield-line distribution algorithm, so that slab panel loads are automatically distributed to
the surrounding beams without manual tributary-area calculations.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ADD_FLOOR_LOAD` in the Loading tool group.
2. WHEN `ADD_FLOOR_LOAD` is activated, THE FloorLoadDialog SHALL open.
3. THE FloorLoadDialog SHALL allow the user to define a floor panel by selecting four or more
   boundary beam members that form a closed polygon.
4. THE FloorLoadDialog SHALL accept a uniform floor pressure in kN/m².
5. THE FloorLoadDialog SHALL allow the user to choose the distribution method: two-way
   yield-line or one-way (specify direction).
6. WHEN the user confirms the dialog, THE Modeler SHALL compute the distributed line loads on
   each boundary beam using the selected algorithm and SHALL add those loads to the active load
   case.
7. THE Modeler SHALL display the computed beam line loads as load arrows on the boundary beams
   in the load visualisation view.
8. IF the selected boundary members do not form a closed polygon, THEN THE FloorLoadDialog
   SHALL display a validation error and SHALL NOT generate loads.

---

### Requirement 9: Area Load / One-Way Load Generator

**User Story:** As a structural engineer, I want to generate one-way tributary area loads on
beams, so that roof or floor loads spanning in a single direction are correctly distributed.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ADD_AREA_LOAD` in the Loading tool group.
2. WHEN `ADD_AREA_LOAD` is activated, THE AreaLoadDialog SHALL open.
3. THE AreaLoadDialog SHALL allow the user to specify a pressure in kN/m², a span direction
   (X or Z global axis), and a set of beams to receive the load.
4. WHEN the user confirms the dialog, THE Modeler SHALL compute the tributary width for each
   selected beam and SHALL apply the resulting UDL to each beam in the active load case.
5. THE Modeler SHALL display the computed UDLs as load arrows on the selected beams.

---

### Requirement 10: Snow Load Generator

**User Story:** As a structural engineer, I want to generate snow loads per ASCE 7 or IS 875
Part 4, so that roof snow accumulation is automatically converted to member loads.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ADD_SNOW_LOAD` in the Loading tool group.
2. WHEN `ADD_SNOW_LOAD` is activated, THE SnowLoadDialog SHALL open.
3. THE SnowLoadDialog SHALL allow the user to select the governing code: ASCE 7-22 or IS 875
   Part 4.
4. WHERE ASCE 7-22 is selected, THE SnowLoadDialog SHALL accept: ground snow load (pg), exposure
   factor (Ce), thermal factor (Ct), importance factor (Is), and roof slope.
5. WHERE IS 875 Part 4 is selected, THE SnowLoadDialog SHALL accept: basic snow load, shape
   coefficient, and exposure reduction factor.
6. WHEN the user confirms the dialog, THE Modeler SHALL compute the design roof snow load and
   SHALL apply it as a UDL to all selected roof members in the active load case.
7. THE Modeler SHALL display the computed snow loads as downward load arrows on the roof members.

---

### Requirement 11: Response Spectrum Analysis Tool

**User Story:** As a structural engineer, I want to run response spectrum analysis from the
workspace toolbar, so that I can obtain seismic design forces using modal superposition without
leaving the modeler.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `RESPONSE_SPECTRUM_ANALYSIS` in the Analysis tool group.
2. WHEN `RESPONSE_SPECTRUM_ANALYSIS` is activated, THE ResponseSpectrumDialog SHALL open.
3. THE ResponseSpectrumDialog SHALL allow the user to select the design spectrum: IS 1893:2016,
   ASCE 7-22, or EN 1998-1.
4. THE ResponseSpectrumDialog SHALL allow the user to specify the modal combination method:
   SRSS or CQC.
5. THE ResponseSpectrumDialog SHALL allow the user to specify the number of modes to include
   and the direction factors (X, Y, Z scale factors).
6. WHEN the user runs the analysis, THE Solver SHALL perform response spectrum analysis and
   SHALL store the modal combination results in the model store.
7. WHEN response spectrum analysis is complete, THE Modeler SHALL display the combined base
   shear, story forces, and maximum member forces in the results panel.
8. IF modal analysis has not been run before response spectrum analysis is requested, THEN THE
   ResponseSpectrumDialog SHALL display a warning and SHALL run modal analysis automatically
   before proceeding.

---

### Requirement 12: Pushover Analysis Tool

**User Story:** As a structural engineer, I want to run pushover analysis from the workspace
toolbar, so that I can assess the nonlinear lateral capacity of a structure without navigating
to a separate page.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `PUSHOVER_ANALYSIS` in the Analysis tool group.
2. WHEN `PUSHOVER_ANALYSIS` is activated, THE PushoverAnalysisDialog SHALL open (wiring the
   existing `PushoverAnalysisPage` logic into a modal dialog).
3. THE PushoverAnalysisDialog SHALL allow the user to specify: load pattern (uniform, triangular,
   or modal), target displacement or drift limit, and plastic hinge properties.
4. WHEN the user runs pushover analysis, THE Solver SHALL incrementally apply lateral loads,
   form plastic hinges at member ends, and track the base shear vs. roof displacement curve.
5. WHEN pushover analysis is complete, THE Modeler SHALL display the capacity curve (pushover
   curve) and the performance point in the results panel.
6. IF the structure becomes a mechanism before reaching the target displacement, THEN THE Solver
   SHALL stop the analysis and SHALL report the collapse load and mechanism configuration.

---

### Requirement 13: Steady State / Harmonic Response Analysis Tool

**User Story:** As a structural engineer, I want to run steady-state harmonic response analysis
from the workspace toolbar, so that I can assess structural response to rotating machinery
excitation.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `STEADY_STATE_ANALYSIS` in the Analysis tool group.
2. WHEN `STEADY_STATE_ANALYSIS` is activated, THE SteadyStateDialog SHALL open.
3. THE SteadyStateDialog SHALL allow the user to specify: excitation frequency range (Hz),
   frequency step, damping ratio, and the node and DOF where the harmonic force is applied.
4. WHEN the user runs the analysis, THE Solver SHALL compute the steady-state amplitude and
   phase response at each frequency step.
5. WHEN steady-state analysis is complete, THE Modeler SHALL display the frequency-response
   function (amplitude vs. frequency) for user-selected nodes and DOFs.

---

### Requirement 14: Imperfection Analysis Tool

**User Story:** As a structural engineer, I want to run imperfection analysis per AISC 360
Chapter C direct analysis method, so that I can account for initial out-of-plumbness and
reduced stiffness without separate notional load calculations.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `IMPERFECTION_ANALYSIS` in the Analysis tool group.
2. WHEN `IMPERFECTION_ANALYSIS` is activated, THE ImperfectionAnalysisDialog SHALL open.
3. THE ImperfectionAnalysisDialog SHALL allow the user to specify: notional load coefficient
   (default 0.002 per AISC 360), stiffness reduction factor (default 0.8), and the load cases
   to which the notional loads are applied.
4. WHEN the user confirms the dialog, THE Modeler SHALL add notional lateral loads to the
   specified load cases and SHALL flag the analysis as a direct analysis method run.
5. WHEN analysis is run with imperfection settings active, THE Solver SHALL apply the reduced
   stiffness (0.8EI, 0.8EA) and the notional loads simultaneously.


---

### Requirement 15: Story Drift Post-Processing Tool

**User Story:** As a structural engineer, I want to view inter-story drift ratios after analysis,
so that I can verify compliance with code drift limits without manually computing floor
displacements.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `VIEW_STORY_DRIFT` in the Analysis tool group.
2. WHEN `VIEW_STORY_DRIFT` is activated after a completed analysis, THE StoryDriftPanel SHALL
   open.
3. THE StoryDriftPanel SHALL display a table of story labels, story heights, absolute lateral
   displacements, and inter-story drift ratios for each load case or combination.
4. THE StoryDriftPanel SHALL highlight rows where the drift ratio exceeds the code limit
   specified by the user (default H/400 for wind, H/200 for seismic).
5. IF analysis has not been run when `VIEW_STORY_DRIFT` is activated, THEN THE Modeler SHALL
   display a notification and SHALL NOT open the panel.
6. THE StoryDriftPanel SHALL allow the user to export the drift table as a CSV file.

---

### Requirement 16: Force Envelope Post-Processing Tool

**User Story:** As a structural engineer, I want to view force envelopes across all load
combinations, so that I can identify the governing design forces for each member without
manually scanning individual combination results.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `VIEW_FORCE_ENVELOPE` in the Analysis tool group.
2. WHEN `VIEW_FORCE_ENVELOPE` is activated after a completed analysis, THE ForceEnvelopePanel
   SHALL open.
3. THE ForceEnvelopePanel SHALL display, for each selected member, the maximum and minimum
   values of axial force, shear (Vy, Vz), torsion, and bending moment (My, Mz) across all
   defined load combinations.
4. THE ForceEnvelopePanel SHALL identify the governing load combination for each force component.
5. THE ForceEnvelopePanel SHALL allow the user to export the envelope table as a CSV file.
6. IF no load combinations are defined, THEN THE ForceEnvelopePanel SHALL display the envelope
   across individual load cases.

---

### Requirement 17: Section Forces at Fractional Lengths

**User Story:** As a structural engineer, I want to query internal forces at arbitrary fractional
positions along a member, so that I can check forces at locations other than the member ends
without adding intermediate nodes.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `VIEW_SECTION_FORCES` in the Analysis tool group.
2. WHEN `VIEW_SECTION_FORCES` is activated and a member is selected after analysis, THE
   SectionForcesPanel SHALL open.
3. THE SectionForcesPanel SHALL allow the user to specify up to 20 fractional positions along
   the member (values 0.0 to 1.0 inclusive, where 0.0 is the start node and 1.0 is the end
   node).
4. THE SectionForcesPanel SHALL display the axial force, shear forces (Vy, Vz), torsion, and
   bending moments (My, Mz) at each specified fractional position for the active load case.
5. THE SectionForcesPanel SHALL display the results as both a table and as overlaid markers on
   the member diagram in the viewport.
6. IF a fractional position value outside 0.0–1.0 is entered, THEN THE SectionForcesPanel SHALL
   display a validation error and SHALL NOT compute results for that position.

---

### Requirement 18: Mode Shape Animation Tool

**User Story:** As a structural engineer, I want to animate mode shapes after modal analysis,
so that I can visually inspect the deformation pattern of each vibration mode.

#### Acceptance Criteria

1. THE Toolbar SHALL expose a tool entry `ANIMATE_MODE_SHAPE` in the Analysis tool group.
2. WHEN `ANIMATE_MODE_SHAPE` is activated after modal analysis, THE ModeShapeAnimationPanel
   SHALL open.
3. THE ModeShapeAnimationPanel SHALL list all computed modes with their natural frequencies
   and mass participation ratios.
4. WHEN the user selects a mode, THE Viewport SHALL animate the structure oscillating in that
   mode shape at a user-adjustable speed and amplitude scale factor.
5. THE ModeShapeAnimationPanel SHALL allow the user to pause, resume, and step through the
   animation frame by frame.
6. IF modal analysis has not been run when `ANIMATE_MODE_SHAPE` is activated, THEN THE Modeler
   SHALL display a notification and SHALL NOT open the panel.

---

### Requirement 19: Diaphragm Center of Rigidity Output

**User Story:** As a structural engineer, I want to view the center of rigidity for each rigid
diaphragm after analysis, so that I can assess torsional eccentricity and accidental torsion
requirements.

#### Acceptance Criteria

1. WHEN a rigid diaphragm is defined and analysis is complete, THE Modeler SHALL compute the
   center of rigidity (CR) for each diaphragm.
2. THE Modeler SHALL display the CR as a labelled marker in the viewport at the diaphragm
   elevation.
3. THE Modeler SHALL display the distance between the center of mass (CM) and the center of
   rigidity (CR) for each diaphragm in the results panel.
4. THE Modeler SHALL include the CM-CR eccentricity values in the generated calculation report.

---

### Requirement 20: Structure Wizard — Additional Truss Templates

**User Story:** As a structural engineer, I want to generate Fink, North Light, King Post, Queen
Post, and Scissors truss templates from the Structure Wizard, so that I can quickly create
common roof truss geometries without manual node placement.

#### Acceptance Criteria

1. THE Structure_Wizard SHALL include the following additional truss templates: Fink, North
   Light, King Post, Queen Post, and Scissors.
2. WHEN a user selects any of the five new truss templates, THE Structure_Wizard SHALL display
   parametric inputs appropriate to that truss type (span, rise, panel count, pitch angle).
3. WHEN the user confirms the inputs, THE Structure_Wizard SHALL generate the truss geometry
   with correctly connected nodes and members in the model store.
4. THE Structure_Wizard SHALL include a Cylindrical Frame template that accepts radius, height,
   number of bays around the circumference, and number of stories.
5. THE Structure_Wizard SHALL include a Spherical Surface template that accepts radius, number
   of meridional divisions, and number of parallel divisions.
6. WHEN the user confirms a Cylindrical Frame or Spherical Surface template, THE
   Structure_Wizard SHALL generate the corresponding 3D node and member geometry.

---

### Requirement 21: Built-Up Section Tool

**User Story:** As a structural engineer, I want to create built-up cross-sections by combining
standard shapes, so that I can model cover-plated beams, box sections from channels, and other
composite sections without manual property calculation.

#### Acceptance Criteria

1. THE Section_Builder SHALL include a "Built-Up Section" mode accessible from the existing
   `SECTION_BUILDER` toolbar tool.
2. WHEN Built-Up Section mode is selected, THE Section_Builder SHALL allow the user to add two
   or more standard shapes (I-section, channel, angle, plate) and position each shape by
   specifying its centroid offset from a reference point.
3. THE Section_Builder SHALL compute the combined section properties (area, Ixx, Iyy, Ixy,
   centroid location, torsional constant) from the constituent shapes.
4. THE Section_Builder SHALL display the assembled cross-section as a 2D outline in the preview
   pane.
5. WHEN the user saves the built-up section, THE Section_Builder SHALL add it to the project
   section library and make it available for assignment via `ASSIGN_SECTION`.
6. THE Section_Builder SHALL validate that no two constituent shapes overlap; IF overlap is
   detected, THEN THE Section_Builder SHALL display a warning and SHALL highlight the
   overlapping shapes.

---

### Requirement 22: Additional Design Codes

**User Story:** As a structural engineer working on international projects, I want to select
from a broader set of design codes, so that I can perform code-compliant design checks for
projects in China, UK, Japan, Russia, Canada, and other jurisdictions.

#### Acceptance Criteria

1. THE Design_Codes configuration SHALL include the following additional steel codes: GB 50017
   (China), BS 5950 (UK legacy), AIJ (Japan), SNiP 2.23-81 (Russia), AASHTO LRFD (bridge
   steel), and US Aluminum AA ADM1.
2. THE Design_Codes configuration SHALL include the following additional concrete codes: CSA
   A23.3 (Canada), SP 52-101-2003 (Russia), and IS 13920 (India seismic ductile detailing).
3. THE Design_Codes configuration SHALL include EC5 (Eurocode 5 Timber) as a new timber
   category.
4. WHEN a user selects any of the new codes in the Design Codes dialog, THE Modeler SHALL
   apply the corresponding load factors, resistance factors, and section classification rules
   to the design check.
5. WHERE a new code is added but full design check implementation is deferred, THE Modeler
   SHALL display the code as available with a "Beta" badge and SHALL perform basic utilization
   ratio checks using the code's primary interaction equation.

---

### Requirement 23: Toolbar Organisation and Tool Placement Audit

**User Story:** As a structural engineer, I want all tools to appear in logically organised
toolbar sections, so that I can find the right tool quickly without searching through
unrelated groups.

#### Acceptance Criteria

1. THE Toolbar Properties section SHALL contain exactly the following tools in order:
   ASSIGN_SECTION, ASSIGN_MATERIAL, ASSIGN_RELEASE, ASSIGN_PARTIAL_RELEASE,
   ASSIGN_OFFSET, ASSIGN_CABLE_PROPS, ASSIGN_SPRING, ASSIGN_MASS, MEMBER_ORIENTATION,
   ASSIGN_SUPPORT, ASSIGN_TENSION_ONLY, ASSIGN_COMPRESSION_ONLY, ASSIGN_INACTIVE,
   ASSIGN_DIAPHRAGM, ASSIGN_MASTER_SLAVE, ASSIGN_PROPERTY_REDUCTION, SECTION_BUILDER.
2. THE Toolbar Loading section SHALL contain exactly the following tools in order:
   ADD_POINT_LOAD, ADD_MOMENT, ADD_UDL, ADD_TRAPEZOID, ADD_WIND, ADD_SEISMIC,
   ADD_SNOW_LOAD, ADD_FLOOR_LOAD, ADD_AREA_LOAD, ADD_PRETENSION, ADD_TEMPERATURE,
   ADD_MOVING_LOAD, ADD_HYDROSTATIC, ADD_SELF_WEIGHT, LOAD_COMBINATIONS.
3. THE Toolbar Analysis section SHALL contain exactly the following tools in order:
   RUN_ANALYSIS, PDELTA_ANALYSIS, BUCKLING_ANALYSIS, NONLINEAR_ANALYSIS,
   IMPERFECTION_ANALYSIS, RESPONSE_SPECTRUM_ANALYSIS, TIME_HISTORY_ANALYSIS,
   STEADY_STATE_ANALYSIS, PUSHOVER_ANALYSIS, DYNAMICS_PANEL, MODAL_ANALYSIS,
   VIEW_DEFORMED, VIEW_REACTIONS, VIEW_SFD, VIEW_BMD, PLATE_STRESS_CONTOUR,
   ANIMATE_MODE_SHAPE, VIEW_STORY_DRIFT, VIEW_FORCE_ENVELOPE, VIEW_SECTION_FORCES.
4. THE ToolGroups.ts file SHALL not contain duplicate tool IDs across any group.
5. WHEN a tool is moved from one group to another, THE Toolbar SHALL reflect the new grouping
   without requiring a page reload.

