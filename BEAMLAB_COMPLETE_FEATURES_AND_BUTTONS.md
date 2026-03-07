# BeamLab Ultimate - Complete Features & Navigation Guide
**Thursday, 6 March 2026**

---

## 1. LANDING PAGE (Home Page)

### Header Navigation
- **Logo & Branding**: "BeamLab" display at top left corner with professional logo
- **Navigation Links** (Center):
  - Features (scrolls to #features section)
  - Pricing (links to pricing page)
  - Docs/Help (links to help center)
  - Demo (launches demo modeler)
  - About (company information)
  - Contact (contact form)
  
- **Authentication Buttons** (Top Right):
  - Log In button → takes to sign-in page
  - Get Started button (primary CTA) → takes to sign-up page
  - Mobile menu toggle (hamburger icon on small screens)

### Hero Section (First Look)
**Bold Statement Display**:
- "The Future of Structural Analysis is Here"
- "AI-Powered 3D Structural Engineering"
- "Join 10,000+ Engineers Building Smarter"

**Call-to-Action Buttons**:
- Start Free Trial (primary blue button)
- Watch Demo Video (secondary button)
- View Pricing (link)

**Feature Highlights** (Stat cards):
- "200+ Engineering Features"
- "10,000+ Active Engineers"
- "99.9% Uptime Guaranteed"
- "50+ Design Codes"

### Features Showcase Section (#features)
**12 Main Feature Cards** with icons and descriptions:

1. **3D Frame Analysis**
   - Full 6-DOF analysis with biaxial bending
   - Support reactions table
   - 12×12 3D stiffness matrices

2. **Transparent Analysis**
   - Step-by-step calculations
   - Member releases
   - Full formula traceability

3. **AI-Powered Design**
   - Natural language input (Gemini AI)
   - Smart modifications
   - Auto optimization

4. **Professional Reports**
   - SFD/BMD/AFD diagrams
   - Reactions & deflections
   - CSV & PDF export

5. **Advanced Loads & P-Delta**
   - UDL, triangular, trapezoidal loads
   - Member end releases
   - Load combinations

6. **Large Structures**
   - 10K+ members support
   - Sparse matrix solvers
   - WebGPU acceleration

7. **Indian Design Codes**
   - IS 800 steel design
   - IS 456 RC design
   - IS 1893 seismic

8. **Real-time Collaboration**
   - Live multi-user editing
   - Comments & annotations
   - Version history

9. **Cloud Native**
   - Auto-save & backup
   - Access anywhere
   - No data loss

10. **BIM Integration**
    - IFC import/export
    - Revit sync
    - STAAD import

11. **Section Database**
    - IS sections built-in
    - AISC & EU sections
    - Custom profiles

12. **Works on Any Device**
    - Desktop & tablet
    - Mobile review mode
    - Touch-optimized

### Pricing Section
**Three Pricing Tiers** (cards with feature comparison):

1. **Academic & Hobbyist** - ₹0 forever
   - Up to 3 active projects
   - 2D beam & frame analysis
   - Basic load combinations
   - Standard PDF reports
   - Button: "Start Learning Free"

2. **Professional** - ₹999/month (₹799/month yearly)
   - Unlimited projects
   - Full 3D nonlinear analysis
   - All international design codes
   - P-Delta, buckling & modal analysis
   - AI-powered design assistant
   - Custom branded reports
   - Button: "Start 14-Day Free Trial"

3. **Enterprise** - ₹1,999/month (₹1,599/month yearly)
   - Everything in Professional
   - Up to 10 team members
   - Advanced team sharing
   - Admin dashboard
   - REST API access
   - Button: "Contact Sales"

### Screenshots Gallery
- Model visualization renders
- Analysis result diagrams (BMD, SFD)
- Design output tables
- Report preview samples

### Footer Section
**Navigation Links**:
- Features
- Pricing
- Help & Docs
- About Us
- Contact
- Blog
- Careers

**Legal Links**:
- Privacy Policy
- Terms of Service
- Terms & Conditions
- Refund & Cancellation Policy

**Social Media Icons**:
- LinkedIn
- Twitter
- GitHub
- YouTube

---

## 2. PROJECT DASHBOARD (Stream Page)

### Top Navigation Bar
**Left Side**:
- BeamLab logo (clickable - returns to dashboard)
- Current page breadcrumb

**Center**:
- Global search bar (⌘K shortcut)
  - "Search pages, features, help..."
  - Searches across projects, features, documentation

**Right Side**:
- Notifications bell icon (shows alerts)
- Help icon (quick help access)
- User profile dropdown:
  - Account Settings
  - Billing & Subscription
  - Sign Out

### Main Dashboard Content

**Quick Action Buttons** (Top):
- New Project (primary blue button)
- Import Project (upload file)
- Templates (show template gallery)

**Project Filter Tabs**:
- All Projects
- Recent
- Shared with Me
- Archived
- Favorites (starred)

**Sort & View Controls**:
- Sort dropdown: (Latest, Name A-Z, Modified Date)
- View toggle: Grid view / List view
- Filter by: (Type, Status, Code Standard)

**Project Cards** (for each project):
Display:
- Project thumbnail/preview
- Project name (editable inline)
- Last modified date
- Design code badge (IS 456, ACI 318, etc.)
- Status badge (Draft, Analysis Done, Designed)
- Quick stats (members count, load cases)

**Context Menu** (three-dot menu on each card):
- Open Project
- Rename
- Duplicate
- Export (.json, .dxf)
- Share
- Archive
- Delete

**Project Templates Gallery**:
- Blank Project
- Simple Beam
- 2D Frame
- 3D Frame
- Truss Bridge
- Building Frame
- Staircase
- Industrial Shed

### Side Statistics Panel
- Total Projects: X
- Active Projects: Y
- Storage Used: Z GB
- Analysis Credits: Available

---

## 3. PROJECT INITIALIZATION WIZARD

**Before Modeling - User Must Configure**:

### Step 1: Project Information
**Input Fields**:
- Project Name (text input)
- Client Name (text input)
- Project Location (text input)
- Engineer Name (auto-filled from profile)
- Revision Number (auto-increment)
- Project Date (date picker)

**Buttons**:
- Next (proceed to step 2)
- Cancel (return to dashboard)

### Step 2: Design Code Selection
**Radio Button Groups**:
- Concrete Design Cod savae:
  - IS 456:2000 (Indian pani Standard)
  - ACI 318 (American)
  - BS 8110 (British)
  - Eurocode 2
  
- Steel Design Code:
  - IS 800:2007 (Indian Standard)
  - AISC 360 (American)
  - BS 5950 (British)
  - Eurocode 3

- Seismic Code:
  - IS 1893 (Indian)
  - ASCE 7
  - Eurocode 8

- Wind Code:
  - IS 875 Part 3
  - ASCE 7
  - AS/NZS 1170

**Buttons**:
- Back
- Next

### Step 3: Unit System Selection
**Radio Button Options**:
- SI (Metric): kN, m, mm
- SI (Metric): N, mm
- Imperial: kip, ft, in
- Imperial: lb, in

**Note Display**: "All formulas and calculations will adapt to your selected unit system"

**Buttons**:
- Back
- Next

### Step 4: Material Library
**Default Materials Available** (checkboxes to include):
- Concrete:
  - M20 (20 MPa)
  - M25 (25 MPa)
  - M30 (30 MPa)
  - M35, M40, M45, M50
  - Custom (user-defined)

- Steel:
  - Fe 415 (Indian TMT bars)
  - Fe 500
  - Grade 250 structural steel
  - Grade 350
  - Custom alloy

**Add Custom Material Button**:
Opens dialog with inputs:
- Material name
- Density
- Elastic modulus (E)
- Poisson's ratio
- Yield strength
- Ultimate strength

**Buttons**:
- Back
- Create Project & Start Modeling

---

## 4. MODELING WORKSPACE (3D Modeler - /app)

### Top Application Bar
**Left Side**:
- BeamLab logo
- Project name (editable)
- Auto-save indicator: "Saved 2 min ago"

**Right Side**:
- View mode toggle: 2D / 3D / Isometric
- Render mode dropdown:
  - Wireframe
  - Solid
  - Analytical
  - Rendered
- Full Screen button
- Settings gear icon
- User menu

### Primary Tab Navigation (Main Feature Tabs)
**Horizontal Tab Bar** (click to switch between major features):
1. **GEOMETRY** (modeling tools)
2. **PROPERTIES** (materials & sections)
3. **LOADING** (loads & load cases)
4. **ANALYSIS** (run analysis & results)
5. **DESIGN** (member design & optimization)

**Active tab displays its specific tools in the left sidebar**

---

### 4.1 GEOMETRY TAB

#### Left Sidebar Tools (when Geometry tab active)

**SELECTION TOOLS**:
- Select (pointer tool) - Shortcut: Esc
- Box Select (rectangle selection) - Shortcut: Shift+S
- Select Node
- Select Beam/Member
- Select Plate/Shell
- Select by Level (Z-coordinate)
- Select by Material
- Select Parallel To (select parallel members)
- Select by Property
- Select by Group
- Invert Selection
- Select All - Shortcut: Ctrl+A
- Deselect All

**DRAW TOOLS** (with icon buttons):
- Add Node - Shortcut: N
  - Click to place
  - Enter coordinates (X, Y, Z)
  
- Add Beam - Shortcut: B
  - Click two nodes to connect
  - Draw continuous beams
  
- Add Column - Shortcut: V
  - Vertical member tool
  
- Add Cable - Shortcut: C
  - Tension-only element
  
- Add Arch - Shortcut: A
  - Parabolic arch
  - Circular arch
  
- Add Rigid Link
  - Master-slave constraint
  
- Add Plate/Shell - Shortcut: P
  - 3-node or 4-node plate

**EDIT TOOLS**:
- Copy - Shortcut: Ctrl+C
- Paste - Shortcut: Ctrl+V
- Mirror
  - Mirror about X-axis
  - Mirror about Y-axis
  - Mirror about Z-axis
  - Mirror about custom plane
  
- Rotate - Shortcut: R
  - About X/Y/Z axis
  - Custom angle
  
- Move/Translate - Shortcut: M
  - Move in X/Y/Z
  - Move by distance
  
- Scale
  - Uniform scaling
  - Non-uniform (X, Y, Z separate)
  
- Delete - Shortcut: Del
- Split Member (divide at point)
- Divide Member (equal segments)
  - Number of divisions input
  
- Merge Nodes (coincident nodes)
- Align Nodes
  - Align to line
  - Align to plane
  
- Offset Member
  - Parallel offset
  - Perpendicular offset
  
- Extrude
  - Extrude nodes to create beams
  - Extrude lines to create plates

**ARRAY TOOLS** (parametric generation):
- Linear Array
  - Number of copies
  - Spacing (dx, dy, dz)
  
- Polar Array (Circular)
  - Center point
  - Number of copies
  - Total angle (360° for full circle)
  
- 3D Array (Box)
  - Copies in X, Y, Z directions
  - Spacing for each direction

**STRUCTURE GENERATORS** (one-click complete structures):
- Grid Generate (2D rectangular grid)
  - Bays in X direction
  - Bays in Y direction
  - Bay width X
  - Bay width Y
  
- 3D Grid Generator
  - X, Y, Z divisions
  - Story height
  
- Circular Grid
  - Radius
  - Number of radial lines
  - Number of rings
  
- Truss Generator
  - Truss type: Pratt, Warren, Howe, K-Truss
  - Span length
  - Number of panels
  - Height
  
- Arch Generator
  - Span
  - Rise
  - Number of segments
  - Type: Parabolic / Circular
  
- Frame Generator (Building)
  - Number of stories
  - Number of bays X
  - Number of bays Y
  - Story height
  - Bay width X, Y
  
- Staircase Generator
  - Flight type: Straight, L-shaped, U-shaped, Spiral
  - Number of steps
  - Tread, Riser dimensions
  
- Bridge Deck Generator
  - Span length
  - Deck width
  - Girder spacing
  
- Transmission Tower Generator
  - Tower height
  - Base width
  - Top width
  - Bracing pattern
  
- Cable Pattern Generator (Cable-stayed/Suspension)
  - Tower height
  - Span
  - Cable spacing
  - Sag

**MEASURE TOOLS**:
- Measure Distance (between two points)
- Measure Angle (three points)
- Measure Area (polygon selection)
- Member Length Query
- Coordinates Display

**SNAP & GRID SETTINGS** (toggle buttons):
- Snap to Grid
- Snap to Node
- Snap to Midpoint
- Snap to Intersection
- Snap to Perpendicular
- Snap to Nearest Point
- Grid Display (show/hide)
- Grid Spacing (input: 1m, 0.5m, etc.)
- Ortho Mode (constrain to X/Y/Z axes)

**UTILITIES**:
- Renumber Nodes
  - Automatic renumbering
  - Custom start number
  
- Renumber Members
- Check Geometry
  - Duplicate nodes check
  - Disconnected members check
  - Coincident members check
  
- Member Query (info about selected member)
- Group Management
  - Create Group
  - Add to Group
  - Remove from Group
  - Select Group

**UNDO/REDO**:
- Undo - Shortcut: Ctrl+Z
- Redo - Shortcut: Ctrl+Y
- History Panel (show all actions)

#### Bottom Status Bar (Geometry Mode)
- Coordinate Display: X: 0.00 Y: 0.00 Z: 0.00 (current cursor position)
- Current Coordinate System: Global / Local
- Snap Status: Grid ON, Node ON
- Selection Count: "5 nodes, 8 members selected"
- Model Statistics: "Total: 120 nodes, 200 members"

---

### 4.2 PROPERTIES TAB

#### Left Sidebar Tools (when Properties tab active)

**MATERIAL ASSIGNMENT**:
- Select Material (dropdown list)
  - Shows all materials from project initialization
  - M25 Concrete
  - Fe 415 Steel
  - Custom materials
  
- Assign to Selected Members (button)
- Assign Parallel To (select one, assign to all parallel)
- Select by Material (filter/highlight)
- Edit Material Properties (opens dialog):
  - Name
  - Density (kN/m³)
  - Elastic Modulus E (GPa)
  - Poisson's Ratio
  - Thermal Coefficient
  - Yield Stress
  - Ultimate Stress
  - Color (for visualization)
  
- Add New Material (button)
- Material Library Browser
  - Filter by: Concrete, Steel, Timber, Aluminum, Custom
  - Favorites section

**SECTION DATABASE** (comprehensive library):
Button: "Open Section Database"

Opens modal with:
- **Search/Filter Panel**:
  - Section Type dropdown:
    - I-Sections (ISMB, W-shapes, IPE, HE, UB, UC)
    - Channel (ISMC, C-shapes, UPN, PFC)
    - Angle (ISA, L-shapes, Equal/Unequal)
    - Rectangular Hollow (RHS, SHS)
    - Circular Hollow (CHS, Pipe)
    - T-Sections
    - Rectangular Solid
    - Circular Solid
    - Custom/User-Defined
  
  - Standard dropdown:
    - IS (Indian Standard)
    - AISC (American)
    - BS (British)
    - EN (European - IPE, HEA, HEB)
    - JIS (Japanese)
    - Custom
  
  - Size Range filters:
    - Depth (min-max)
    - Width (min-max)
    - Weight (min-max)

- **Section Table** (scrollable list):
  Columns displayed:
  - Designation (e.g., ISMB 450, W14x30)
  - Depth (mm or in)
  - Width (mm or in)
  - Area (cm² or in²)
  - Ixx (moment of inertia major axis)
  - Iyy (moment of inertia minor axis)
  - J (torsional constant)
  - Zxx, Zyy (section moduli)
  - Weight per meter
  - Preview icon (mini cross-section diagram)
  
  **Table Actions**:
  - Sort by any column (click header)
  - Select row (highlight)
  - View Details (opens detailed property sheet)
  - Assign to Selected Members (button)
  - Add to Favorites (star icon)

- **Custom Section Builder**:
  Button: "Create Custom Section"
  
  Opens editor with:
  - Section Type selection:
    - Built-up I-Section (specify flange & web dims)
    - Arbitrary Polygon (draw outline)
    - Composite Section (multiple materials)
  
  - Input Parameters (for built-up):
    - Overall Depth
    - Flange Width
    - Flange Thickness
    - Web Thickness
    - Corner radius
  
  - Properties Auto-Calculation displays:
    - Area
    - Centroid location
    - Ixx, Iyy, J
    - Plastic moduli
  
  - Preview Window (live section preview)
  - Calculate Properties (button)
  - Save to Library (button with name input)

**SECTION ASSIGNMENT TO MEMBERS**:
- Current Section Display (shows assigned section)
- Select Section from Database (button)
- Assign to Selected Members (button)
- Section Orientation
  - Default orientation (about X-axis)
  - Rotate about member axis: 0°, 90°, 180°, 270°, Custom
  - Rotation angle input
  
- Member Offset Specifications:
  - Offset Type: Centroidal / Top / Bottom / Custom
  - Y-offset (perpendicular to member)
  - Z-offset (perpendicular to member)
  
- Member Releases (End Fixity):
  Button: "Set Member Releases"
  
  Opens dialog with:
  - Start Node Releases (checkboxes):
    - Fx (axial)
    - Fy (shear Y)
    - Fz (shear Z)
    - Mx (torsion)
    - My (bending major)
    - Mz (bending minor)
  
  - End Node Releases (same checkboxes)
  - Preset configurations:
    - Simply Supported (My, Mz released both ends)
    - Cantilever (all fixed start, all released end)
    - Truss Member (all moments released)
  
  - Apply button
  - Cancel button

**SUPPORT/BOUNDARY CONDITIONS**:
- Add Support (button)
  - Click nodes to apply
  
- Support Type Selection:
  - Fixed (all DOF restrained)
  - Pinned (translations restrained, rotations free)
  - Roller (vertical translation restrained)
  - Custom (select individual DOF)
  
- Restraint Checkboxes (for custom):
  - Tx (translation X)
  - Ty (translation Y)
  - Tz (translation Z)
  - Rx (rotation X)
  - Ry (rotation Y)
  - Rz (rotation Z)
  
- Support Spring Stiffness (optional):
  - Enable Spring Support (checkbox)
  - Kx, Ky, Kz (spring stiffness values)
  - Rotational spring stiffness
  
- Edit Support (for existing supports)
- Delete Support
- Show All Supports (filter/highlight)
- Support Symbol Size (slider for visualization)

**CROSS-SECTION PROPERTIES TABLE**:
Display panel showing current member properties:
- Member ID
- Section Designation
- Material
- Area
- Ixx, Iyy, Izz, J
- Section Modulus Zxx, Zyy
- Plastic Modulus
- Radius of Gyration

**MEMBER PROPERTIES BULK EDIT**:
- Select Multiple Members (from canvas)
- Assign Same Section (button)
- Assign Same Material (button)
- Copy Properties From (select source member)

---

### 4.3 LOADING TAB

#### Left Sidebar Tools (when Loading tab active)

**LOAD CASE MANAGEMENT**:
- **Create New Load Case** (button)
  
  Opens dialog with:
  - Load Case Name (text input)
  - Load Type dropdown:
    - Dead Load (DL)
    - Live Load (LL)
    - Roof Live Load (RLL)
    - Snow Load (SL)
    - Wind Load (WL)
    - Earthquake Load (EQX, EQY, EQZ)
    - Temperature (TEMP)
    - Soil Pressure
    - Hydrostatic
    - Construction Load
    - Impact
    - Custom
  
  - Load Category:
    - Static
    - Dynamic
    - Moving Load
  
  - Self-Weight Multiplier:
    - Include Self-Weight (checkbox)
    - Multiplier (default 1.0)
    - Direction: -Y (gravity), -Z, Custom
  
  - Create Load Case (button)

- **Load Case List** (shows all defined load cases):
  For each load case:
  - Name badge (color-coded by type)
  - Visibility toggle (eye icon - show/hide on canvas)
  - Active checkbox (for current editing)
  - Edit button (rename, modify type)
  - Delete button
  - Duplicate button

**POINT LOADS** (Nodal Loads):
- Add Point Load (button)
  
  Configuration Panel:
  - Select Load Case (dropdown)
  - Select Node(s) (click on canvas or type node numbers)
  
  - Force Components:
    - Fx (kN) - input field
    - Fy (kN) - input field  
    - Fz (kN) - input field
  
  - Moment Components:
    - Mx (kN·m) - input field
    - My (kN·m) - input field
    - Mz (kN·m) - input field
  
  - Coordinate System:
    - Global
    - Local (member-aligned)
  
  - Apply (button)
  - Clear (button)

- Edit Point Load (select existing load)
- Delete Point Load
- Show Point Load Values (label toggle)

**MEMBER LOADS** (Distributed & Other):
- Add Member Load (button)
  
  Load Type Selection:
  - **Uniformly Distributed Load (UDL)**:
    - Direction: Global X, Y, Z / Local x, y, z / Projected (gravity)
    - Magnitude (kN/m): input field
    - Start Position (% of length): 0-100%
    - End Position (% of length): 0-100%
    
  - **Uniformly Varying Load (UVL/Triangular)**:
    - Direction dropdown
    - Start Magnitude (kN/m)
    - End Magnitude (kN/m)
    - Start Position (%)
    - End Position (%)
  
  - **Trapezoidal Load**:
    - Direction dropdown
    - Load at Start (kN/m)
    - Load at End Position 1 (kN/m)
    - Load at End Position 2 (kN/m)
    - Load at End (kN/m)
    - Start %, End1 %, End2 %, End %
  
  - **Point Load on Member** (anywhere on beam):
    - Location (distance from start or % of length)
    - Magnitude Fx, Fy, Fz (kN)
    - Moments Mx, My, Mz (kN·m)
  
  - **Temperature Load**:
    - Temperature Change (°C)
    - Temperature Gradient (top-bottom)
  
  - **Member Self-Weight**:
    - Multiplier (default 1.0)
    - Direction
  
  - **Prestress Load**:
    - Prestress Force (kN)
    - Eccentricity (mm)

- Select Load Case (dropdown)
- Select Member(s) (highlight on canvas)
- Apply Load (button)
- Member Load Table (list all loads on members)
  - Filter by load case
  - Edit/Delete actions

**AREA LOADS** (for Plate/Shell elements):
- Add Area Load (button)
  - Select plates
  - Pressure (kN/m²)
  - Direction: Normal to plate / Global direction
  - Apply button

**STANDARD LOAD DEFINITIONS** (Code-based):
Button: "Apply Code Loads"

Opens wizard:
- **Seismic Load (IS 1893 / ASCE 7)**:
  - Zone Factor (II, III, IV, V for IS 1893)
  - Soil Type (I, II, III)
  - Importance Factor
  - Response Reduction Factor (R)
  - Building Height
  - Time Period (auto-calculate or manual)
  - Direction: +X, -X, +Y, -Y
  - Generate Seismic Loads (button)
  - Creates EQX+ and EQX- load cases automatically

- **Wind Load (IS 875 Part 3 / ASCE 7)**:
  - Basic Wind Speed (m/s or mph)
  - Terrain Category (1, 2, 3, 4)
  - Building Dimensions (height, width, depth)
  - Exposure coefficients
  - Gust factor
  - Direction: +X, -X, +Y, -Y
  - Generate Wind Loads (button)
  - Creates WLX and WLY cases

- **Live Load Patterns**:
  - Floor Live Load (Residential, Office, Storage, etc.)
  - Load value (kN/m²)
  - Reduction factors
  - Pattern: Checkerboard, Alternate spans

**LOAD COMBINATIONS**:
Button: "Define Load Combinations"

Opens Load Combination Manager:
- **Combination List** (shows all defined):
  - Combination Name
  - Type: Service, Ultimate (Factored), Seismic
  - Formula display
  - Active (checkbox)
  - Edit/Delete buttons

- **Create Combination** (button):
  Opens dialog:
  - Combination Name (input)
  - Combination Type (dropdown):
    - Service (unfactored)
    - Ultimate Limit State (factored per code)
    - Seismic
    - Wind
    - Custom
  
  - **Load Factor Input**:
    For each load case, input multiplier:
    - DL: [1.5] ×
    - LL: [1.5] ×
    - EQX: [0.0] ×
    - WLX: [0.0] ×
    ... (all defined load cases)
  
  - Preset Combinations (quick buttons):
    - 1.5 DL + 1.5 LL (IS 456)
    - 1.2 DL + 1.6 LL (ACI)
    - 1.0 DL ± 1.0 EQ (Seismic)
    - Custom
  
  - Auto-Generate All Combinations (button)
    - Generates all code-required combinations per selected standard
  
  - Save Combination (button)

- **Import Combinations**:
  - From Code Template: IS 456, ACI 318, Eurocode
  - From File (.json)

**MOVING LOAD**:
- Button: "Define Moving Load"
  - Vehicle Load Pattern:
    - IRC Class A, AA (Indian roads)
    - AASHTO truck
    - Railway loading (Cooper E-loading)
  - Path definition (select members forming path)
  - Live load train configuration
  - Run Influence Line Analysis (button)

**LOAD VISUALIZATION SETTINGS**:
- Show Load Arrows (toggle)
- Load Vector Scale (slider)
- Load Label Size (slider)
- Color by Load Case (toggle)
- Show Load Values (toggle)

**LOAD SUMMARY TABLE**:
Display panel showing:
- Total number of load cases
- Total nodal loads
- Total member loads
- Total load combinations
- Quick stats per load case

---

### 4.4 ANALYSIS TAB

#### Left Sidebar Tools (when Analysis tab active)

**ANALYSIS SETTINGS**:
Button: "Analysis Settings"

Opens configuration dialog:
- **Analysis Type** (radio buttons):
  - Linear Static (default)
  - P-Delta (2nd order geometric nonlinearity)
  - Nonlinear Static (material + geometric)
  - Modal Analysis (dynamic eigenvalues)
  - Response Spectrum (seismic)
  - Time History (earthquake time record)
  - Buckling Analysis (eigenvalue buckling)
  - Pushover Analysis (performance-based)
  - Cable Analysis (catenary sag)
  - Construction Sequence
  - Moving Load Analysis

- **Solver Options**:
  - Solver Type: Direct (Sparse LU) / Iterative (Conjugate Gradient)
  - Convergence Tolerance: 1e-6 (default)
  - Max Iterations: 100
  - Use GPU Acceleration (checkbox, if available)
  - Use Rust WebAssembly Solver (checkbox - 20-100x faster)

- **P-Delta Settings** (if P-Delta selected):
  - Max Iterations: 20
  - Convergence Criteria: Force/Displacement
  - Tolerance: 0.001

- **Modal Analysis Settings**:
  - Number of Modes: [10]
  - Frequency Range (Hz): Min / Max
  - Mass Source: From Material Density / User-Defined
  - Cutoff Frequency

- **Time History Settings**:
  - Load History File (upload .csv or .txt)
  - Time step (sec)
  - Duration (sec)
  - Damping ratio (%)
  - Integration method: Newmark-Beta / Wilson-Theta

- **Buckling Settings**:
  - Number of Buckling Modes: [5]
  - Load case for Pre-stress

- Apply Settings (button)
- Restore Defaults (button)

**PRE-ANALYSIS CHECKS**:
Panel displays automated checks:
- ✓ Geometry valid (no disconnected members)
- ✓ All members have sections assigned
- ✓ All members have materials assigned
- ✓ Support conditions defined
- ✓ Loads applied
- ✓ Load combinations defined
- ⚠ Warnings (if any):
  - "5 members without sections"
  - "No supports detected - model is unstable"

Button: "Run Checks" (re-validate)

**RUN ANALYSIS**:
Large Primary Button: **"RUN ANALYSIS"** (green/blue)

Clicking shows:
- Progress bar: "Running linear analysis..."
- Status messages:
  - "Assembling stiffness matrix... (25%)"
  - "Factorizing matrix... (50%)"
  - "Solving for displacements... (75%)"
  - "Computing member forces... (90%)"
  - "Analysis complete ✓ (100%)"

- Analysis Log (collapsible):
  - Number of nodes: 120
  - Number of elements: 200
  - DOF count: 720
  - Total stiffness size: 720 × 720
  - Non-zero entries: 5,420 (sparse)
  - Solver time: 0.34 seconds
  - Result computation: 0.12 seconds
  - Total time: 0.46 seconds

- Button: "View Results" (enabled after successful analysis)

**ADVANCED ANALYSIS BUTTONS** (after basic analysis):
- **Modal Analysis** → opens modal analysis panel
  - Displays mode shapes (animation)
  - Frequency table (Hz)
  - Mass participation factors
  - Export mode shapes

- **P-Delta Analysis** → runs 2nd order analysis
  - Iteration log display
  - Convergence plot
  - Compare with linear results

- **Buckling Analysis** → eigenvalue buckling
  - Critical load factors
  - Buckling mode shapes (animated)
  - Effective length factors

- **Pushover Analysis** → nonlinear static
  - Load-displacement curve (capacity curve)
  - Hinge formation sequence
  - Performance point (ATC-40, FEMA 356)

- **Time History** → dynamic analysis
  - Earthquake record upload
  - Time-displacement graph
  - Max response table

- **Cable Analysis** → catenary analysis for cables
  - Sag computation
  - Tension distribution
  - Unstressed length

- **Sensitivity & Optimization** → parameter study
  - Design variable selection
  - Objective function (minimize weight, max stiffness)
  - Optimization algorithm
  - Results comparison

#### ANALYSIS RESULTS PANEL (Right Side)

**Results Navigator Tabs**:
1. **Support Reactions**
2. **Member Forces**
3. **Displacements**
4. **Diagrams** (BMD, SFD, AFD)
5. **Advanced Results**
6. **Design Code Check**

---

##### Results Tab 1: SUPPORT REACTIONS

**Load Case Selector** (dropdown):
- Select load case or combination to view
- DL, LL, EQ, Combo1, Combo2, etc.

**Support Reactions Table**:
Columns:
- Node ID
- Fx (kN) - Horizontal reaction X
- Fy (kN) - Vertical reaction Y
- Fz (kN) - Horizontal reaction Z
- Mx (kN·m) - Moment about X
- My (kN·m) - Moment about Y
- Mz (kN·m) - Moment about Z

Table Actions:
- Sort by column (click header)
- Filter by node range
- Export to CSV (button)
- Export to PDF (button)
- Copy to Clipboard (button)

**Equilibrium Check Display**:
- ΣFx = 0.00 ✓
- ΣFy = 0.00 ✓
- ΣFz = 0.00 ✓
- ΣMx = 0.00 ✓
- ΣMy = 0.00 ✓
- ΣMz = 0.00 ✓

Status: **"Structure is in equilibrium"** ✓

**Export Reactions**:
- Export as Table (PDF)
- Export as CSV
- Print Report

---

##### Results Tab 2: MEMBER FORCES

**Load Case Selector** (dropdown)

**Member Forces Table**:
Columns:
- Member ID
- Start Node - End Node
- Axial Force P (kN)
  - Tension (+) / Compression (-)
- Shear Vy (kN)
- Shear Vz (kN)
- Torsion T (kN·m)
- Moment My (kN·m) - Major axis bending
- Moment Mz (kN·m) - Minor axis bending
- Max Utilization Ratio (%)

**Force Display Options**:
- Show at: Member Start / End / Max
- Units: kN, kN·m / lbf, lb·ft
- Coordinate System: Global / Local

**Filter/Sort**:
- Filter by member range
- Sort by: Member ID / Max Force / Utilization
- Show only: Tension / Compression / Critical

**Member Detail View**:
Click any member → shows detailed force variation:
- Force diagram along length
- Max/min values with location
- Force envelope (for combinations)

**Export Member Forces**:
- Export Table (CSV, Excel)
- Export Summary Report (PDF)
- Copy Selected Rows

---

##### Results Tab 3: DISPLACEMENTS

**Load Case Selector** (dropdown)

**Nodal Displacements Table**:
Columns:
- Node ID
- Ux (mm) - Translation X
- Uy (mm) - Translation Y (deflection)
- Uz (mm) - Translation Z
- Rx (rad) - Rotation X
- Ry (rad) - Rotation Y
- Rz (rad) - Rotation Z
- Resultant (mm) - √(Ux² + Uy² + Uz²)

**Display Options**:
- Show: Translations / Rotations / Both
- Deformed Shape Scale: [slider] 1x to 100x
- Exaggerate Deformations (checkbox)
- Show Undeformed (overlay)
- Animation: Static / Animate (play deformed shape)

**Max Displacement Summary**:
- Max Ux: 12.5 mm at Node 45
- Max Uy: 35.2 mm at Node 78
- Max Uz: 8.1 mm at Node 23
- Max Resultant: 37.6 mm at Node 78

**Deflection Limits Check** (code-based):
- Beam Deflections:
  - Span/250 (service) - IS 456
  - Span/350 (total) - IS 456
  - Status: Pass / Fail for each member
- Drift Limits (for frames):
  - Story drift < H/500 (IS 1893)
  - Status per story

**Export Displacements**:
- Export Table (CSV)
- Export Deformed Shape (image .png)
- Export Animation (.gif, .mp4)

**Canvas Visualization**:
- Button: "Show Deformed Shape"
  - Overlays deformed structure on canvas
  - Color-coded by displacement magnitude
  - Scale control slider

---

##### Results Tab 4: DIAGRAMS (Force Diagrams)

**Diagram Type Selector** (tabs):
- Shear Force Diagram (SFD)
- Bending Moment Diagram (BMD)
- Axial Force Diagram (AFD)
- Torsion Diagram
- Deflection Diagram

**Load Case Selector** (dropdown)

**Member Selector**:
- All Members (show diagram on all)
- Selected Member(s) only
- Member Range: From ___ To ___

**Diagram Display Options**:
- Show Values (checkbox) - display peak values
- Show Grid (checkbox)
- Color by: Positive/Negative / Magnitude
- Manual Scale (override auto-scale)
- Diagram Offset (move diagram away from member for clarity)

**3D Canvas Display**:
- SFD overlayed on each member in model
- BMD overlayed on each member
- Color gradient showing magnitude
- Peak values labeled

**Interactive Diagram Features**:
- Click member → zoom to detailed diagram
- Hover → tooltip shows value at point
- Export single member diagram (PNG)

**Detailed Member Diagram Panel**:
When member is selected:
- Full SFD graph plotted
- Full BMD graph plotted
- AFD graph
- Peak values annotated
- Zero-crossing points marked
- Contraflexure points for BMD

**Export Diagrams**:
- Export All Diagrams (PDF report)
- Export Individual Diagram (PNG, SVG)
- Export Data Points (CSV)
- Print Diagram

---

##### Results Tab 5: ADVANCED ANALYSIS RESULTS

**Modal Analysis Results** (if modal analysis run):
- **Mode Shapes Table**:
  Columns:
  - Mode Number (1, 2, 3...)
  - Frequency (Hz)
  - Period (sec)
  - Modal Mass Participation X (%)
  - Modal Mass Participation Y (%)
  - Modal Mass Participation Z (%)
  - Cumulative Mass Participation
  
  Actions:
  - Animate Mode Shape (play button)
  - Export Mode Shape Animation
  - View Mode Shape Details

- **Mass Participation Chart** (bar graph)
  - Shows cumulative % per direction
  - Highlights if >90% achieved

- **Frequency vs Mode Graph**

**P-Delta Results**:
- Iteration Convergence Table
  - Iteration number
  - Max displacement change
  - Max force residual
  - Converged (Yes/No)

- P-Delta Amplification Factor (per member)
  - Shows increased moments due to 2nd order effect

- Compare with Linear:
  - Side-by-side comparison table
  - % difference

**Buckling Analysis Results**:
- **Buckling Modes Table**:
  - Mode number
  - Critical Load Factor (λ)
  - Effective Length Factor (K)
  
  Actions:
  - View Buckling Shape (animate)
  - Export Buckling Mode

- **Applied Load Display**:
  - Shows load case used for buckling
  - Critical load = λ × Applied Load

**Pushover Results**:
- **Capacity Curve** (graph):
  - X-axis: Roof Displacement
  - Y-axis: Base Shear
  - Plot shows:
    - Elastic range
    - Yielding points
    - Ultimate capacity
    - Failure point
  
  - Performance Point (FEMA-356)
    - Demand vs Capacity intersection

- **Hinge Formation Sequence**:
  - Table showing at which displacement each hinge formed
  - Hinge type: Flexural, Shear, Axial
  - Hinge status: IO, LS, CP (Immediate Occupancy, Life Safety, Collapse Prevention)

- **Plastic Hinge Map**:
  - Canvas displays hinges color-coded by status
  - Animation shows progressive hinge formation

**Time History Results**:
- **Response Time History Graph**:
  - X-axis: Time (sec)
  - Y-axis: Displacement / Acceleration / Force
  - Multiple nodes can be plotted
  
- **Max Response Table**:
  - Node
  - Max Displacement
  - Max Velocity
  - Max Acceleration
  - Time of occurrence

- **Export Time History**:
  - Data (CSV)
  - Graphs (PNG)

---

##### Results Tab 6: DESIGN CODE CHECK

**Design Code Selection** (auto from project settings):
- Current Code: IS 456:2000 (Concrete), IS 800:2007 (Steel)

**Member Design Status Table**:
Columns:
- Member ID
- Section
- Material
- Max Utilization Ratio (%)
- Status: Safe / Unsafe / Critical
- Governing Load Combo
- Critical Check (Flexure / Shear / Deflection / Buckling)

**Color Coding**:
- Green: Safe (Utilization < 80%)
- Yellow: Critical (80% - 100%)
- Red: Unsafe (Utilization > 100%)

**Filter/Sort**:
- Show All / Safe / Unsafe / Critical
- Sort by Utilization (highest first)

**Detailed Design Check** (click member):
Opens member design panel:

**For Concrete Member (IS 456)**:
- **Flexural Design**:
  - Mu (factored moment)
  - Mu,lim (limiting moment of resistance)
  - Ast required (tension steel area)
  - Ast provided
  - Status: OK / Add Steel

- **Shear Design**:
  - Vu (factored shear)
  - Vc (shear strength of concrete)
  - Stirrup requirement
  - Spacing
  - Status: OK / Add Stirrups

- **Deflection Check**:
  - Actual deflection
  - Allowable (span/250)
  - Status: OK / Fail

- **Crack Width Check**

**For Steel Member (IS 800)**:
- **Axial + Bending Check**:
  - P/Pn (axial ratio)
  - M/Mn (moment ratio)
  - Interaction formula result
  - Status: OK / Increase Section

- **Buckling Check**:
  - Effective length
  - Slenderness ratio
  - Euler buckling load
  - Allowable load
  - Status

- **Deflection Check**

**Design Report**:
- Button: "Generate Design Report"
  - Opens report preview
  - Shows calculations step-by-step
  - Formulas used
  - Code clause references
  - Export to PDF

**Design Optimization**:
- Button: "Auto-Optimize Sections"
  - Runs optimization to find lightest sections
  - Maintains safety factors
  - Shows weight savings
  - Preview optimized vs current

---

#### EXPORT & REPORT GENERATION

**Export Results Panel**:
Button: "Export / Generate Report"

Opens export wizard:

**Export Options**:
- **Export Type** (checkboxes):
  - ☑ Support Reactions
  - ☑ Member Forces
  - ☑ Displacements
  - ☑ Force Diagrams (SFD, BMD, AFD)
  - ☑ Design Code Check
  - ☑ Load Combinations
  - ☑ Model Geometry Summary
  - ☑ Material & Section Properties
  - ☐ Step-by-Step Calculations (detailed)
  - ☐ Stiffness Matrices (advanced)

- **Format Selection**:
  - PDF Report (Professional)
  - CSV Tables (Data Only)
  - Excel Workbook (.xlsx)
  - JSON (Machine-readable)
  - Word Document (.docx)

- **Report Template**:
  - Standard Engineering Report
  - Detailed Calculation Report (with formulas)
  - Summary Report (executive)
  - Custom Template (upload .docx template)

**Report Customization**:
- **Cover Page**:
  - Project Title (auto-filled)
  - Client Name
  - Engineer Name
  - Company Logo (upload)
  - Project Date
  - Revision Number

- **Header/Footer**:
  - Company Name
  - Page numbering
  - Date stamp
  - "BeamLab Ultimate" branding (optional - Pro users can remove)

- **Content Selection**:
  - Include 3D Model Image (checkbox)
  - Include Deformed Shape (checkbox)
  - Include Force Diagrams (checkbox)
  - Include Design Calculations (checkbox)
  - Table of Contents (auto-generated)

- **Units Display**:
  - Use project units (kN, m)
  - Convert to: (optional change)

**Preview Report**:
- Button: "Preview Report"
  - Opens PDF preview in new window
  - Scroll through all pages
  - Check formatting

**Generate & Download**:
- Button: **"Generate Report"**
  - Progress bar: "Generating PDF..."
  - Download starts automatically
  - File name: ProjectName_Analysis_Report_2026-03-06.pdf

**Share Report**:
- Email Report (opens email dialog with attachment)
- Upload to Cloud (Google Drive, Dropbox)
- Share Link (if cloud storage enabled)

---

### 4.5 DESIGN TAB

#### Left Sidebar Tools (when Design tab active)

**MEMBER DESIGN DASHBOARD**

**Design Code Display**:
- Current Codes:
  - Concrete: IS 456:2000
  - Steel: IS 800:2007
  - Change Code (button - opens settings)

**Member Selection**:
- Select Members to Design:
  - All Members
  - Selected Members Only
  - By Material Type: Concrete / Steel / Timber
  - By Group

**DESIGN MODULES** (navigation buttons):

1. **RC Beam Design** (button)
   Opens RC Beam Design Panel:
   - Member list (all concrete beams)
   - Load Combo for Design (dropdown)
   - Design Parameters:
     - Concrete Grade (M20, M25, M30...)
     - Steel Grade (Fe 415, Fe 500)
     - Clear Cover (mm)
     - Effective Depth (auto or manual)
   
   - Flexural Design Output:
     - Mu (factored moment)
     - Required Ast (mm²)
     - Suggested bars: e.g., "4-16mm ɸ + 2-12mm ɸ"
     - Check: OK / Revise Section
   
   - Shear Design Output:
     - Vu (factored shear)
     - Stirrup requirement: "8mm ɸ @ 150mm c/c"
   
   - Apply Design (button)
   - Export Design Report (PDF)

2. **RC Column Design** (button)
   - Biaxial bending check
   - Slenderness effects
   - Effective length
   - Longitudinal steel
   - Ties/Spirals

3. **RC Slab Design** (button)
   - One-way / Two-way slab
   - Main & distribution steel
   - Deflection check

4. **Steel Member Design** (button)
   Opens Steel Design Panel:
   - Member list (all steel members)
   - Design Method:
     - AISC LRFD
     - AISC ASD
     - IS 800 LSM
   
   - Design Checks Display:
     - Tension Capacity
     - Compression (with buckling)
     - Bending
     - Shear
     - Combined Axial + Bending (interaction)
   
   - Design Ratio: 0.85 (OK)
   - Status: Safe / Unsafe
   
   - Auto-Select Section:
     - Tries lighter sections
     - Finds minimum safe section
     - Apply (button)

5. **Connection Design** (button)
   Links to: `/design/connections`
   - Bolted Connections
   - Welded Connections
   - Base Plates
   - Splice Connections

6. **Foundation Design** (button)
   Links to: `/design/foundation`
   - Isolated Footing
   - Combined Footing
   - Strap Footing
   - Mat Foundation
   - Pile Cap

7. **Reinforcement Detailing** (button)
   Links to: `/design/detailing`
   - Bar Bending Schedule
   - Detailed Drawings (reinforcement layout)
   - Bar lists
   - Cutting lengths

**DESIGN HUB** (Post-Analysis Workflow):
Button: "Open Post-Analysis Design Hub"
Links to: `/design-hub`

Comprehensive workflow interface showing:
- Member force envelope (from all load combos)
- Design each member sequentially
- Optimization tools
- Weight summary
- Cost estimation

**POST-PROCESSING & OPTIMIZATION**:

- **Section Optimization**:
  Button: "Optimize Sections"
  
  Opens optimizer:
  - Objective: Minimize Weight / Cost
  - Constraints:
    - All members must be Safe (Utilization ≤ 1.0)
    - Deflection limits met
    - Code compliance
  
  - Optimization Algorithm:
    - Genetic Algorithm
    - Simulated Annealing
    - Sequential Search
  
  - Run Optimization (button)
  - Shows:
    - Original total weight
    - Optimized total weight
    - Weight savings (%)
    - Cost savings
  
  - Apply Optimized Sections (button)
  - Revert to Original (button)

- **Utilization Heatmap**:
  Button: "Show Utilization Map"
  - Displays model with color-coded members
  - Color scale: 0% (blue) to 100% (red) to >100% (dark red)
  - Quickly identify over/under-designed members

- **Design Summary Report**:
  - Total members designed: X
  - Safe members: Y
  - Unsafe members (require revision): Z
  - Average utilization: 75%
  - Total steel/concrete quantity
  - Estimated cost

**DETAILED DRAWING EXPORT**:
Button: "Generate Detailed Drawings"

For RC Members:
- Detailed cross-section view
- Reinforcement layout (plan view)
- Bar diameter, spacing clearly marked
- Clear cover dimension
- Stirrup/tie spacing
- Development length shown
- Section dimensions (mm)
- Scale: 1:10, 1:20, etc.

For Steel Members:
- Connection details (if designed)
- Bolt layout plan
- Bolt sizes, spacing, edge distance
- Weld symbols (AWS standard)
- Weld length, size
- Base plate details (if applicable)

Export formats:
- DWG (AutoCAD)
- DXF
- PDF
- PNG (image)

---

### 4.6 VIEW & VISUALIZATION CONTROLS

#### Top Right Corner Controls

**VIEW PRESETS** (dropdown or button group):
- Front View (looks along +X, view in YZ plane)
- Back View
- Left View (along +Y, view in XZ)
- Right View
- Top View (along +Z, view in XY)
- Bottom View
- Isometric SW (default 3D view)
- Isometric NE
- Custom View (save current camera angle)

Shortcut keys displayed: F1, F2, F3...

**RENDER MODE** (dropdown):
- Wireframe (edges only, fast)
- Hidden Line (wireframe with hidden edges dashed)
- Solid (filled faces, colored by material)
- Analytical (color-coded by stresses/results)
- Photorealistic (with shadows, materials)
- X-Ray (transparent view)

**DISPLAY TOGGLES** (checkboxes in dropdown panel):
- ☑ Show Nodes
- ☑ Show Node Numbers
- ☑ Show Members
- ☑ Show Member Numbers
- ☑ Show Supports (with symbols)
- ☑ Show Loads (arrows)
- ☑ Show Local Axes (member coordinate systems)
- ☑ Show Grid
- ☑ Show Dimensions
- ☐ Show Sections (3D extrusion of actual sections)
- ☐ Show Deformed Shape
- ☐ Show Stress Contours

**LABEL SETTINGS**:
- Label Size (slider: small / medium / large)
- Label Color
- Node Label Style: Number / Coordinates / Both
- Member Label Position: Midpoint / Start / End

**CLIPPING PLANES**:
- Enable Clipping (checkbox)
- Clip Plane Position (slider)
- Clip direction: X / Y / Z

**CAMERA CONTROLS**:
- Orbit (left mouse drag)
- Pan (right mouse drag or middle mouse)
- Zoom (scroll wheel)
- Fit All (button) - zoom extents
- Zoom to Selection (button)
- Save View (bookmark current camera)
- Restore View (from bookmarks)

**SCREENSHOT & RECORDING**:
- Screenshot (button) - captures current view
  - Resolution: 1920x1080, 4K, Custom
  - Format: PNG, JPG
  - Transparent Background (checkbox)

- Record Animation (button)
  - Record deformed shape animation
  - Record mode shape animation
  - Export as MP4, GIF
  - Frame rate: 24, 30, 60 fps

---

## 5. ANALYSIS FEATURE PAGES (Dedicated Pages)

### 5.1 Modal Analysis (/analysis/modal)

**Page Layout**:
- Top bar with breadcrumb: Home > Analysis > Modal Analysis
- Left panel: Settings
- Center: 3D canvas showing mode shape animation
- Right panel: Results table

**Settings Panel**:
- Number of Modes: [input] default 10
- Frequency Range (Hz): Min [___] Max [___]
- Mass Source:
  - From Material Density (checkbox)
  - Include Added Mass (checkbox)
  - Lumped Mass at Nodes (manual input)

- Damping Model:
  - Rayleigh Damping
  - Modal Damping (% critical per mode)

- Button: **"Run Modal Analysis"**

**Results Display**:
- **Mode Shape Table**:
  - Mode #, Frequency (Hz), Period (sec), Mass Participation X/Y/Z (%)

- **Animation Controls**:
  - Play/Pause mode shape animation
  - Speed slider (slow / fast)
  - Loop animation
  - Exaggeration scale

- **Mass Participation Chart** (bar graph)

- **Export**:
  - Export Mode Shapes (animation .gif)
  - Export Frequency Table (CSV)
  - Generate Modal Report (PDF)

---

### 5.2 Time History Analysis (/analysis/time-history)

**Input Panel**:
- **Earthquake Record Upload**:
  - Upload .csv or .txt file (time, acceleration columns)
  - Or select from library:
    - El Centro 1940
    - Northridge 1994
    - Kobe 1995
    - Bhuj 2001

- **Analysis Parameters**:
  - Time Step (sec): 0.01
  - Total Duration (sec): 40
  - Damping Ratio (%): 5% (default)
  - Integration Method: Newmark-Beta / Wilson-Theta

- **Direction**:
  - Apply in: X / Y / Z direction
  - Scale Factor: 1.0 (multiply acceleration)

- Button: **"Run Time History Analysis"**

**Results Display**:
- **Time-Displacement Graph** (plotted for selected nodes)
  - X-axis: Time (sec)
  - Y-axis: Displacement (mm)
  - Multi-node plot (different colors)

- **Max Response Table**:
  - Node ID
  - Max Displacement, Velocity, Acceleration
  - Time of max

- **Animation**: Play time history response

- **Export**:
  - Export Response Data (CSV)
  - Export Graph (PNG)
  - Generate Report (PDF)

---

### 5.3 Pushover Analysis (/analysis/pushover)

**Configuration Panel**:
- **Control Node** (select node for monitoring):
  - Typically roof node

- **Load Pattern** (distribution of lateral load):
  - Uniform
  - Triangular (linear increase with height)
  - Code-based (IS 1893 / ASCE 41)
  - Modal (1st mode shape)

- **Target Displacement** (mm):
  - Or Target Drift Ratio (%)

- **Hinge Properties**:
  - Auto-generate hinges at member ends
  - Or manual hinge assignment
  - Hinge type: Flexural (M3), Shear (V2), Axial (P)

- Button: **"Run Pushover Analysis"**

**Results Display**:
- **Capacity Curve** (Pushover Curve):
  - X: Roof Displacement (mm)
  - Y: Base Shear (kN)
  - Curve shows elastic, yielding, ultimate phases

- **Performance Point** (if demand spectrum provided):
  - Intersection of capacity & demand
  - Displacement at performance point
  - Base shear at performance point

- **Hinge Status Table**:
  - Hinge ID, Location, Type
  - Formation Step (at what displacement)
  - Status: IO / LS / CP

- **Hinge Formation Animation**:
  - Play through pushover steps
  - Color-coded hinges (green → yellow → orange → red)

- **Export**:
  - Export Capacity Curve (CSV, PNG)
  - Export Hinge Summary (PDF)

---

### 5.4 Nonlinear Analysis (/analysis/nonlinear)

**Settings**:
- **Material Nonlinearity**:
  - Concrete: Mander model, Hognestad
  - Steel: Bilinear, Ramberg-Osgood

- **Geometric Nonlinearity**:
  - P-Delta effects
  - Large displacement formulation

- **Solution Control**:
  - Load steps: [input]
  - Max iterations per step: 50
  - Convergence tolerance: 1e-4

- Button: **"Run Nonlinear Analysis"**

**Results**:
- Load-Displacement Curve
- Iteration log
- Material stress-strain plots
- Compare with linear analysis

---

### 5.5 Plate & Shell FEM Analysis (/analysis/plate-shell)

**Model Input**:
- Draw plate/shell elements (quadrilateral or triangular)
- Assign thickness
- Material properties

**Analysis Type**:
- Thin Plate (Kirchhoff theory)
- Thick Plate (Mindlin-Reissner)
- Shell (combined bending + membrane)

**Results**:
- Deflection contours (color map)
- Stress contours (σx, σy, τxy)
- Moment contours (Mx, My, Mxy)
- Principal stresses

**Export**:
- Contour plots (PNG)
- Stress table (CSV)

---

## 6. DESIGN CENTER (/design-center)

**Comprehensive Design Interface** (STAAD.Pro style):

### Left Sidebar Navigation

**Design Categories**:
1. **Steel Design**
   - Beams (IS 800, AISC 360)
   - Columns
   - Tension Members
   - Compression Members
   - Combined Axial + Bending

2. **Concrete Design**
   - RC Beams (IS 456, ACI 318)
   - RC Columns
   - RC Slabs (One-way, Two-way)
   - RC Walls
   - Shear Walls

3. **Foundation Design**
   - Isolated Footings
   - Combined Footings
   - Strap Footings
   - Mat Foundations
   - Pile Foundations

4. **Connection Design**
   - Bolted Connections (Shear, Tension, Combined)
   - Welded Connections (Fillet, Groove, Plug)
   - Base Plates
   - Moment Connections
   - Splice Connections

5. **Bridge Design**
   - Deck Slab Design
   - Girder Design
   - Pier Design
   - Abutment Design

6. **Detailing & Drawings**
   - Reinforcement Detailing
   - Bar Bending Schedule
   - Connection Details
   - Shop Drawings

**Center Panel**: Design workspace (changes based on selected module)

**Right Panel**: Design output, code check, recommendations

---

## 7. TOOLS & UTILITIES

### 7.1 Load Combination Generator (/tools/load-combinations)

**Interface**:
- Select Design Code:
  - IS 456:2000
  - ACI 318
  - Eurocode
  - BS 8110

- Load Cases Available (from current project):
  - DL, LL, WL, EQ, etc.

- Auto-Generate Combinations (button):
  - Generates all required combos per code
  - Service combinations
  - Ultimate (factored) combinations
  - Seismic combinations

- Manual Edit (for each combo):
  - Combo name
  - Load factors for each load case

- Save Combinations to Project (button)

---

### 7.2 Section Database Browser (/tools/section-database)

**Search & Filter**:
- Section Type: I, Channel, Angle, Hollow, Custom
- Standard: IS, AISC, BS, EN
- Size Range filters

**Section Table** (comprehensive library):
- 800+ standard sections
- All properties displayed
- Preview diagrams

**Actions**:
- View detailed properties
- Add to project library
- Export section data

---

### 7.3 Bar Bending Schedule (BBS) (/tools/bar-bending)

**Member Input**:
- Add Beam (button)
- Add Column (button)
- Add Slab (button)

**For Each Member**:
- Member ID
- Section dimensions
- Reinforcement details:
  - Main bars: diameter, count
  - Stirrups/Ties: diameter, spacing
  - Development length
  - Lap length

**BBS Table Generation**:
Columns:
- Bar Mark (A1, A2, B1...)
- Diameter (mm)
- Shape Code (IS 2502)
- Length (m)
- Number of bars
- Total Length (m)
- Weight (kg)
- Bending Shape Diagram (thumbnail)

**Summary**:
- Total Steel Weight (kg)
- Breakdown by diameter (8mm: 50kg, 12mm: 120kg, ...)

**Export**:
- Export BBS Table (PDF, Excel)
- Export Bar Shapes (DWG)
- Print BBS

---

### 7.4 Advanced Meshing (/tools/advanced-meshing)

**Mesh Controls**:
- Element Type: Linear / Quadratic
- Element Size (global): [input] mm
- Local Refinement:
  - Select region
  - Local element size

- Mesh Quality Settings:
  - Min element angle
  - Max aspect ratio

**Generate Mesh** (button)

**Mesh Quality Display**:
- Total elements: X
- Average quality: Y
- Poor quality elements: Z (highlighted)

**Refine Mesh** (iterative improvement)

---

### 7.5 Print & Export Center (/tools/print-export)

**Export Options**:
- Model Geometry (DXF, DWG, IFC, STEP)
- Analysis Results (CSV, Excel, JSON)
- Reports (PDF)
- Drawings (PDF, DWG)

**Print Settings**:
- Page Size: A4, A3, Letter
- Orientation: Portrait / Landscape
- Scale: Fit to page / Custom
- Print Preview (button)
- Print (button)

---

## 8. CIVIL ENGINEERING SUITE

### 8.1 Hydraulics Designer (/civil/hydraulics)

**Modules**:
1. **Open Channel Flow**
   - Manning's equation solver
   - Normal depth calculation
   - Critical depth
   - Hydraulic jump
   - Channel types: Rectangular, Trapezoidal, Circular

   **Input Fields**:
   - Channel shape (dropdown)
   - Bottom width (m)
   - Side slope (H:V)
   - Bed slope (m/m)
   - Manning's n (roughness)
   - Discharge (m³/s)

   **Calculate** (button)

   **Results**:
   - Normal depth (m)
   - Velocity (m/s)
   - Froude number
   - Flow regime: Subcritical / Supercritical

2. **Pipe Flow Calculator**
   - Darcy-Weisbach equation
   - Hazen-Williams
   - Pipe sizing
   - Head loss

   **Inputs**:
   - Pipe diameter (mm)
   - Length (m)
   - Flow rate (L/s)
   - Roughness coefficient

   **Results**:
   - Velocity
   - Head loss
   - Pressure drop

3. **Pump Selection**
   - Pump curves
   - System curve
   - Operating point
   - NPSH calculation

**Export**:
- Calculation Sheet (PDF)
- Design Summary

---

### 8.2 Transportation Designer (/civil/transportation)

**Modules**:
1. **Geometric Road Design**
   - Input:
     - Design Speed (km/h)
     - Road Class (National Highway, State Highway, etc.)
     - Terrain (Plain, Rolling, Hilly)
   
   - Outputs:
     - Minimum radius of horizontal curve
     - Superelevation
     - Transition length
     - Sight distance (SSD, OSD)

2. **Horizontal Curve Design**
   - Inputs:
     - Deflection angle
     - Radius
     - Chainage of PI (Point of Intersection)
   
   - Outputs:
     - Curve length
     - Tangent length
     - Chainage of PC, PT
     - Setting out data (offset table)

3. **Vertical Curve Design**
   - Inputs:
     - Grade 1 (%)
     - Grade 2 (%)
     - Design speed
   
   - Outputs:
     - Crest / Sag curve length
     - Rate of change of grade
     - Elevations at intervals

4. **Pavement Design**
   - Inputs:
     - Traffic (CVPD - Commercial Vehicles Per Day)
     - CBR (California Bearing Ratio)
     - Pavement type: Flexible / Rigid
   
   - Outputs (CBR method):
     - Pavement thickness layers (sub-base, base, wearing course)
   
   - Outputs (IRC method):
     - Design thickness per IRC codes

5. **Intersection Design**
   - Signalized intersection
   - Roundabout design
   - Traffic signal timing

**Export**:
- Design Drawings (DWG)
- Calculation Report (PDF)
- Setting Out Data (CSV)

---

### 8.3 Construction Manager (/civil/construction)

**Features**:
1. **Bill of Quantities (BOQ)**
   - Quantity takeoff from model
   - Item descriptions
   - Unit rates
   - Total cost estimation

2. **Project Scheduling**
   - Gantt chart
   - Critical Path Method (CPM)
   - PERT analysis
   - Resource allocation

3. **Construction Planning**
   - Work breakdown structure
   - Activity sequencing
   - Duration estimation

**Export**:
- BOQ (Excel)
- Schedule (MS Project, PDF)
- Cost Report

---

### 8.4 Quantity Survey (/quantity)

**Quantity Takeoff**:
- Automatic from 3D model:
  - Concrete volume (m³) - per member type
  - Steel weight (kg) - per diameter
  - Formwork area (m²)
  - Excavation volume
  - Backfill volume

**Manual Entry**:
- Add custom items
- Specify quantity, unit, rate

**Abstract of Quantities**:
- Grouped by trade (Concrete, Steel, Formwork, etc.)
- Sub-totals
- Grand total

**Rate Analysis**:
- Material cost
- Labor cost
- Equipment cost
- Overheads
- Total unit rate

**Export**:
- Quantity Table (Excel)
- BOQ (standard format)
- Cost Estimate Report (PDF)

---

## 9. ENTERPRISE & COLLABORATION FEATURES

### 9.1 Collaboration Hub (/collaboration)

**Team Workspace**:
- Create Team (button)
- Invite Members (email invites)
- Member roles:
  - Admin (full access)
  - Editor (can edit models)
  - Viewer (read-only)
  - Commenter

**Shared Projects**:
- Project list (team projects)
- Share project with team members
- Permission controls per project

**Live Collaboration**:
- Real-time multi-user editing
- Live cursors (see who's editing where)
- User avatars displayed
- Activity feed (who did what)

**Comments & Annotations**:
- Add comment to model (pin to location)
- Reply to comments (threaded)
- Resolve/Close comments
- Tag team members (@mention)

**Version History**:
- Timeline of all changes
- Restore to previous version
- Compare versions (diff)

**Activity Log**:
- User actions logged
- Timestamps
- Audit trail

---

### 9.2 BIM Integration (/bim)

**BIM Import**:
- Supported formats:
  - IFC (Industry Foundation Classes)
  - Revit (.rvt via plugin)
  - Tekla (.xml)
  - STAAD (.std)

- Import Settings:
  - Coordinate system mapping
  - Unit conversion
  - Layer/Category filtering
  - Material mapping

- Button: "Import BIM Model"

**BIM Export**:
- Export to IFC
- Export to Revit (via IFC)
- Export to Tekla
- Geometry + Analysis results

**BIM Sync**:
- Bi-directional sync (changes in BIM → update structural model)
- Change detection
- Conflict resolution

**Model Comparison**:
- Compare imported vs current
- Highlight differences (new/deleted/modified members)

---

### 9.3 CAD Integration (/cad/integration)

**CAD Import**:
- DWG (AutoCAD)
- DXF
- STEP
- IGES

**CAD Export**:
- Export geometry to DWG/DXF
- Export detailed drawings
- Layer management
- Scale control

**CAD Overlay**:
- Import architectural plan as background
- Trace structural elements over CAD

---

### 9.4 API Integration Dashboard (/integrations/api-dashboard)

**API Access**:
- Generate API Key (for developers)
- API Documentation (link to docs)

**REST API Endpoints**:
- `/api/models` - CRUD operations on models
- `/api/analysis/run` - Trigger analysis
- `/api/results` - Fetch results
- `/api/projects` - Project management

**Webhooks**:
- Configure webhooks (send events to external URL)
- Events: Analysis Complete, Design Done, Error

**API Usage Stats**:
- Requests per day (graph)
- Rate limit status
- Error rate

**Sample Code**:
- Python examples
- JavaScript examples
- cURL examples

---

### 9.5 Materials Database (/materials/database)

**Material Library**:
- Concrete grades (M15 to M60)
- Steel grades (Fe 415, Fe 500, ASTM A36, A992, etc.)
- Timber species
- Masonry (Brick, Block)
- Aluminum alloys
- Custom materials

**Material Properties Display**:
For each material:
- Density (kN/m³)
- Elastic Modulus E (GPa)
- Poisson's Ratio ν
- Yield Strength fy (MPa)
- Ultimate Strength fu (MPa)
- Thermal Expansion Coefficient
- Shear Modulus G
- Stress-Strain Curve (graph)

**Add Custom Material**:
- Input all properties
- Upload stress-strain data (CSV)
- Save to project library
- Share with team

**Material Selector**:
- Filter by type
- Search by name
- Favorites

---

### 9.6 Code Compliance Checker (/compliance/checker)

**Select Design Codes** (multiple):
- IS 456, IS 800, IS 1893, IS 875
- ACI 318, AISC 360, ASCE 7
- Eurocode 2, 3, 8

**Compliance Dashboard**:
- Overall Compliance Score: 95% ✓
- Code Violations: 3 (list displayed)
- Warnings: 7

**Detailed Code Check**:
For each member:
- Code clause reference
- Calculation steps
- Formula used
- Check result: Pass / Fail

**Violation List**:
- Member ID
- Violation description
- Code clause violated
- Recommendation

**Fix Violations**:
- Auto-suggest fixes
- Apply recommended changes

**Generate Compliance Report** (PDF):
- All checks documented
- Code references cited
- Sign-off sheet

---

## 10. REPORTS & VISUALIZATION

### 10.1 Reports Page (/reports)

**Report Library**:
- List of all generated reports
- Filter by:
  - Project
  - Date
  - Type (Analysis, Design, BBS, etc.)

**Report Cards**:
- Report name
- Project name
- Date generated
- File size
- Preview thumbnail

**Actions**:
- View Report (PDF viewer)
- Download Report
- Email Report
- Delete Report

**Create New Report** (button):
- Redirects to Report Builder

---

### 10.2 Report Builder (/reports/builder)

**Report Template Selection**:
- Standard Analysis Report
- Design Report
- Comprehensive (Analysis + Design)
- Custom Template (build from scratch)

**Content Selector** (drag & drop interface):
Available modules (drag to report):
- Cover Page
- Table of Contents
- Project Information
- Model Geometry Summary
- Material Properties
- Load Cases
- Load Combinations
- Analysis Results (reactions, forces, displacements)
- Force Diagrams (SFD, BMD, AFD)
- Design Summary
- Code Compliance
- Detailed Calculations
- Appendices

**Customize Each Module**:
- Edit title
- Include/exclude sub-sections
- Formatting options (font, spacing)

**Preview Report** (live preview on right side)

**Export Report**:
- PDF
- Word (.docx)
- HTML

---

### 10.3 Professional Report Generator (/reports/professional)

**Industry-Standard Reports**:
- Predefined templates compliant with industry standards
- Professional formatting
- Automated calculations display

**Cover Sheet**:
- Project details
- Engineer seal (upload image)
- Signature field

**Calculation Section**:
- Step-by-step calculations
- Formulas with variable substitution
- Code clause references
- Diagrams embedded

**Export with Branding**:
- Custom company logo
- Custom header/footer
- Watermark (for drafts)

---

### 10.4 3D Visualization Engine (/visualization/3d-engine)

**Advanced Rendering**:
- Photorealistic mode (ray tracing)
- Shadow casting
- Material textures (concrete, steel)
- Environment lighting

**Virtual Reality (VR)**:
- VR mode (for VR headsets)
- Walk through model
- Immersive inspection

**Augmented Reality (AR)**:
- AR view (overlay model on site via phone camera)

**Rendering Settings**:
- Quality: Draft / Medium / High / Ultra
- Resolution
- Anti-aliasing
- Ambient Occlusion

**Camera Animation**:
- Create camera path (keyframes)
- Flythrough animation
- Export video (MP4)

---

### 10.5 Result Animation Viewer (/visualization/result-animation)

**Animation Types**:
- Deformed Shape (static load)
- Mode Shape (vibration animation for each mode)
- Time History Response (earthquake animation)
- Pushover Animation (progressive collapse)

**Playback Controls**:
- Play / Pause
- Speed: 0.25x, 0.5x, 1x, 2x, 4x
- Loop (continuous play)
- Frame-by-frame scrub (slider)

**Animation Settings**:
- Deformation scale (exaggeration factor)
- Color by: Displacement / Stress / Utilization
- Show undeformed (overlay)

**Export Animation**:
- GIF (for web/email)
- MP4 video (HD, 4K)
- Frame sequence (PNG images)

---

## 11. AI FEATURES

### 11.1 AI Dashboard (/ai-dashboard)

**C-Suite Analytics Interface**:
- Executive summary of all projects
- KPIs: Total projects, Analysis success rate, Avg design time
- AI-powered insights

**AI Insights**:
- "5 members are over-designed - potential 12% weight savings"
- "Foundation loads exceed typical — verify soil report"
- "Drift ratio exceeds code — suggest adding shear walls"

**Predictive Analytics**:
- Predict project completion time
- Cost forecast

**Natural Language Queries**:
- Ask questions in plain English:
  - "What is the max beam deflection in Project Alpha?"
  - "Which column has highest utilization?"
  - "Show me all unsafe members"

- AI responds with data + visualizations

---

### 11.2 AI Power Panel (/ai-power)

**AI Model Builder**:
- Input: Natural language description
  - Example: "Create a 3-story building frame, 4 bays x 3 bays, 5m bay width, 3.5m story height, fixed supports at base"

- AI parses input
- Generates 3D model automatically
- Applies default sections and materials

**AI Model Modifier**:
- "Add a beam between Node 12 and Node 18"
- "Change all column sections to ISMB 450"
- "Apply 10 kN/m UDL on all beams at level 2"

**AI Design Suggestions**:
- After analysis, AI suggests:
  - "Member 45 is overstressed — suggest ISMB 600 instead"
  - "Deflection at Node 78 is high — increase section depth"

**AI Report Writer**:
- "Generate professional report for this analysis"
- AI writes summary, interpretation of results
- Human review and edit before export

---

## 12. SETTINGS & HELP

### 12.1 Settings Page (/settings)

**Account Tab**:
- Profile Information:
  - Name (editable)
  - Email (display)
  - Phone (editable)
  - Company (editable)
  - Job Title
  - Professional License Number

- Change Password (button)
- Upload Profile Photo

**Subscription & Billing Tab**:
- Current Plan: Professional
- Renewal Date: March 15, 2026
- Manage Subscription (Stripe portal)
- Billing History (list of invoices)
- Download Invoice (per row)

**Preferences Tab**:
- **Units**:
  - Force: kN / N / kip / lbf
  - Length: m / mm / ft / in
  - Stress: MPa / N/mm² / psi / ksi

- **Default Codes**:
  - Concrete: IS 456 / ACI 318 / BS / EC2
  - Steel: IS 800 / AISC / BS / EC3
  - Seismic: IS 1893 / ASCE 7 / EC8

- **Auto-Save**:
  - Enable (checkbox)
  - Interval: 1 min / 5 min / 10 min

- **Theme**:
  - Light / Dark / Auto (system)

**Notifications Tab**:
- Email Notifications:
  - Analysis complete (checkbox)
  - Collaborator comments (checkbox)
  - Project shared (checkbox)
  - Product updates (checkbox)

- In-App Notifications (toggle)

**Privacy & Security Tab**:
- Two-Factor Authentication (enable/disable)
- Active Sessions (list devices)
- Sign out all other devices (button)

**Integrations Tab**:
- Connected Apps:
  - Google Drive (disconnect button)
  - Dropbox
  - AutoCAD plugin

**Advanced Settings** (/settings/advanced):
- Analysis Precision Settings
- Solver tolerances
- GPU settings
- Cache management

---

### 12.2 Help Center (/help)

**Help Topics** (organized by category):
1. **Getting Started**
   - Quick Start Guide
   - Video Tutorials (embedded)
   - Sample Projects

2. **Modeling**
   - How to create geometry
   - Section assignment
   - Support conditions

3. **Loading**
   - Load types
   - Load combinations
   - Moving loads

4. **Analysis**
   - Running analysis
   - Interpreting results
   - Advanced analysis types

5. **Design**
   - Code-based design
   - Optimization
   - Detailing

6. **Troubleshooting**
   - Common errors
   - Analysis fails
   - Performance issues

**Search Help** (search bar at top)

**FAQs** (expandable list):
- How do I apply a distributed load?
- What is P-Delta analysis?
- How to import from STAAD.Pro?
- ... (50+ FAQs)

**Contact Support**:
- Email: support@beamlab.com
- Live Chat (button - opens chat widget)
- Submit Ticket (form)

---

### 12.3 Learning Center (/learning)

**Courses**:
1. **Beginner Course**: Introduction to Structural Analysis
   - 10 lessons (video + text)
   - Quizzes after each lesson
   - Certificate upon completion

2. **Intermediate**: Advanced Analysis Techniques
3. **Expert**: Nonlinear & Dynamic Analysis

**Tutorials** (project-based):
- Design a Simple Beam
- Analyze a 2D Frame
- Design a Multi-Story Building
- Bridge Analysis
- Seismic Design

**Webinars** (recorded & live):
- Upcoming webinar schedule
- Register for live sessions
- Watch past recordings

**Documentation**:
- User Manual (PDF)
- API Documentation
- Code References

**Certification**:
- BeamLab Certified Engineer program
- Take certification exam
- Digital badge upon passing

---

## 13. ADDITIONAL PAGES & UTILITIES

### 13.1 Account Management Pages

- **Sign In** (/sign-in): Email/password login, OAuth (Google, Microsoft)
- **Sign Up** (/sign-up): Create new account, email verification
- **Forgot Password** (/forgot-password): Reset password via email
- **Reset Password** (/reset-password): Enter new password
- **Verify Email** (/verify-email): Email verification step
- **Account Locked** (/account-locked): Info page if account suspended
- **Link Expired** (/link-expired): Message for expired reset links

---

### 13.2 Legal & Company Pages

- **Privacy Policy** (/privacy-policy): Data collection, usage, GDPR compliance
- **Terms of Service** (/terms-of-service): User agreement
- **Terms & Conditions** (/terms-and-conditions): Legal T&C per IT Act 2000, jurisdiction Rewa
- **Refund & Cancellation** (/refund-cancellation): Subscription refund policy
- **About Us** (/about): Company story, team, mission
- **Contact Us** (/contact): Contact form, office address, phone, email

---

### 13.3 Performance & Demo Pages

- **UI Showcase** (/ui-showcase): Component library showcase (for developers)
- **Rust WASM Demo** (/rust-wasm-demo): Benchmark showing Rust solver speed
- **NAFEMS Benchmarks** (/nafems-benchmarks): Validation against industry standard problems
- **Error Report** (/error-report): Codebase health monitoring (internal)
- **Capabilities** (/capabilities): Feature overview landing page
- **Sitemap** (/sitemap): Full navigation map of all pages

---

## 14. KEYBOARD SHORTCUTS SUMMARY

### Global Shortcuts
- **⌘K / Ctrl+K**: Open global search
- **Esc**: Deselect / Exit current tool
- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Ctrl+S**: Save project
- **Ctrl+C**: Copy selection
- **Ctrl+V**: Paste
- **Delete**: Delete selection
- **Ctrl+A**: Select all

### Modeling Shortcuts
- **N**: Add Node
- **B**: Add Beam
- **V**: Add Vertical Column
- **C**: Add Cable
- **A**: Add Arch
- **P**: Add Plate
- **M**: Move tool
- **R**: Rotate tool
- **Shift+S**: Box select
- **Z**: Zoom window

### View Shortcuts
- **F1**: Front view
- **F2**: Top view
- **F3**: Right view
- **F4**: Isometric view
- **F**: Fit all (zoom extents)
- **G**: Toggle grid
- **L**: Toggle labels

### Analysis Shortcuts
- **F5**: Run analysis
- **F6**: View results

---

## 15. COMPLETE BUTTON & CONTROL INVENTORY

### Primary Action Buttons (Across All Pages)
1. **Get Started** / **Start Free Trial** (CTA on landing page)
2. **Log In** / **Sign In**
3. **Sign Up** / **Create Account**
4. **New Project**
5. **Import Project**
6. **Open Project**
7. **Save** / **Save As**
8. **Undo** / **Redo**
9. **Run Analysis**
10. **View Results**
11. **Export Report**
12. **Generate Report**
13. **Download**
14. **Share**
15. **Duplicate**
16. **Delete**
17. **Archive**
18. **Restore**
19. **Apply**
20. **Cancel**
21. **Next** / **Previous** (wizard navigation)
22. **Close** / **Dismiss**
23. **Edit** / **Modify**
24. **Add** (Add Node, Add Beam, Add Load, etc.)
25. **Remove**
26. **Copy** / **Paste**
27. **Mirror**
28. **Rotate**
29. **Move** / **Translate**
30. **Scale**
31. **Array** (Linear, Polar, 3D)
32. **Generate** (Structure generators)
33. **Optimize**
34. **Calculate**
35. **Validate** / **Check**
36. **Preview**
37. **Print**
38. **Upload** / **Import**
39. **Sync**
40. **Refresh**
41. **Search**
42. **Filter**
43. **Sort**
44. **Select All** / **Deselect All**
45. **Invert Selection**
46. **Zoom In** / **Zoom Out** / **Fit All**
47. **Play** / **Pause** (animations)
48. **Record**
49. **Screenshot**
50. **Settings** / **Preferences**
51. **Help**
52. **Contact Support**
53. **Send Message** (contact form)
54. **Subscribe** / **Upgrade Plan**
55. **Cancel Subscription**
56. **Renew**
57. **Download Invoice**
58. **Manage Billing**
59. **Change Password**
60. **Sign Out** / **Log Out**
61. **Assign** (materials, sections, loads)
62. **Clear**
63. **Reset**
64. **Restore Defaults**
65. **Confirm** / **OK**
66. **Submit**
67. **Create** / **Create New**
68. **Update**
69. **Publish**
70. **Bookmark** / **Favorite** (star icon)
71. **Pin**
72. **Expand** / **Collapse**
73. **Show** / **Hide** (toggles for display)
74. **Enable** / **Disable**
75. **Lock** / **Unlock**
76. **Invite Members** (collaboration)
77. **Accept Invitation**
78. **Leave Team**
79. **Grant Access** / **Revoke Access**
80. **Resolve** / **Close** (comments)
81. **Reply** (comment threads)
82. **Mention** / **Tag** (@user)
83. **Attach File**
84. **Detach**
85. **Compare** (versions, models)
86. **Merge**
87. **Revert** (to previous version)
88. **Fork** / **Branch**
89. **Deploy**
90. **Test**
91. **Benchmark**
92. **Calibrate**
93. **Verify**
94. **Certify**
95. **Approve**
96. **Reject**
97. **Flag** / **Report Issue**
98. **Fix**
99. **Ignore**
100. **Dismiss Warning**

### Toggle Switches
- Dark Mode / Light Mode
- Auto-Save ON/OFF
- Grid Display ON/OFF
- Snap ON/OFF
- Show Labels ON/OFF
- Show Loads ON/OFF
- Show Supports ON/OFF
- 2D / 3D View Toggle
- Wireframe / Solid Rendering

### Dropdown Menus
- Load Case Selector
- Load Combination Selector
- Material Selector
- Section Selector
- Design Code Selector
- Unit System Selector
- View Preset Selector
- Render Mode Selector
- Sort By Selector
- Filter By Selector
- User Menu (Account dropdown)
- Language Selector
- Currency Selector

### Checkboxes (Feature Toggles)
- Include Self-Weight
- Show Deformed Shape
- Show Node Numbers
- Show Member Numbers
- Show Grid
- Show Dimensions
- Enable GPU Acceleration
- Enable Rust Solver
- Apply P-Delta
- Include in Load Combination
- Export Reactions
- Export Diagrams
- Export Calculations
- Email Notifications
- Two-Factor Authentication

### Sliders
- Deformation Scale (1x to 100x)
- Label Size
- Load Arrow Scale
- Grid Spacing
- Animation Speed
- Transparency
- Zoom Level

### Input Fields (Text/Number)
- Project Name
- Client Name
- Engineer Name
- Search Bar
- Node Coordinates (X, Y, Z)
- Load Magnitude (Fx, Fy, Fz, Mx, My, Mz)
- Material Properties (E, ν, fy, etc.)
- Section Dimensions
- Number of Divisions
- Convergence Tolerance
- Max Iterations
- Time Step
- Duration
- Damping Ratio

### Context Menus (Right-Click)
On Project Card:
- Open
- Rename
- Duplicate
- Export
- Share
- Archive
- Delete

On Model Elements:
- Edit Properties
- Assign Material
- Assign Section
- Apply Load
- Release DOF
- Copy
- Delete
- Isolate
- Hide

---

## SUMMARY

**BeamLab Ultimate** is a comprehensive structural analysis and design platform with **200+ features** organized across:

- **1 Landing Page** with hero sections, features, pricing, screenshots, testimonials
- **1 Dashboard** for project management with cards, filters, templates
- **1 Project Initialization Wizard** (4 steps)
- **1 Main 3D Modeling Workspace** with 5 primary tabs (Geometry, Properties, Loading, Analysis, Design)
- **10+ Dedicated Analysis Pages** (Modal, Time History, Pushover, Nonlinear, P-Delta, Buckling, Cable, Plate/Shell, Sensitivity, Dynamic)
- **1 Structural Design Center** with 6 sub-modules
- **5 Tools & Utilities** (Load Combos, Section Database, BBS, Meshing, Print/Export)
- **4 Civil Engineering Suite Modules** (Hydraulics, Transportation, Construction, Quantity Survey)
- **6 Enterprise Features** (Collaboration, BIM, CAD, API, Materials DB, Compliance Checker)
- **5 Report & Visualization Pages**
- **2 AI-Powered Features** (AI Dashboard, AI Power Panel)
- **10+ Settings & Account Pages**
- **8 Help & Learning Resources**
- **100+ Buttons** and controls
- **50+ Keyboard Shortcuts**

**Every feature is designed per industry standards (STAAD.Pro-class), follows Indian & International design codes, and provides complete transparency in calculations with professional-grade report generation.**

---

*Document Version 1.0 - Created on Thursday, 6 March 2026*
*For: BeamLab Ultimate - The Future of Structural Analysis*
