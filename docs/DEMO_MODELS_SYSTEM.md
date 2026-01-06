# Demo Models System - STAAD.Pro Style Learning Library

## Overview
BeamLab now features a comprehensive demo models library, similar to STAAD.Pro's demo system, where users can load pre-configured structures to learn and explore.

## Features

### 📚 Demo Model Categories
1. **Frames** - Portal frames, warehouse structures
2. **Trusses** - Warren trusses, bridge trusses
3. **Bridges** - Suspension bridges, cable-stayed bridges
4. **Towers** - Communication towers, tall buildings
5. **Buildings** - Super-tall structures, commercial buildings

### 🎯 Difficulty Levels
- **Beginner**: Simple frames, basic trusses
- **Intermediate**: Multi-bay frames, longer span trusses
- **Advanced**: Complex bridges, tall buildings
- **Expert**: Burj Khalifa, Golden Gate Bridge

## Available Demo Models

### 1. Simple Portal Frame
- **Difficulty**: Beginner
- **Category**: Frames
- **Size**: 8m × 4m
- **Members**: 3 members, 4 nodes
- **Sections**: ISMB 250-300
- **Learning Objectives**:
  - Moment distribution in frames
  - Fixed vs. pinned supports
  - Beam-column behavior

### 2. Warren Truss Bridge
- **Difficulty**: Beginner
- **Category**: Trusses
- **Span**: 20m
- **Members**: 24+ members, 18 nodes
- **Sections**: ISLB 200, ISA 100×100
- **Learning Objectives**:
  - Tension/compression in truss members
  - Method of joints and sections
  - Truss efficiency

### 3. Burj Khalifa (Simplified)
- **Difficulty**: Expert
- **Category**: Towers
- **Height**: 600m (simplified from 828m)
- **Members**: 40+ members, 17 nodes
- **Sections**: Mega-columns (1200×1200×50mm tubes), Outriggers
- **Real Structure**: Burj Khalifa, Dubai, UAE
- **Year Built**: 2010
- **Designer**: Adrian Smith (SOM)
- **Special Features**:
  - Pre-configured Burj Khalifa analysis
  - Wind speed: 62.5 m/s
  - Seismic zone: 0.15g
  - Temperature delta: 50°C
- **Learning Objectives**:
  - Super-tall building behavior
  - Outrigger-belt truss systems
  - Progressive collapse resistance
  - Wind and seismic effects
  - Differential column shortening

### 4. Golden Gate Bridge (Simplified)
- **Difficulty**: Advanced
- **Category**: Bridges
- **Span**: 1280m main span
- **Tower Height**: 227m
- **Members**: 50+ members
- **Sections**: 3000×3000mm tower legs, 7600mm girders
- **Real Structure**: Golden Gate Bridge, San Francisco, USA
- **Year Built**: 1937
- **Designer**: Joseph Strauss
- **Learning Objectives**:
  - Suspension bridge mechanics
  - Cable forces and geometry
  - Tower-deck interaction
  - Aerodynamic stability

## How to Use

### 1. Open Demo Models Library
Click **"Load Demo Model"** button in the ModelingToolbar (top of screen)

### 2. Browse by Category
- Use tabs to filter: All Models, Frames, Trusses, Bridges, Towers, Buildings
- Each model shows:
  - Difficulty badge (color-coded)
  - Real-world structure name
  - Location and year built
  - Designer
  - Dimensions (height/length)
  - Learning objectives (first 3 shown)

### 3. View Details
Click on any model card to see:
- Complete structure details
- Full list of learning objectives
- Number of nodes and members
- Metadata (location, designer, etc.)

### 4. Load Model
Click **"Load Model"** button to:
- Load structure into viewport
- Apply all node coordinates
- Apply all member sections with real properties
- Ready to analyze immediately

### 5. Analyze
For models with pre-configured analysis (like Burj Khalifa):
- Analysis settings are already optimized
- Can open Burj Khalifa Analysis panel
- Run analysis with realistic loads
- View detailed results

### 6. Modify and Learn
- Modify loaded structure (add/remove members, change sections)
- Re-analyze with different loads
- Export results
- Save as your own project

## Technical Implementation

### File Structure
```
apps/web/src/
├── data/
│   └── DemoModelsLibrary.ts          # 4+ demo models with full geometry
├── components/
│   └── DemoModelsPanel.tsx           # UI for browsing/loading demos
└── toolbar/
    └── ModelingToolbar.tsx           # Updated with demo button
```

### Data Structure
```typescript
export interface DemoModel {
    id: string;
    name: string;
    description: string;
    category: 'buildings' | 'bridges' | 'towers' | 'trusses' | 'frames';
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    learningObjectives: string[];
    structure: GeneratedStructure;  // nodes + members with full properties
    analysisConfig?: {              // Optional pre-configured analysis
        type: 'burj-khalifa' | 'generic';
        config?: any;
    };
    metadata: {                     // Real-world information
        realWorldStructure?: string;
        location?: string;
        yearBuilt?: number;
        height?: number;
        length?: number;
        designer?: string;
    };
}
```

### Integration with Burj Khalifa Analysis
The Burj Khalifa demo model includes:
- Pre-configured analysis settings
- Realistic wind speed (62.5 m/s)
- Seismic zone (0.15g for UAE)
- Temperature swing (50°C)
- Can be loaded and analyzed immediately

## For Educators

### Teaching Applications
1. **Beginner Classes**: Start with Simple Frame, Warren Truss
2. **Intermediate Classes**: Use longer span bridges, multi-story frames
3. **Advanced Classes**: Golden Gate Bridge, complex structures
4. **Expert Classes**: Burj Khalifa with full analysis

### Assignments
- Load demo model
- Modify one parameter (span, height, section)
- Analyze and compare results
- Document changes and outcomes

### Learning Path
1. Simple Frame → Understand fixed supports, moment distribution
2. Warren Truss → Learn truss analysis, tension/compression
3. Golden Gate → Study suspension bridges, cable mechanics
4. Burj Khalifa → Analyze tall buildings, wind/seismic effects

## Future Expansion

### Additional Models Planned
- [ ] Chenab Bridge (Indian Railways, world's highest bridge)
- [ ] Howrah Bridge (Kolkata cantilever)
- [ ] Bandra-Worli Sea Link (cable-stayed)
- [ ] CN Tower (Toronto, 553m)
- [ ] Empire State Building (102 floors)
- [ ] Simple cantilever beam (beginner)
- [ ] Continuous beam (beginner)
- [ ] Multi-bay frame (intermediate)

### Enhancements
- [ ] Thumbnail images for each demo
- [ ] Video tutorials linked to demos
- [ ] Step-by-step analysis walkthroughs
- [ ] Comparison mode (compare your analysis to reference)
- [ ] Export demo as teaching material

## Educational Benefits

### For Students
- **Hands-on Learning**: Immediate access to real structures
- **Progressive Difficulty**: Start simple, advance to complex
- **Real-World Context**: Learn from actual engineering projects
- **No Setup Time**: Pre-configured and ready to analyze
- **Safe Exploration**: Modify without breaking anything

### For Instructors
- **Teaching Aid**: Demonstrate concepts with real examples
- **Standardized Examples**: All students use same model
- **Assignment Ready**: Pre-configured problems
- **Time Saver**: No need to create example structures
- **Quality Assurance**: Verified, correct structural configurations

## Comparison to STAAD.Pro

### Similar Features
- ✅ Demo model library
- ✅ Category organization
- ✅ One-click loading
- ✅ Pre-configured analysis
- ✅ Learning objectives

### BeamLab Advantages
- ✅ Web-based (no installation)
- ✅ Free access to all demos
- ✅ Real section properties from day one
- ✅ Interactive 3D visualization
- ✅ Modern UI/UX

## API Usage

```typescript
// Get all demo models
import { DEMO_MODELS } from '../data/DemoModelsLibrary';

// Get specific demo
import { getDemoModel } from '../data/DemoModelsLibrary';
const burj = getDemoModel('burj-khalifa-simplified');

// Filter by category
import { getDemosByCategory } from '../data/DemoModelsLibrary';
const bridges = getDemosByCategory('bridges');

// Filter by difficulty
import { getDemosByDifficulty } from '../data/DemoModelsLibrary';
const beginnerModels = getDemosByDifficulty('beginner');

// Load demo into model store
const { setNodes, setMembers } = useModelStore();
setNodes(demo.structure.nodes);
setMembers(demo.structure.members);
```

## Version History
- **v1.0** (January 2025): Initial release
  - 4 demo models
  - 5 categories
  - 4 difficulty levels
  - Burj Khalifa with pre-configured analysis
  - Golden Gate Bridge
  - Warren Truss
  - Simple Frame

---

## Summary
The Demo Models System transforms BeamLab into a comprehensive learning platform, providing students and engineers with instant access to real-world structural examples. Just like STAAD.Pro's demo library helped millions learn structural analysis, BeamLab's demo system makes advanced analysis accessible to everyone through a modern, web-based interface.
