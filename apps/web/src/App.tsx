/**
 * App - Main Application Component with Routing
 * Routes between Landing, Dashboard, and Workspace
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { Component, ReactNode, ErrorInfo } from 'react';

// Pages
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { Capabilities } from './pages/Capabilities';

// Layouts
import { WorkspaceLayout } from './layouts/WorkspaceLayout';

// Modern Modeler Component
import { ModernModeler } from './components/ModernModeler';

// Legacy Modeler Components (kept for backward compat)
import { ViewportManager } from './components/ViewportManager';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ResultsTable } from './components/ResultsTable';
import { useModelStore } from './store/model';
import { AICommandCenter } from './components/ai';
import './App.css';


// ============================================
// ERROR BOUNDARY
// ============================================

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('🔴 React Error Boundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    override render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    background: '#1e1e1e',
                    color: '#fff',
                    minHeight: '100vh',
                    fontFamily: 'monospace'
                }}>
                    <h1 style={{ color: '#ff6b6b' }}>⚠️ Something went wrong</h1>
                    <pre style={{
                        background: '#2d2d2d',
                        padding: '20px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        color: '#ffa07a'
                    }}>
                        {this.state.error?.toString()}
                        {'\n\n'}
                        {this.state.errorInfo?.componentStack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            background: '#4CAF50',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// ============================================
// MODELER COMPONENT (Legacy Wrapper for Canvas)
// ============================================

function Modeler() {
    const showResults = useModelStore((state) => state.showResults);
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const loads = useModelStore((state) => state.loads);
    const selectedIds = useModelStore((state) => state.selectedIds);

    return (
        <div className="app-container">
            {/* Professional Header */}
            <header className="modeler-header">
                <div className="header-left">
                    <div className="logo">
                        <span className="logo-icon">⬡</span>
                        <span className="logo-text">BeamLab</span>
                        <span className="logo-badge">ULTIMATE</span>
                    </div>
                    <div className="header-divider" />
                    <nav className="header-menu">
                        <button className="menu-btn"><span>📁</span> File</button>
                        <button className="menu-btn"><span>✏️</span> Edit</button>
                        <button className="menu-btn"><span>👁️</span> View</button>
                        <button className="menu-btn"><span>🔧</span> Model</button>
                        <button className="menu-btn"><span>📊</span> Analyze</button>
                        <button className="menu-btn"><span>🏗️</span> Design</button>
                        <button className="menu-btn"><span>❓</span> Help</button>
                    </nav>
                </div>
                <div className="header-right">
                    <div className="project-badge">
                        <span className="project-icon">📐</span>
                        <span className="project-name">Demo Project</span>
                        <span className="save-indicator saved">● Saved</span>
                    </div>
                    <button className="upgrade-btn">⚡ Upgrade to Pro</button>
                </div>
            </header>

            {/* Quick Actions Bar */}
            <div className="quick-actions-bar">
                <div className="action-group">
                    <button className="action-btn" title="New Project"><span>📄</span></button>
                    <button className="action-btn" title="Open Project"><span>📂</span></button>
                    <button className="action-btn" title="Save Project"><span>💾</span></button>
                    <button className="action-btn" title="Export"><span>📤</span></button>
                </div>
                <div className="action-divider" />
                <div className="action-group">
                    <button className="action-btn" title="Undo (Ctrl+Z)"><span>↩️</span></button>
                    <button className="action-btn" title="Redo (Ctrl+Y)"><span>↪️</span></button>
                </div>
                <div className="action-divider" />
                <div className="action-group">
                    <button className="action-btn" title="Zoom In"><span>🔍+</span></button>
                    <button className="action-btn" title="Zoom Out"><span>🔍-</span></button>
                    <button className="action-btn" title="Fit View"><span>⊡</span></button>
                </div>
                <div className="flex-spacer" />
                <div className="model-stats">
                    <span className="stat">
                        <span className="stat-icon">●</span>
                        <span className="stat-value">{nodes.size}</span>
                        <span className="stat-label">Nodes</span>
                    </span>
                    <span className="stat">
                        <span className="stat-icon">━</span>
                        <span className="stat-value">{members.size}</span>
                        <span className="stat-label">Members</span>
                    </span>
                    <span className="stat">
                        <span className="stat-icon">↓</span>
                        <span className="stat-value">{loads.length}</span>
                        <span className="stat-label">Loads</span>
                    </span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="modeler-main">
                {/* Left Sidebar */}
                <aside className="left-sidebar">
                    <div className="sidebar-section">
                        <h4 className="sidebar-title">🗂️ Model Tree</h4>
                        <div className="tree-item"><span>📐 Structure</span></div>
                        <div className="tree-item sub"><span>● Nodes ({nodes.size})</span></div>
                        <div className="tree-item sub"><span>━ Members ({members.size})</span></div>
                        <div className="tree-item sub"><span>📌 Supports</span></div>
                        <div className="tree-item"><span>⬇️ Loads ({loads.length})</span></div>
                    </div>
                    <div className="sidebar-section">
                        <h4 className="sidebar-title">📋 Quick Actions</h4>
                        <button className="sidebar-action"><span>➕</span> Add Node</button>
                        <button className="sidebar-action"><span>📏</span> Add Member</button>
                        <button className="sidebar-action"><span>📌</span> Add Support</button>
                        <button className="sidebar-action"><span>⬇️</span> Add Load</button>
                    </div>

                    {/* AI Architect Section */}
                    <div className="ai-architect-section">
                        <AICommandCenter />
                    </div>
                </aside>

                {/* Viewport Area */}
                <div className="viewport-container">
                    <ViewportManager />
                    <Toolbar />
                </div>

                {/* Right Sidebar - Properties */}
                <aside className="right-sidebar">
                    <PropertiesPanel />
                    <div className="selection-info">
                        <h4 className="sidebar-title">🔍 Selection</h4>
                        {selectedIds.size === 0 ? (
                            <p className="hint-text">Click on a node or member to view/edit its properties</p>
                        ) : (
                            <p className="hint-text">{selectedIds.size} item(s) selected</p>
                        )}
                    </div>
                </aside>
            </div>

            {/* Results Table - conditional */}
            {showResults && <ResultsTable />}

            {/* Status Bar */}
            <footer className="status-bar">
                <div className="status-left">
                    <span className="status-item"><span className="status-dot ready"></span> Ready</span>
                    <span className="status-divider">|</span>
                    <span className="status-item">Units: kN, m</span>
                    <span className="status-divider">|</span>
                    <span className="status-item">Grid: 1.0m</span>
                </div>
                <div className="status-center">
                    <span className="status-coords">X: 0.00m, Y: 0.00m, Z: 0.00m</span>
                </div>
                <div className="status-right">
                    <span className="status-item">View: Perspective</span>
                    <span className="status-divider">|</span>
                    <span className="status-item">Zoom: 100%</span>
                </div>
            </footer>
        </div>
    );
}

// ============================================
// WORKSPACE PAGE (with WorkspaceLayout)
// ============================================

function WorkspacePage({ moduleType }: { moduleType: string }) {
    // Users start with an empty model - they can create their own or load a sample
    console.log('WorkspacePage moduleType:', moduleType);
    return (
        <WorkspaceLayout>
            {/* The 3D canvas content */}
            <ViewportManager />
            <Toolbar />
        </WorkspaceLayout>
    );
}

// ============================================
// MAIN APP WITH ROUTING
// ============================================

function App() {
    return (
        <ErrorBoundary>
            <Routes>
                {/* Landing Page */}
                <Route path="/" element={<LandingPage />} />

                {/* Dashboard */}
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Capabilities Page */}
                <Route path="/capabilities" element={<Capabilities />} />

                {/* Main App - Modern Modeler with integrated sidebar */}
                <Route path="/app" element={<ModernModeler />} />

                {/* Demo Route - Modern Modeler */}
                <Route path="/demo" element={<ModernModeler />} />

                {/* Workspace Routes */}
                <Route path="/workspace/:moduleType" element={<WorkspacePageWrapper />} />

                {/* Legacy Modeler Route (backward compat) */}
                <Route path="/modeler" element={<Modeler />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </ErrorBoundary>
    );
}

// Helper to extract moduleType param
function WorkspacePageWrapper() {
    const moduleType = window.location.pathname.split('/').pop() || 'structural-3d';
    return <WorkspacePage moduleType={moduleType} />;
}

export default App;
