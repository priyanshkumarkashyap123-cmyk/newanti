'use client';

import React, { useState, useCallback, useEffect } from 'react';

// ============================================================================
// BOOK DATA & CONTENT
// ============================================================================

interface Chapter {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  content: ContentSection[];
}

interface ContentSection {
  heading?: string;
  paragraphs?: string[];
  bulletPoints?: string[];
  code?: string;
  formula?: string;
  image?: string;
  note?: string;
}

const BOOK_DATA = {
  title: 'Civil Engineering\nDesign & Analysis',
  subtitle: 'A Comprehensive Guide to Modern Structural Design',
  author: 'Engineering Excellence Institute',
  edition: 'Second Edition',
  year: '2026',
  dedication: 'Dedicated to all engineers who build the foundations of our world.',
  
  introduction: {
    title: 'Introduction',
    content: [
      'Welcome to the comprehensive Civil Engineering Design & Analysis platform. This integrated system provides engineers, students, and professionals with powerful tools for structural analysis, geotechnical engineering, hydraulics, transportation design, and land surveying.',
      'This book-style interface guides you through the complete capabilities of our engineering suite. Each chapter focuses on a specific discipline, presenting theoretical foundations alongside practical calculation tools.',
      'Our platform combines rigorous mathematical analysis with intuitive visualization, enabling you to not only compute results but also understand the underlying engineering principles.',
      'Whether you are designing a multi-story frame structure, analyzing soil bearing capacity, calculating open channel flow, or setting out a highway curve, this comprehensive tool provides the accuracy and reliability that modern engineering demands.'
    ],
    features: [
      'Real-time structural analysis with graphical output',
      'Multiple geotechnical analysis methods (Terzaghi, Meyerhof, Hansen, Vesic)',
      'Complete hydraulic calculations for open channels and pipe networks',
      'Transportation geometric design per AASHTO and IRC standards',
      'Surveying computations with geodetic accuracy',
      'Interactive 2D and 3D visualization'
    ]
  },
  
  chapters: [
    {
      id: 'structural',
      title: 'Structural Analysis',
      subtitle: 'Frame, Truss & Beam Analysis',
      icon: '🏗️',
      content: [
        {
          heading: 'Overview',
          paragraphs: [
            'Structural analysis forms the backbone of civil engineering design. Our platform implements the Direct Stiffness Method, providing accurate analysis of complex structures under various loading conditions.',
            'The analysis engine supports 2D frame structures (3 degrees of freedom per node), truss systems (2 degrees of freedom per node), and continuous beams using the Three-Moment Equation method.'
          ]
        },
        {
          heading: '2D Frame Analysis',
          paragraphs: [
            'Frame analysis considers axial, shear, and bending effects. Each member is characterized by its cross-sectional properties (area, moment of inertia) and material properties (elastic modulus).'
          ],
          formula: '[K]{D} = {F}\n\nwhere:\n[K] = Global stiffness matrix\n{D} = Displacement vector\n{F} = Force vector',
          bulletPoints: [
            'Support types: Fixed, Pinned, Roller',
            'Load types: Point loads, Distributed loads, Moments',
            'Output: Displacements, Reactions, Member forces, BMD, SFD'
          ]
        },
        {
          heading: 'Truss Analysis',
          paragraphs: [
            'Truss structures carry loads through axial forces only. Our engine supports common truss configurations including Pratt, Howe, Warren, and K-truss types.'
          ],
          bulletPoints: [
            'Pin-jointed assumptions',
            'Axial member forces (Tension/Compression)',
            'Joint displacement analysis',
            'Stability and determinacy checks'
          ]
        },
        {
          heading: 'Continuous Beam Analysis',
          paragraphs: [
            'Multi-span beams are analyzed using the Three-Moment Equation (Clapeyron\'s Theorem), which relates moments at three consecutive supports.'
          ],
          formula: 'M₁L₁ + 2M₂(L₁+L₂) + M₃L₂ = -6(A₁x̄₁/L₁ + A₂x̄₂/L₂)'
        }
      ]
    },
    {
      id: 'geotechnical',
      title: 'Geotechnical Engineering',
      subtitle: 'Soil Mechanics & Foundation Design',
      icon: '⛰️',
      content: [
        {
          heading: 'Overview',
          paragraphs: [
            'Geotechnical engineering deals with the behavior of earth materials and their interaction with structures. Our module covers bearing capacity, settlement analysis, earth pressure, slope stability, and pile foundations.'
          ]
        },
        {
          heading: 'Bearing Capacity',
          paragraphs: [
            'The ultimate bearing capacity of soil determines the maximum load a foundation can safely support. We implement four classical methods:'
          ],
          bulletPoints: [
            'Terzaghi (1943): Original bearing capacity theory',
            'Meyerhof (1963): Includes shape, depth, and inclination factors',
            'Hansen (1970): Extended factors for complex conditions',
            'Vesic (1973): Further refinements for various soil types'
          ],
          formula: 'qᵤ = cNcsc dc ic + qNq sq dq iq + 0.5γBNγ sγ dγ iγ'
        },
        {
          heading: 'Settlement Analysis',
          paragraphs: [
            'Total settlement consists of immediate (elastic), primary consolidation, and secondary compression components.'
          ],
          formula: 'Sₜ = Sᵢ + Sₚ + Sₛ\n\nSₚ = (Cc·H)/(1+e₀) · log((σ₀+Δσ)/σ₀)'
        },
        {
          heading: 'Slope Stability',
          paragraphs: [
            'Slope stability analysis determines the factor of safety against sliding. Methods include:'
          ],
          bulletPoints: [
            'Infinite Slope Analysis: For long uniform slopes',
            'Culmann Method: Planar failure surface',
            'Fellenius Method: Circular failure, total stress',
            'Bishop Simplified: Circular failure, effective stress'
          ]
        }
      ]
    },
    {
      id: 'hydraulics',
      title: 'Hydraulic Engineering',
      subtitle: 'Flow Analysis & Water Resources',
      icon: '💧',
      content: [
        {
          heading: 'Overview',
          paragraphs: [
            'Hydraulic engineering encompasses the analysis of water flow in open channels, pipes, and natural systems. Our module provides tools for channel design, pipe network analysis, and hydrological calculations.'
          ]
        },
        {
          heading: 'Open Channel Flow',
          paragraphs: [
            'Open channel flow is governed by Manning\'s equation for uniform flow conditions. Critical depth and normal depth calculations are essential for channel design.'
          ],
          formula: 'V = (1/n) · R^(2/3) · S^(1/2)\n\nQ = A · V',
          bulletPoints: [
            'Channel sections: Rectangular, Trapezoidal, Circular, Triangular, Parabolic',
            'Flow regimes: Subcritical (Fr < 1), Critical (Fr = 1), Supercritical (Fr > 1)',
            'Specific energy and momentum analysis',
            'Hydraulic jump calculations'
          ]
        },
        {
          heading: 'Pipe Flow',
          paragraphs: [
            'Pipe flow analysis includes head loss calculations using Darcy-Weisbach, Hazen-Williams, and Manning equations.'
          ],
          formula: 'hf = f · (L/D) · (V²/2g)  [Darcy-Weisbach]\n\nhf = 10.67 · Q^1.852 · L / (C^1.852 · D^4.87)  [Hazen-Williams]'
        },
        {
          heading: 'Hydrology',
          paragraphs: [
            'Hydrological analysis estimates runoff from rainfall events. The Rational Method and SCS Curve Number Method are implemented.'
          ],
          formula: 'Q = C · i · A  [Rational Method]\n\nQ = (P - 0.2S)² / (P + 0.8S)  [SCS Method]'
        }
      ]
    },
    {
      id: 'transportation',
      title: 'Transportation Engineering',
      subtitle: 'Highway & Geometric Design',
      icon: '🛣️',
      content: [
        {
          heading: 'Overview',
          paragraphs: [
            'Transportation engineering focuses on the safe and efficient movement of people and goods. Our module covers geometric design, pavement design, traffic flow analysis, and intersection design.'
          ]
        },
        {
          heading: 'Geometric Design',
          paragraphs: [
            'Highway geometric design ensures safe vehicle operation through proper alignment, grades, and sight distances.'
          ],
          bulletPoints: [
            'Stopping Sight Distance (SSD): Perception-reaction + braking distance',
            'Passing Sight Distance (PSD): Safe overtaking distance',
            'Horizontal Curves: Superelevation, widening, transition spirals',
            'Vertical Curves: Crest and sag curve design using K-values'
          ],
          formula: 'SSD = V·t + V²/(2g(f±G))\n\nL = K·A  [Vertical curve length]'
        },
        {
          heading: 'Pavement Design',
          paragraphs: [
            'Pavement design methods include AASHTO flexible and rigid pavement design, as well as IRC methods for Indian conditions.'
          ],
          formula: 'log₁₀W₁₈ = ZR·S₀ + 9.36log₁₀(SN+1) - 0.20 + [log₁₀(ΔPSI/(4.2-1.5))] / [0.40 + 1094/(SN+1)^5.19] + 2.32log₁₀MR - 8.07'
        },
        {
          heading: 'Traffic Flow',
          paragraphs: [
            'Traffic flow theory describes the relationships between flow, density, and speed.'
          ],
          formula: 'q = k · v\n\nwhere q = flow, k = density, v = speed'
        }
      ]
    },
    {
      id: 'surveying',
      title: 'Surveying & Geodesy',
      subtitle: 'Measurement & Coordinate Systems',
      icon: '📐',
      content: [
        {
          heading: 'Overview',
          paragraphs: [
            'Surveying provides the spatial framework for all civil engineering projects. Our module includes coordinate transformations, traverse computations, leveling, curve setting-out, and earthwork calculations.'
          ]
        },
        {
          heading: 'Coordinate Systems',
          paragraphs: [
            'Modern surveying uses multiple coordinate systems including geographic (latitude/longitude), projected (UTM, State Plane), and Earth-Centered Earth-Fixed (ECEF) coordinates.'
          ],
          bulletPoints: [
            'WGS84 and GRS80 ellipsoid parameters',
            'UTM zone calculations',
            'Geodetic to Cartesian conversions',
            'Vincenty formula for accurate distances'
          ]
        },
        {
          heading: 'Traverse Computations',
          paragraphs: [
            'Traverse calculations determine coordinates from field measurements of angles and distances.'
          ],
          formula: 'Latitude = Distance × cos(Bearing)\nDeparture = Distance × sin(Bearing)',
          bulletPoints: [
            'Bowditch (Compass) Rule adjustment',
            'Transit Rule adjustment',
            'Coordinate and DMD area calculations'
          ]
        },
        {
          heading: 'Curve Setting-Out',
          paragraphs: [
            'Circular and transition curves are set out using deflection angles or coordinates.'
          ],
          formula: 'R = 5729.58/D  [Degree of curve]\n\nδ = (l/2R) × (180/π)  [Deflection angle]'
        }
      ]
    },
    {
      id: 'visualization',
      title: 'Visualization Tools',
      subtitle: 'Graphics & Diagrams',
      icon: '📊',
      content: [
        {
          heading: 'Overview',
          paragraphs: [
            'Visualization transforms numerical results into intuitive graphical representations. Our engine generates SVG-based diagrams, interactive canvas graphics, and 3D projections.'
          ]
        },
        {
          heading: 'Structural Diagrams',
          bulletPoints: [
            'Bending Moment Diagrams (BMD)',
            'Shear Force Diagrams (SFD)',
            'Axial Force Diagrams (AFD)',
            'Deflected shape visualization',
            'Member force annotations'
          ]
        },
        {
          heading: 'Geotechnical Visualizations',
          bulletPoints: [
            'Soil profile layers',
            'Foundation bearing zone',
            'Slope geometry with slip circles',
            'Earth pressure distributions',
            'Settlement contours'
          ]
        },
        {
          heading: 'Hydraulic Graphics',
          bulletPoints: [
            'Channel cross-sections with water surface',
            'Pipe network layouts',
            'Flow regime indicators',
            'Rating curves',
            'Hydrograph plots'
          ]
        }
      ]
    }
  ] as Chapter[]
};

// ============================================================================
// BOOK PAGE COMPONENTS
// ============================================================================

interface PageProps {
  children: React.ReactNode;
  pageNumber?: number;
  isLeft?: boolean;
}

const BookPage: React.FC<PageProps> = ({ children, pageNumber, isLeft = false }) => (
  <div className={`
    relative w-full h-full bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50
    ${isLeft ? 'rounded-l-sm' : 'rounded-r-sm'}
    shadow-inner overflow-hidden
  `}>
    {/* Page texture */}
    <div className="absolute inset-0 opacity-30" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
    }} />
    
    {/* Page edge shadow */}
    <div className={`absolute top-0 bottom-0 w-8 ${isLeft ? 'right-0' : 'left-0'} 
      bg-gradient-to-${isLeft ? 'l' : 'r'} from-transparent to-black/5`} />
    
    {/* Content */}
    <div className="relative h-full p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-300">
      {children}
    </div>
    
    {/* Page number */}
    {pageNumber !== undefined && (
      <div className={`absolute bottom-4 ${isLeft ? 'left-8' : 'right-8'} 
        text-amber-800/60 text-sm font-serif italic`}>
        — {pageNumber} —
      </div>
    )}
  </div>
);

// ============================================================================
// COVER PAGE
// ============================================================================

const CoverPage: React.FC = () => (
  <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 
    rounded-r-lg shadow-2xl relative overflow-hidden flex flex-col items-center justify-center p-12">
    
    {/* Decorative pattern */}
    <div className="absolute inset-0 opacity-10">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="gold" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
    
    {/* Gold border frame */}
    <div className="absolute inset-6 border-2 border-amber-500/40 rounded-lg" />
    <div className="absolute inset-8 border border-amber-500/20 rounded-lg" />
    
    {/* Corner ornaments */}
    {['top-10 left-10', 'top-10 right-10', 'bottom-10 left-10', 'bottom-10 right-10'].map((pos, i) => (
      <div key={i} className={`absolute ${pos} text-amber-500/60 text-3xl`}>
        ✦
      </div>
    ))}
    
    {/* Title section */}
    <div className="relative text-center z-10">
      {/* Emblem */}
      <div className="mb-8">
        <div className="w-24 h-24 mx-auto rounded-full border-4 border-amber-500/60 
          flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-transparent">
          <span className="text-5xl">🏛️</span>
        </div>
      </div>
      
      {/* Main title */}
      <h1 className="text-4xl md:text-5xl font-serif font-bold text-amber-100 mb-4 
        tracking-wide leading-tight whitespace-pre-line">
        {BOOK_DATA.title}
      </h1>
      
      {/* Decorative line */}
      <div className="flex items-center justify-center gap-4 my-6">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/60" />
        <span className="text-amber-500/80">✧</span>
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/60" />
      </div>
      
      {/* Subtitle */}
      <p className="text-lg text-amber-200/80 font-serif italic mb-12">
        {BOOK_DATA.subtitle}
      </p>
      
      {/* Author */}
      <div className="mt-8">
        <p className="text-sm text-amber-300/60 uppercase tracking-widest mb-2">
          Presented by
        </p>
        <p className="text-xl text-amber-100 font-serif">
          {BOOK_DATA.author}
        </p>
      </div>
      
      {/* Edition */}
      <div className="mt-12 pt-8 border-t border-amber-500/20">
        <p className="text-amber-300/50 text-sm">
          {BOOK_DATA.edition} • {BOOK_DATA.year}
        </p>
      </div>
    </div>
    
    {/* Spine effect */}
    <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/40 to-transparent" />
  </div>
);

// ============================================================================
// INTRODUCTION PAGE
// ============================================================================

const IntroductionPage: React.FC = () => (
  <BookPage pageNumber={1} isLeft={false}>
    <div className="prose prose-amber max-w-none">
      {/* Chapter header */}
      <div className="text-center mb-8 pb-6 border-b-2 border-amber-200">
        <p className="text-amber-600 text-sm uppercase tracking-widest mb-2">Preface</p>
        <h2 className="text-3xl font-serif text-slate-800 mb-2">
          {BOOK_DATA.introduction.title}
        </h2>
        <div className="flex items-center justify-center gap-2">
          <span className="h-px w-12 bg-amber-300" />
          <span className="text-amber-500">◆</span>
          <span className="h-px w-12 bg-amber-300" />
        </div>
      </div>
      
      {/* Dedication */}
      <div className="text-center italic text-slate-600 mb-8 py-4 
        border-l-4 border-amber-300 bg-amber-50/50 px-6">
        "{BOOK_DATA.dedication}"
      </div>
      
      {/* Introduction paragraphs */}
      <div className="space-y-4 text-slate-700 leading-relaxed text-justify">
        {BOOK_DATA.introduction.content.map((para, i) => (
          <p key={i} className="first-letter:text-4xl first-letter:font-serif 
            first-letter:text-amber-700 first-letter:float-left first-letter:mr-2">
            {para}
          </p>
        ))}
      </div>
      
      {/* Key Features */}
      <div className="mt-8 p-6 bg-gradient-to-br from-amber-100/50 to-orange-100/50 
        rounded-lg border border-amber-200">
        <h3 className="text-lg font-serif text-slate-800 mb-4 flex items-center gap-2">
          <span className="text-amber-600">✦</span> Key Features
        </h3>
        <ul className="space-y-2">
          {BOOK_DATA.introduction.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-700">
              <span className="text-amber-500 mt-1">▸</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </BookPage>
);

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================

interface ContentsPageProps {
  onNavigate: (page: number) => void;
}

const ContentsPage: React.FC<ContentsPageProps> = ({ onNavigate }) => (
  <BookPage pageNumber={2} isLeft={true}>
    <div className="h-full">
      {/* Header */}
      <div className="text-center mb-8 pb-6 border-b-2 border-amber-200">
        <h2 className="text-3xl font-serif text-slate-800 mb-2">
          Table of Contents
        </h2>
        <div className="flex items-center justify-center gap-2">
          <span className="h-px w-12 bg-amber-300" />
          <span className="text-amber-500">◆</span>
          <span className="h-px w-12 bg-amber-300" />
        </div>
      </div>
      
      {/* Contents list */}
      <div className="space-y-1">
        {/* Preface */}
        <button
          onClick={() => onNavigate(1)}
          className="w-full flex items-center justify-between py-3 px-4 
            hover:bg-amber-100/50 rounded-lg transition-colors group"
        >
          <span className="flex items-center gap-3">
            <span className="text-amber-600 group-hover:text-amber-700">📜</span>
            <span className="font-serif text-slate-800">Preface & Introduction</span>
          </span>
          <span className="text-slate-500 font-mono text-sm">i</span>
        </button>
        
        {/* Chapters */}
        {BOOK_DATA.chapters.map((chapter, index) => (
          <button
            key={chapter.id}
            onClick={() => onNavigate(3 + index)}
            className="w-full flex items-center justify-between py-3 px-4 
              hover:bg-amber-100/50 rounded-lg transition-colors group"
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl group-hover:scale-110 transition-transform">
                {chapter.icon}
              </span>
              <span className="text-left">
                <span className="font-serif text-slate-800 block">
                  Chapter {index + 1}: {chapter.title}
                </span>
                <span className="text-sm text-slate-500">{chapter.subtitle}</span>
              </span>
            </span>
            <span className="text-slate-500 font-mono text-sm">{(index + 1) * 10}</span>
          </button>
        ))}
        
        {/* Appendix */}
        <div className="pt-4 mt-4 border-t border-amber-200">
          <button
            onClick={() => onNavigate(3 + BOOK_DATA.chapters.length)}
            className="w-full flex items-center justify-between py-3 px-4 
              hover:bg-amber-100/50 rounded-lg transition-colors group"
          >
            <span className="flex items-center gap-3">
              <span className="text-amber-600 group-hover:text-amber-700">📎</span>
              <span className="font-serif text-slate-800">Appendix & Quick Reference</span>
            </span>
            <span className="text-slate-500 font-mono text-sm">A</span>
          </button>
        </div>
      </div>
      
      {/* Decorative footer */}
      <div className="absolute bottom-16 left-8 right-8 flex justify-center">
        <div className="text-amber-300 text-2xl tracking-widest">· · ·</div>
      </div>
    </div>
  </BookPage>
);

// ============================================================================
// CHAPTER PAGE
// ============================================================================

interface ChapterPageProps {
  chapter: Chapter;
  chapterNumber: number;
}

const ChapterPage: React.FC<ChapterPageProps> = ({ chapter, chapterNumber }) => (
  <BookPage pageNumber={chapterNumber * 10} isLeft={chapterNumber % 2 === 0}>
    <div className="prose prose-amber max-w-none">
      {/* Chapter header */}
      <div className="text-center mb-8 pb-6 border-b-2 border-amber-200">
        <div className="text-6xl mb-4">{chapter.icon}</div>
        <p className="text-amber-600 text-sm uppercase tracking-widest mb-2">
          Chapter {chapterNumber}
        </p>
        <h2 className="text-3xl font-serif text-slate-800 mb-2">
          {chapter.title}
        </h2>
        <p className="text-slate-500 italic">{chapter.subtitle}</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="h-px w-12 bg-amber-300" />
          <span className="text-amber-500">◆</span>
          <span className="h-px w-12 bg-amber-300" />
        </div>
      </div>
      
      {/* Chapter content */}
      <div className="space-y-6">
        {chapter.content.map((section, i) => (
          <div key={i} className="mb-6">
            {section.heading && (
              <h3 className="text-xl font-serif text-slate-800 mb-3 flex items-center gap-2">
                <span className="text-amber-500">§</span>
                {section.heading}
              </h3>
            )}
            
            {section.paragraphs?.map((para, j) => (
              <p key={j} className="text-slate-700 leading-relaxed text-justify mb-3">
                {para}
              </p>
            ))}
            
            {section.formula && (
              <div className="my-4 p-4 bg-slate-800 rounded-lg font-mono text-sm 
                text-amber-100 overflow-x-auto whitespace-pre-wrap">
                {section.formula}
              </div>
            )}
            
            {section.bulletPoints && (
              <ul className="space-y-2 my-4">
                {section.bulletPoints.map((point, k) => (
                  <li key={k} className="flex items-start gap-3 text-slate-700">
                    <span className="text-amber-500 mt-1">▸</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
            
            {section.note && (
              <div className="my-4 p-4 bg-amber-50 border-l-4 border-amber-400 
                rounded-r-lg text-sm text-slate-600 italic">
                <strong className="text-amber-700">Note: </strong>
                {section.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </BookPage>
);

// ============================================================================
// APPENDIX PAGE
// ============================================================================

const AppendixPage: React.FC = () => (
  <BookPage pageNumber={100} isLeft={true}>
    <div className="prose prose-amber max-w-none">
      {/* Header */}
      <div className="text-center mb-8 pb-6 border-b-2 border-amber-200">
        <p className="text-amber-600 text-sm uppercase tracking-widest mb-2">Appendix</p>
        <h2 className="text-3xl font-serif text-slate-800 mb-2">
          Quick Reference Guide
        </h2>
        <div className="flex items-center justify-center gap-2">
          <span className="h-px w-12 bg-amber-300" />
          <span className="text-amber-500">◆</span>
          <span className="h-px w-12 bg-amber-300" />
        </div>
      </div>
      
      {/* Quick reference tables */}
      <div className="space-y-6">
        {/* Material Properties */}
        <div className="border border-amber-200 rounded-lg overflow-hidden">
          <div className="bg-amber-100 px-4 py-2 font-serif text-slate-800">
            Standard Material Properties
          </div>
          <table className="w-full text-sm">
            <thead className="bg-amber-50">
              <tr>
                <th className="px-4 py-2 text-left text-slate-700">Material</th>
                <th className="px-4 py-2 text-right text-slate-700">E (MPa)</th>
                <th className="px-4 py-2 text-right text-slate-700">fy (MPa)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              <tr><td className="px-4 py-2">Concrete M25</td><td className="px-4 py-2 text-right">25,000</td><td className="px-4 py-2 text-right">—</td></tr>
              <tr><td className="px-4 py-2">Concrete M30</td><td className="px-4 py-2 text-right">27,386</td><td className="px-4 py-2 text-right">—</td></tr>
              <tr><td className="px-4 py-2">Steel Fe415</td><td className="px-4 py-2 text-right">200,000</td><td className="px-4 py-2 text-right">415</td></tr>
              <tr><td className="px-4 py-2">Steel Fe500</td><td className="px-4 py-2 text-right">200,000</td><td className="px-4 py-2 text-right">500</td></tr>
            </tbody>
          </table>
        </div>
        
        {/* Unit Conversions */}
        <div className="border border-amber-200 rounded-lg overflow-hidden">
          <div className="bg-amber-100 px-4 py-2 font-serif text-slate-800">
            Unit Conversions
          </div>
          <div className="p-4 grid grid-cols-2 gap-4 text-sm text-slate-700">
            <div>1 kN = 1000 N</div>
            <div>1 MPa = 1 N/mm²</div>
            <div>1 m = 1000 mm</div>
            <div>1 kN/m = 1 N/mm</div>
            <div>1 kNm = 10⁶ Nmm</div>
            <div>1 ft = 304.8 mm</div>
          </div>
        </div>
        
        {/* Common Formulas */}
        <div className="border border-amber-200 rounded-lg overflow-hidden">
          <div className="bg-amber-100 px-4 py-2 font-serif text-slate-800">
            Essential Formulas
          </div>
          <div className="p-4 space-y-3 font-mono text-sm">
            <div className="p-2 bg-slate-800 text-amber-100 rounded">
              σ = M·y/I  (Bending stress)
            </div>
            <div className="p-2 bg-slate-800 text-amber-100 rounded">
              δ = PL³/3EI  (Cantilever deflection)
            </div>
            <div className="p-2 bg-slate-800 text-amber-100 rounded">
              Pcr = π²EI/L²  (Euler buckling)
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-amber-200 text-center text-slate-500 text-sm">
        <p>Civil Engineering Design & Analysis Platform</p>
        <p className="mt-1">Version 2.0 • {BOOK_DATA.year}</p>
      </div>
    </div>
  </BookPage>
);

// ============================================================================
// MAIN BOOK INTERFACE
// ============================================================================

export const BookInterface: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  
  // Total pages: Cover(0), Intro(1), Contents(2), Chapters(3-8), Appendix(9)
  const totalPages = 3 + BOOK_DATA.chapters.length + 1;
  
  const goToPage = useCallback((page: number) => {
    if (isAnimating || page === currentPage) return;
    if (page < 0 || page >= totalPages) return;
    
    setFlipDirection(page > currentPage ? 'next' : 'prev');
    setIsAnimating(true);
    
    setTimeout(() => {
      setCurrentPage(page);
      setIsAnimating(false);
    }, 400);
  }, [currentPage, isAnimating, totalPages]);
  
  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'Home') goToPage(0);
      if (e.key === 'End') goToPage(totalPages - 1);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage, goToPage, totalPages]);
  
  // Render current page content
  const renderPageContent = () => {
    if (currentPage === 0) return <CoverPage />;
    if (currentPage === 1) return <IntroductionPage />;
    if (currentPage === 2) return <ContentsPage onNavigate={goToPage} />;
    if (currentPage >= 3 && currentPage < 3 + BOOK_DATA.chapters.length) {
      const chapterIndex = currentPage - 3;
      return (
        <ChapterPage 
          chapter={BOOK_DATA.chapters[chapterIndex]} 
          chapterNumber={chapterIndex + 1} 
        />
      );
    }
    return <AppendixPage />;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 
      flex flex-col items-center justify-center p-4 md:p-8">
      
      {/* Title bar */}
      <div className="mb-6 text-center">
        <h1 className="text-amber-100/80 font-serif text-lg md:text-xl">
          📚 Civil Engineering Reference Library
        </h1>
      </div>
      
      {/* Book container */}
      <div className="relative w-full max-w-4xl aspect-[4/3] perspective-1000">
        {/* Book shadow */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[90%] h-8 
          bg-black/30 blur-xl rounded-full" />
        
        {/* Book */}
        <div 
          className={`
            relative w-full h-full transform-style-3d transition-transform duration-500
            ${isAnimating ? (flipDirection === 'next' ? 'animate-page-flip-next' : 'animate-page-flip-prev') : ''}
          `}
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Page content */}
          <div className={`
            w-full h-full rounded-lg overflow-hidden
            ${currentPage === 0 ? '' : 'bg-amber-900/20'}
          `}>
            {renderPageContent()}
          </div>
        </div>
        
        {/* Navigation arrows */}
        {currentPage > 0 && (
          <button
            onClick={prevPage}
            disabled={isAnimating}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 
              bg-amber-500/80 hover:bg-amber-400 rounded-full 
              flex items-center justify-center text-white text-xl
              shadow-lg transition-all hover:scale-110 disabled:opacity-50
              disabled:hover:scale-100"
            aria-label="Previous page"
          >
            ←
          </button>
        )}
        
        {currentPage < totalPages - 1 && (
          <button
            onClick={nextPage}
            disabled={isAnimating}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 
              bg-amber-500/80 hover:bg-amber-400 rounded-full 
              flex items-center justify-center text-white text-xl
              shadow-lg transition-all hover:scale-110 disabled:opacity-50
              disabled:hover:scale-100"
            aria-label="Next page"
          >
            →
          </button>
        )}
      </div>
      
      {/* Page indicator */}
      <div className="mt-6 flex items-center gap-4">
        {/* Page dots */}
        <div className="flex gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentPage 
                  ? 'bg-amber-400 w-6' 
                  : 'bg-amber-600/40 hover:bg-amber-500/60'
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
        
        {/* Page number */}
        <span className="text-amber-300/60 text-sm font-mono">
          {currentPage + 1} / {totalPages}
        </span>
      </div>
      
      {/* Keyboard hint */}
      <div className="mt-4 text-amber-400/40 text-xs">
        Use ← → arrow keys or click to navigate
      </div>
      
      {/* Custom styles */}
      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        
        @keyframes pageFlipNext {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(-5deg); }
          100% { transform: rotateY(0deg); }
        }
        
        @keyframes pageFlipPrev {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(5deg); }
          100% { transform: rotateY(0deg); }
        }
        
        .animate-page-flip-next {
          animation: pageFlipNext 0.4s ease-in-out;
        }
        
        .animate-page-flip-prev {
          animation: pageFlipPrev 0.4s ease-in-out;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thumb-amber-300::-webkit-scrollbar-thumb {
          background: rgb(252 211 77 / 0.5);
          border-radius: 3px;
        }
        
        .scrollbar-thumb-amber-300::-webkit-scrollbar-thumb:hover {
          background: rgb(252 211 77 / 0.7);
        }
      `}</style>
    </div>
  );
};

export default BookInterface;
