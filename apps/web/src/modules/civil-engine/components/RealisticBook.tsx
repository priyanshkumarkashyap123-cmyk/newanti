'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// REALISTIC BOOK STYLES (CSS-in-JS)
// ============================================================================

const bookStyles = `
  /* Book container */
  .realistic-book {
    position: relative;
    width: 100%;
    max-width: 900px;
    aspect-ratio: 16/10;
    perspective: 2000px;
    transform-style: preserve-3d;
  }
  
  /* Book binding */
  .book-spine {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 30px;
    transform: translateX(-50%);
    background: linear-gradient(90deg, 
      #2c1810 0%, 
      #4a2c1c 20%, 
      #5d3a28 50%,
      #4a2c1c 80%, 
      #2c1810 100%
    );
    border-radius: 3px;
    z-index: 100;
    box-shadow: 
      0 0 10px rgba(0,0,0,0.5),
      inset 0 0 5px rgba(0,0,0,0.3);
  }
  
  /* Page base */
  .book-page {
    position: absolute;
    width: 50%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.6s ease-in-out;
    transform-origin: left center;
  }
  
  .book-page.right {
    right: 0;
    transform-origin: left center;
  }
  
  .book-page.left {
    left: 0;
    transform-origin: right center;
  }
  
  /* Page face */
  .page-face {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    background: linear-gradient(135deg, 
      #fef9f0 0%, 
      #fcf4e8 50%, 
      #f8efe0 100%
    );
    border-radius: 0 8px 8px 0;
    box-shadow: 
      2px 0 5px rgba(0,0,0,0.1),
      inset -5px 0 15px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  
  .page-face.back {
    transform: rotateY(180deg);
    border-radius: 8px 0 0 8px;
    box-shadow: 
      -2px 0 5px rgba(0,0,0,0.1),
      inset 5px 0 15px rgba(0,0,0,0.05);
  }
  
  /* Page texture overlay */
  .page-texture {
    position: absolute;
    inset: 0;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    pointer-events: none;
  }
  
  /* Page edge lines */
  .page-lines {
    position: absolute;
    right: 0;
    top: 10%;
    bottom: 10%;
    width: 3px;
    background: repeating-linear-gradient(
      to bottom,
      transparent,
      transparent 2px,
      rgba(200, 180, 160, 0.3) 2px,
      rgba(200, 180, 160, 0.3) 3px
    );
  }
  
  .page-face.back .page-lines {
    right: auto;
    left: 0;
  }
  
  /* Flip animation */
  .book-page.flipping {
    animation: pageFlip 0.8s ease-in-out forwards;
    z-index: 50;
  }
  
  .book-page.flipping-back {
    animation: pageFlipBack 0.8s ease-in-out forwards;
    z-index: 50;
  }
  
  @keyframes pageFlip {
    0% { transform: rotateY(0deg); }
    100% { transform: rotateY(-180deg); }
  }
  
  @keyframes pageFlipBack {
    0% { transform: rotateY(-180deg); }
    100% { transform: rotateY(0deg); }
  }
  
  /* Page curl effect */
  .page-curl {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, 
      transparent 50%, 
      rgba(0,0,0,0.05) 50%
    );
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .page-curl:hover {
    width: 80px;
    height: 80px;
  }
  
  /* Content area */
  .page-content {
    height: 100%;
    padding: 2rem;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(180, 160, 140, 0.4) transparent;
  }
  
  .page-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .page-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .page-content::-webkit-scrollbar-thumb {
    background: rgba(180, 160, 140, 0.4);
    border-radius: 3px;
  }
  
  /* Decorative elements */
  .ornament {
    font-family: serif;
    color: #8b7355;
    opacity: 0.6;
  }
  
  .drop-cap {
    float: left;
    font-size: 4rem;
    line-height: 1;
    font-family: Georgia, serif;
    color: #5d4037;
    margin-right: 0.5rem;
    margin-top: 0.2rem;
  }
  
  /* Navigation */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(93, 64, 55, 0.8);
    color: #fef9f0;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 200;
  }
  
  .nav-arrow:hover {
    background: rgba(93, 64, 55, 1);
    transform: translateY(-50%) scale(1.1);
  }
  
  .nav-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .nav-arrow.left { left: -70px; }
  .nav-arrow.right { right: -70px; }
  
  @media (max-width: 1100px) {
    .nav-arrow.left { left: 10px; }
    .nav-arrow.right { right: 10px; }
  }
`;

// ============================================================================
// BOOK DATA
// ============================================================================

interface BookPage {
  id: string;
  type: 'cover' | 'title' | 'dedication' | 'toc' | 'chapter-start' | 'chapter-content' | 'appendix';
  title?: string;
  subtitle?: string;
  content?: React.ReactNode;
}

const BOOK_METADATA = {
  title: 'Civil Engineering\nDesign & Analysis',
  subtitle: 'A Comprehensive Guide to Modern Structural Design',
  author: 'Engineering Excellence Institute',
  publisher: 'Technical Publishing House',
  edition: 'Second Edition',
  year: '2026',
  isbn: '978-0-000000-00-0',
  dedication: 'To the engineers who transform dreams into reality,\nand to the structures that stand as testaments to human ingenuity.',
};

// ============================================================================
// PAGE CONTENT COMPONENTS
// ============================================================================

const CoverPageContent: React.FC = () => (
  <div className="h-full w-full bg-gradient-to-br from-[#1a0f0a] via-[#2c1810] to-[#1a0f0a] 
    flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
    
    {/* Decorative border */}
    <div className="absolute inset-4 border-2 border-amber-600/30 rounded-lg" />
    <div className="absolute inset-6 border border-amber-600/20 rounded-lg" />
    
    {/* Corner decorations */}
    {['top-8 left-8', 'top-8 right-8', 'bottom-8 left-8', 'bottom-8 right-8'].map((pos, i) => (
      <div key={i} className={`absolute ${pos} text-amber-500/40 text-2xl ornament`}>
        ❧
      </div>
    ))}
    
    {/* Emblem */}
    <div className="mb-8 relative">
      <div className="w-28 h-28 rounded-full border-4 border-amber-500/50 
        flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-transparent
        shadow-[0_0_30px_rgba(245,158,11,0.3)]">
        <span className="text-6xl">🏛️</span>
      </div>
    </div>
    
    {/* Title */}
    <h1 className="text-3xl md:text-4xl font-serif text-amber-100 mb-4 leading-tight whitespace-pre-line
      tracking-wide [text-shadow:_0_2px_10px_rgba(245,158,11,0.3)]">
      {BOOK_METADATA.title}
    </h1>
    
    {/* Decorative divider */}
    <div className="flex items-center gap-4 my-4">
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/60" />
      <span className="text-amber-400 ornament">✦</span>
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/60" />
    </div>
    
    {/* Subtitle */}
    <p className="text-amber-200/70 font-serif italic text-lg mb-12 max-w-md">
      {BOOK_METADATA.subtitle}
    </p>
    
    {/* Author */}
    <div className="mt-auto">
      <p className="text-amber-400/50 text-sm uppercase tracking-[0.3em] mb-2">
        By
      </p>
      <p className="text-amber-100 font-serif text-xl">
        {BOOK_METADATA.author}
      </p>
    </div>
    
    {/* Edition badge */}
    <div className="absolute bottom-8 px-4 py-2 border border-amber-500/30 rounded">
      <p className="text-amber-300/60 text-sm tracking-wider">
        {BOOK_METADATA.edition} — {BOOK_METADATA.year}
      </p>
    </div>
  </div>
);

const TitlePageContent: React.FC = () => (
  <div className="page-content flex flex-col items-center justify-center text-center">
    <div className="mb-8">
      <p className="text-amber-700/60 text-sm uppercase tracking-[0.3em]">
        {BOOK_METADATA.publisher}
      </p>
    </div>
    
    <h1 className="text-3xl font-serif text-slate-800 mb-2 whitespace-pre-line leading-tight">
      {BOOK_METADATA.title}
    </h1>
    
    <p className="text-slate-500 font-serif italic mb-8">
      {BOOK_METADATA.subtitle}
    </p>
    
    <div className="w-24 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent my-8" />
    
    <p className="text-slate-700 font-serif text-lg mb-2">
      {BOOK_METADATA.author}
    </p>
    
    <div className="mt-auto pt-12">
      <p className="text-slate-400 text-sm">{BOOK_METADATA.edition}</p>
      <p className="text-slate-400 text-xs mt-1">ISBN: {BOOK_METADATA.isbn}</p>
    </div>
  </div>
);

const DedicationPageContent: React.FC = () => (
  <div className="page-content flex flex-col items-center justify-center">
    <div className="max-w-sm text-center">
      <p className="text-amber-700/50 text-sm uppercase tracking-[0.2em] mb-8">
        Dedication
      </p>
      <p className="text-slate-700 font-serif italic text-lg leading-relaxed whitespace-pre-line">
        {BOOK_METADATA.dedication}
      </p>
      <div className="mt-8 text-amber-600/40 text-2xl ornament">❦</div>
    </div>
  </div>
);

const TableOfContentsContent: React.FC<{ onNavigate: (page: number) => void }> = ({ onNavigate }) => {
  const chapters = [
    { num: 1, title: 'Structural Analysis', subtitle: 'Frame, Truss & Beam Analysis', page: 6, icon: '🏗️' },
    { num: 2, title: 'Geotechnical Engineering', subtitle: 'Soil Mechanics & Foundation Design', page: 10, icon: '⛰️' },
    { num: 3, title: 'Hydraulic Engineering', subtitle: 'Flow Analysis & Water Resources', page: 14, icon: '💧' },
    { num: 4, title: 'Transportation Engineering', subtitle: 'Highway & Geometric Design', page: 18, icon: '🛣️' },
    { num: 5, title: 'Surveying & Geodesy', subtitle: 'Measurement & Coordinate Systems', page: 22, icon: '📐' },
    { num: 6, title: 'Visualization Tools', subtitle: 'Graphics & Diagrams', page: 26, icon: '📊' },
  ];
  
  return (
    <div className="page-content">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-serif text-slate-800 mb-2">Contents</h2>
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-amber-300" />
          <span className="text-amber-500 ornament">❧</span>
          <span className="h-px w-10 bg-amber-300" />
        </div>
      </div>
      
      <div className="space-y-1">
        {/* Preface */}
        <button 
          onClick={() => onNavigate(2)}
          className="w-full flex items-center gap-4 py-3 px-4 rounded-lg 
            hover:bg-amber-100/50 transition-colors group text-left"
        >
          <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity">📜</span>
          <span className="flex-1">
            <span className="font-serif text-slate-800">Preface</span>
          </span>
          <span className="text-slate-400 font-mono text-sm">i</span>
        </button>
        
        {/* Chapters */}
        {chapters.map((ch, i) => (
          <button
            key={ch.num}
            onClick={() => onNavigate(4 + i * 2)}
            className="w-full flex items-center gap-4 py-3 px-4 rounded-lg 
              hover:bg-amber-100/50 transition-colors group text-left"
          >
            <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity">
              {ch.icon}
            </span>
            <span className="flex-1">
              <span className="font-serif text-slate-800 block">
                {ch.num}. {ch.title}
              </span>
              <span className="text-sm text-slate-400">{ch.subtitle}</span>
            </span>
            <span className="text-slate-400 font-mono text-sm">{ch.page}</span>
          </button>
        ))}
        
        {/* Appendix */}
        <div className="pt-4 mt-4 border-t border-amber-200/50">
          <button
            onClick={() => onNavigate(16)}
            className="w-full flex items-center gap-4 py-3 px-4 rounded-lg 
              hover:bg-amber-100/50 transition-colors group text-left"
          >
            <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity">📎</span>
            <span className="flex-1">
              <span className="font-serif text-slate-800">Appendix</span>
            </span>
            <span className="text-slate-400 font-mono text-sm">A</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const PrefaceContent: React.FC = () => (
  <div className="page-content">
    <div className="text-center mb-6">
      <p className="text-amber-600 text-xs uppercase tracking-[0.2em] mb-1">Preface</p>
      <h2 className="text-xl font-serif text-slate-800">Introduction</h2>
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="h-px w-8 bg-amber-300" />
        <span className="text-amber-500 text-sm ornament">◆</span>
        <span className="h-px w-8 bg-amber-300" />
      </div>
    </div>
    
    <div className="text-slate-700 text-sm leading-relaxed text-justify space-y-4">
      <p>
        <span className="drop-cap">W</span>elcome to the comprehensive Civil Engineering Design & Analysis platform. 
        This integrated system provides engineers, students, and professionals with powerful tools for 
        structural analysis, geotechnical engineering, hydraulics, transportation design, and land surveying.
      </p>
      
      <p>
        This book-style interface guides you through the complete capabilities of our engineering suite. 
        Each chapter focuses on a specific discipline, presenting theoretical foundations alongside 
        practical calculation tools.
      </p>
      
      <p>
        Our platform combines rigorous mathematical analysis with intuitive visualization, enabling you 
        to not only compute results but also understand the underlying engineering principles.
      </p>
      
      <div className="mt-6 p-4 bg-amber-50/50 rounded-lg border border-amber-200/50">
        <h3 className="font-serif text-slate-800 mb-3 flex items-center gap-2">
          <span className="text-amber-600">✦</span> Key Features
        </h3>
        <ul className="space-y-2 text-sm">
          {[
            'Real-time structural analysis with graphical output',
            'Multiple geotechnical analysis methods',
            'Complete hydraulic calculations',
            'Transportation geometric design',
            'Surveying computations with geodetic accuracy',
            'Interactive 2D and 3D visualization'
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

interface ChapterPageProps {
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  sections: {
    heading: string;
    content: string;
    formula?: string;
    points?: string[];
  }[];
}

const ChapterStartContent: React.FC<ChapterPageProps> = ({ number, title, subtitle, icon }) => (
  <div className="page-content flex flex-col items-center justify-center text-center h-full">
    <div className="text-8xl mb-6 opacity-80">{icon}</div>
    <p className="text-amber-600 text-xs uppercase tracking-[0.3em] mb-2">
      Chapter {number}
    </p>
    <h1 className="text-3xl font-serif text-slate-800 mb-3">{title}</h1>
    <p className="text-slate-400 italic">{subtitle}</p>
    <div className="flex items-center gap-3 mt-6">
      <span className="h-px w-12 bg-amber-300" />
      <span className="text-amber-500 ornament">❧</span>
      <span className="h-px w-12 bg-amber-300" />
    </div>
  </div>
);

const ChapterContentPage: React.FC<ChapterPageProps> = ({ sections }) => (
  <div className="page-content">
    <div className="space-y-6 text-sm">
      {sections.map((section, i) => (
        <div key={i}>
          <h3 className="font-serif text-slate-800 mb-2 flex items-center gap-2">
            <span className="text-amber-500">§</span>
            {section.heading}
          </h3>
          <p className="text-slate-700 leading-relaxed text-justify mb-3">
            {section.content}
          </p>
          {section.formula && (
            <div className="my-3 p-3 bg-slate-800 rounded font-mono text-xs text-amber-100 
              overflow-x-auto whitespace-pre-wrap">
              {section.formula}
            </div>
          )}
          {section.points && (
            <ul className="space-y-1 mt-2">
              {section.points.map((point, j) => (
                <li key={j} className="flex items-start gap-2 text-slate-500">
                  <span className="text-amber-500 mt-0.5">▸</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  </div>
);

const AppendixContent: React.FC = () => (
  <div className="page-content">
    <div className="text-center mb-6">
      <p className="text-amber-600 text-xs uppercase tracking-[0.2em] mb-1">Appendix</p>
      <h2 className="text-xl font-serif text-slate-800">Quick Reference</h2>
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="h-px w-8 bg-amber-300" />
        <span className="text-amber-500 text-sm ornament">◆</span>
        <span className="h-px w-8 bg-amber-300" />
      </div>
    </div>
    
    <div className="space-y-4">
      {/* Materials Table */}
      <div className="border border-amber-200 rounded overflow-hidden">
        <div className="bg-amber-100/50 px-3 py-2 font-serif text-slate-800 text-sm">
          Material Properties
        </div>
        <table className="w-full text-xs">
          <thead className="bg-amber-50/50">
            <tr>
              <th className="px-3 py-2 text-left text-slate-700">Material</th>
              <th className="px-3 py-2 text-right text-slate-700">E (MPa)</th>
              <th className="px-3 py-2 text-right text-slate-700">fy (MPa)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            <tr><td className="px-3 py-1.5">M25 Concrete</td><td className="px-3 py-1.5 text-right">25,000</td><td className="px-3 py-1.5 text-right">—</td></tr>
            <tr><td className="px-3 py-1.5">M30 Concrete</td><td className="px-3 py-1.5 text-right">27,386</td><td className="px-3 py-1.5 text-right">—</td></tr>
            <tr><td className="px-3 py-1.5">Fe415 Steel</td><td className="px-3 py-1.5 text-right">200,000</td><td className="px-3 py-1.5 text-right">415</td></tr>
            <tr><td className="px-3 py-1.5">Fe500 Steel</td><td className="px-3 py-1.5 text-right">200,000</td><td className="px-3 py-1.5 text-right">500</td></tr>
          </tbody>
        </table>
      </div>
      
      {/* Formulas */}
      <div className="border border-amber-200 rounded overflow-hidden">
        <div className="bg-amber-100/50 px-3 py-2 font-serif text-slate-800 text-sm">
          Essential Formulas
        </div>
        <div className="p-3 space-y-2 font-mono text-xs">
          <div className="p-2 bg-slate-800 text-amber-100 rounded">σ = M·y/I</div>
          <div className="p-2 bg-slate-800 text-amber-100 rounded">δ = PL³/3EI</div>
          <div className="p-2 bg-slate-800 text-amber-100 rounded">Pcr = π²EI/L²</div>
        </div>
      </div>
    </div>
    
    <div className="mt-6 pt-4 border-t border-amber-200/50 text-center text-slate-400 text-xs">
      <p>Civil Engineering Design & Analysis v2.0</p>
      <p className="mt-1">{BOOK_METADATA.year}</p>
    </div>
  </div>
);

// ============================================================================
// CHAPTER DATA
// ============================================================================

const CHAPTERS: ChapterPageProps[] = [
  {
    number: 1,
    title: 'Structural Analysis',
    subtitle: 'Frame, Truss & Beam Analysis',
    icon: '🏗️',
    sections: [
      {
        heading: 'Overview',
        content: 'Structural analysis forms the backbone of civil engineering design. Our platform implements the Direct Stiffness Method, providing accurate analysis of complex structures under various loading conditions.',
      },
      {
        heading: '2D Frame Analysis',
        content: 'Frame analysis considers axial, shear, and bending effects. Each member is characterized by its cross-sectional properties and material properties.',
        formula: '[K]{D} = {F}',
        points: ['Fixed, Pinned, Roller supports', 'Point loads, Distributed loads, Moments', 'BMD, SFD output'],
      },
      {
        heading: 'Truss Analysis',
        content: 'Truss structures carry loads through axial forces only. Pin-jointed assumptions apply.',
        points: ['Pratt, Howe, Warren, K-truss types', 'Tension/Compression member forces'],
      },
    ],
  },
  {
    number: 2,
    title: 'Geotechnical Engineering',
    subtitle: 'Soil Mechanics & Foundation Design',
    icon: '⛰️',
    sections: [
      {
        heading: 'Overview',
        content: 'Geotechnical engineering deals with the behavior of earth materials and their interaction with structures.',
      },
      {
        heading: 'Bearing Capacity',
        content: 'The ultimate bearing capacity determines the maximum load a foundation can safely support.',
        formula: 'qᵤ = cNc + qNq + 0.5γBNγ',
        points: ['Terzaghi, Meyerhof, Hansen, Vesic methods', 'Shape, depth, inclination factors'],
      },
      {
        heading: 'Slope Stability',
        content: 'Analysis determines the factor of safety against sliding.',
        points: ['Infinite Slope, Culmann, Fellenius, Bishop methods'],
      },
    ],
  },
  {
    number: 3,
    title: 'Hydraulic Engineering',
    subtitle: 'Flow Analysis & Water Resources',
    icon: '💧',
    sections: [
      {
        heading: 'Overview',
        content: 'Hydraulic engineering encompasses the analysis of water flow in open channels, pipes, and natural systems.',
      },
      {
        heading: 'Open Channel Flow',
        content: 'Governed by Manning\'s equation for uniform flow conditions.',
        formula: 'V = (1/n)·R^(2/3)·S^(1/2)',
        points: ['Subcritical, Critical, Supercritical flow', 'Hydraulic jump calculations'],
      },
      {
        heading: 'Pipe Flow',
        content: 'Head loss calculations using Darcy-Weisbach, Hazen-Williams, and Manning equations.',
        formula: 'hf = f·(L/D)·(V²/2g)',
      },
    ],
  },
  {
    number: 4,
    title: 'Transportation Engineering',
    subtitle: 'Highway & Geometric Design',
    icon: '🛣️',
    sections: [
      {
        heading: 'Overview',
        content: 'Transportation engineering focuses on the safe and efficient movement of people and goods.',
      },
      {
        heading: 'Geometric Design',
        content: 'Highway geometric design ensures safe vehicle operation through proper alignment.',
        formula: 'SSD = V·t + V²/(2g·f)',
        points: ['Stopping, Passing, Decision sight distances', 'Superelevation, Transition spirals'],
      },
      {
        heading: 'Pavement Design',
        content: 'AASHTO flexible and rigid pavement design methods.',
      },
    ],
  },
  {
    number: 5,
    title: 'Surveying & Geodesy',
    subtitle: 'Measurement & Coordinate Systems',
    icon: '📐',
    sections: [
      {
        heading: 'Overview',
        content: 'Surveying provides the spatial framework for all civil engineering projects.',
      },
      {
        heading: 'Coordinate Systems',
        content: 'Modern surveying uses multiple coordinate systems including geographic and projected coordinates.',
        points: ['WGS84, GRS80 ellipsoids', 'UTM zone calculations', 'Vincenty distance formula'],
      },
      {
        heading: 'Traverse Computations',
        content: 'Determine coordinates from field measurements.',
        formula: 'Lat = D·cos(θ), Dep = D·sin(θ)',
        points: ['Bowditch, Transit Rule adjustments'],
      },
    ],
  },
  {
    number: 6,
    title: 'Visualization Tools',
    subtitle: 'Graphics & Diagrams',
    icon: '📊',
    sections: [
      {
        heading: 'Overview',
        content: 'Visualization transforms numerical results into intuitive graphical representations.',
      },
      {
        heading: 'Structural Diagrams',
        content: 'Generate professional engineering diagrams.',
        points: ['Bending Moment Diagrams (BMD)', 'Shear Force Diagrams (SFD)', 'Deflected shape visualization'],
      },
      {
        heading: 'Interactive Graphics',
        content: 'Real-time canvas-based visualization with zoom, pan, and annotation capabilities.',
      },
    ],
  },
];

// ============================================================================
// MAIN BOOK COMPONENT
// ============================================================================

export const RealisticBook: React.FC = () => {
  const [currentSpread, setCurrentSpread] = useState(0); // 0 = cover, 1 = title/dedication, etc.
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const bookRef = useRef<HTMLDivElement>(null);
  
  // Total spreads: Cover, Title/Ded, TOC/Preface, then chapters (2 pages each), Appendix
  const totalSpreads = 2 + 1 + CHAPTERS.length + 1;
  
  const flipPage = useCallback((direction: 'next' | 'prev') => {
    if (isFlipping) return;
    
    const newSpread = direction === 'next' 
      ? Math.min(currentSpread + 1, totalSpreads - 1)
      : Math.max(currentSpread - 1, 0);
    
    if (newSpread === currentSpread) return;
    
    setFlipDirection(direction);
    setIsFlipping(true);
    
    setTimeout(() => {
      setCurrentSpread(newSpread);
      setIsFlipping(false);
    }, 600);
  }, [currentSpread, isFlipping, totalSpreads]);
  
  const goToSpread = useCallback((spread: number) => {
    if (isFlipping || spread === currentSpread) return;
    setFlipDirection(spread > currentSpread ? 'next' : 'prev');
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentSpread(spread);
      setIsFlipping(false);
    }, 400);
  }, [currentSpread, isFlipping]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') flipPage('next');
      if (e.key === 'ArrowLeft') flipPage('prev');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [flipPage]);
  
  // Render spread content
  const renderLeftPage = () => {
    if (currentSpread === 0) return null; // Cover has no left page
    if (currentSpread === 1) return <TitlePageContent />;
    if (currentSpread === 2) return <TableOfContentsContent onNavigate={(p) => goToSpread(Math.floor(p / 2))} />;
    
    const chapterIndex = currentSpread - 3;
    if (chapterIndex >= 0 && chapterIndex < CHAPTERS.length) {
      return <ChapterStartContent {...CHAPTERS[chapterIndex]} />;
    }
    return <AppendixContent />;
  };
  
  const renderRightPage = () => {
    if (currentSpread === 0) return <CoverPageContent />;
    if (currentSpread === 1) return <DedicationPageContent />;
    if (currentSpread === 2) return <PrefaceContent />;
    
    const chapterIndex = currentSpread - 3;
    if (chapterIndex >= 0 && chapterIndex < CHAPTERS.length) {
      return <ChapterContentPage {...CHAPTERS[chapterIndex]} />;
    }
    return null;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 
      flex flex-col items-center justify-center p-4 md:p-8">
      
      {/* Inject styles via ref to avoid dangerouslySetInnerHTML */}
      <style ref={(el) => { if (el) el.textContent = bookStyles; }} />
      
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-amber-100/70 font-serif text-lg md:text-xl flex items-center gap-3">
          <span>📚</span>
          Civil Engineering Reference Library
        </h1>
      </div>
      
      {/* Book */}
      <div className="relative">
        {/* Navigation arrows */}
        <button
          onClick={() => flipPage('prev')}
          disabled={currentSpread === 0 || isFlipping}
          className="nav-arrow left"
          aria-label="Previous page"
        >
          ←
        </button>
        
        <button
          onClick={() => flipPage('next')}
          disabled={currentSpread >= totalSpreads - 1 || isFlipping}
          className="nav-arrow right"
          aria-label="Next page"
        >
          →
        </button>
        
        {/* Book container */}
        <div ref={bookRef} className="realistic-book">
          {/* Book shadow */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[95%] h-10 
            bg-black/40 blur-2xl rounded-full" />
          
          {/* Left page */}
          {currentSpread > 0 && (
            <div className={`absolute left-0 w-1/2 h-full ${isFlipping && flipDirection === 'prev' ? 'z-50' : ''}`}>
              <div className="page-face">
                <div className="page-texture" />
                <div className="page-lines" />
                {renderLeftPage()}
              </div>
            </div>
          )}
          
          {/* Right page */}
          <div className={`
            absolute right-0 w-1/2 h-full
            ${isFlipping ? (flipDirection === 'next' ? 'flipping' : 'flipping-back') : ''}
          `}
            style={{
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className={`page-face ${currentSpread === 0 ? 'rounded-lg' : ''}`}>
              <div className="page-texture" />
              <div className="page-lines" />
              {renderRightPage()}
              {currentSpread > 0 && <div className="page-curl" onClick={() => flipPage('next')} />}
            </div>
          </div>
          
          {/* Spine (shown when book is open) */}
          {currentSpread > 0 && <div className="book-spine" />}
        </div>
      </div>
      
      {/* Page indicator */}
      <div className="mt-8 flex items-center gap-6">
        {/* Progress dots */}
        <div className="flex gap-2">
          {Array.from({ length: totalSpreads }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSpread(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentSpread 
                  ? 'bg-amber-400 w-6' 
                  : 'bg-amber-600/30 hover:bg-amber-500/50'
              }`}
              aria-label={`Go to spread ${i + 1}`}
            />
          ))}
        </div>
        
        {/* Page number */}
        <span className="text-amber-300/50 text-sm font-mono">
          {currentSpread === 0 ? 'Cover' : `${currentSpread * 2 - 1}-${currentSpread * 2}`}
        </span>
      </div>
      
      {/* Hint */}
      <p className="mt-4 text-amber-400/30 text-xs">
        Use ← → keys • Click page corner to turn
      </p>
    </div>
  );
};

export default RealisticBook;
