/**
 * ReportCustomizationDialog.tsx
 * 
 * Professional PDF report generation dialog.
 * Allows customization of:
 * - Company branding
 * - Project information
 * - Report sections to include
 * - Styling (colors, layout)
 */

import React, { useState } from 'react';
import { FileText, Download, Settings, CheckCircle, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { API_CONFIG } from '../config/env';

interface ReportCustomization {
  // Company branding
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  
  // Project information
  project_name: string;
  project_number: string;
  project_location: string;
  client_name: string;
  engineer_name: string;
  checked_by: string;
  
  // Report sections
  include_cover_page: boolean;
  include_toc: boolean;
  include_input_summary: boolean;
  include_load_cases: boolean;
  include_load_combinations: boolean;
  include_node_displacements: boolean;
  include_member_forces: boolean;
  include_reaction_summary: boolean;
  include_analysis_results: boolean;
  include_design_checks: boolean;
  include_diagrams: boolean;
  include_concrete_design: boolean;
  include_foundation_design: boolean;
  include_connection_design: boolean;
  
  // Styling
  primary_color: [number, number, number];  // RGB 0-1
  page_size: 'A4' | 'Letter';
  format: 'PDF' | 'DOCX' | 'HTML';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analysisData: any;
  projectName?: string;
}

export const ReportCustomizationDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  analysisData,
  projectName = 'Structural Analysis'
}) => {
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'project' | 'company' | 'content' | 'style'>('project');
  
  const [customization, setCustomization] = useState<ReportCustomization>({
    // Company defaults
    company_name: 'BeamLab ULTIMATE',
    company_address: '',
    company_phone: '',
    company_email: '',
    
    // Project defaults
    project_name: projectName,
    project_number: '',
    project_location: '',
    client_name: '',
    engineer_name: '',
    checked_by: '',
    
    // Content defaults (all enabled)
    include_cover_page: true,
    include_toc: true,
    include_input_summary: true,
    include_load_cases: true,
    include_load_combinations: true,
    include_node_displacements: true,
    include_member_forces: true,
    include_reaction_summary: true,
    include_analysis_results: true,
    include_design_checks: true,
    include_diagrams: true,
    include_concrete_design: false,
    include_foundation_design: false,
    include_connection_design: false,
    
    // Style defaults
    primary_color: [0.0, 0.4, 0.8],
    page_size: 'A4',
    format: 'PDF' as const
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const PYTHON_API = API_CONFIG.pythonUrl;
      
      const response = await fetch(`${PYTHON_API}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          analysis_data: analysisData,
          customization: customization
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${customization.project_name.replace(/\s+/g, '_')}_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const updateCustomization = (field: keyof ReportCustomization, value: any) => {
    setCustomization(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Accent strip */}
        <div className="h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-t-xl" />

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight">
                Generate PDF Report
              </DialogTitle>
              <DialogDescription className="text-[11px]">
                Customize your professional analysis report
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {[
            { id: 'project' as const, label: 'Project Info', icon: FileText },
            { id: 'company' as const, label: 'Company', icon: Building2 },
            { id: 'content' as const, label: 'Content', icon: CheckCircle },
            { id: 'style' as const, label: 'Style', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-xs font-semibold uppercase tracking-wider ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Project Info Tab */}
          {activeTab === 'project' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={customization.project_name}
                  onChange={(e) => updateCustomization('project_name', e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                  placeholder="Multi-Story Frame Analysis"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Project Number
                  </label>
                  <input
                    type="text"
                    value={customization.project_number}
                    onChange={(e) => updateCustomization('project_number', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    placeholder="2026-001"
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={customization.project_location}
                    onChange={(e) => updateCustomization('project_location', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    placeholder="Mumbai, India"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={customization.client_name}
                  onChange={(e) => updateCustomization('client_name', e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                  placeholder="Client Organization"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Prepared By
                  </label>
                  <input
                    type="text"
                    value={customization.engineer_name}
                    onChange={(e) => updateCustomization('engineer_name', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    placeholder="Your Name, P.E."
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Checked By
                  </label>
                  <input
                    type="text"
                    value={customization.checked_by}
                    onChange={(e) => updateCustomization('checked_by', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    placeholder="Reviewer Name"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Company Info Tab */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={customization.company_name}
                  onChange={(e) => updateCustomization('company_name', e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                  placeholder="Your Engineering Firm"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Address
                </label>
                <textarea
                  value={customization.company_address}
                  onChange={(e) => updateCustomization('company_address', e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                  rows={3}
                  placeholder="123 Main Street, City, State 12345"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={customization.company_phone}
                    onChange={(e) => updateCustomization('company_phone', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={customization.company_email}
                    onChange={(e) => updateCustomization('company_email', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    placeholder="info@company.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Content Selection Tab */}
          {activeTab === 'content' && (
            <div className="space-y-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-4">
                Select which sections to include in the report
              </p>
              
              {[
                { key: 'include_cover_page' as const, label: 'Cover Page', desc: 'Project details and company branding' },
                { key: 'include_toc' as const, label: 'Table of Contents', desc: 'Auto-generated page index' },
                { key: 'include_input_summary' as const, label: 'Input Summary', desc: 'Nodes, members, loads, and supports' },
                { key: 'include_load_cases' as const, label: 'Load Cases', desc: 'Dead, live, wind, seismic definitions' },
                { key: 'include_load_combinations' as const, label: 'Load Combinations', desc: 'Factored load combination table' },
                { key: 'include_node_displacements' as const, label: 'Node Displacements', desc: 'Nodal translations and rotations' },
                { key: 'include_member_forces' as const, label: 'Member Forces', desc: 'Axial, shear, moment per member' },
                { key: 'include_reaction_summary' as const, label: 'Reaction Summary', desc: 'Support reactions at each restraint' },
                { key: 'include_analysis_results' as const, label: 'Analysis Results', desc: 'Displacements, reactions, and forces' },
                { key: 'include_design_checks' as const, label: 'Design Checks', desc: 'IS 800 code compliance checks' },
                { key: 'include_diagrams' as const, label: 'Diagrams', desc: 'BMD, SFD, and deflected shapes' },
                { key: 'include_concrete_design' as const, label: 'Concrete Design', desc: 'RC beam/column/slab design per IS 456' },
                { key: 'include_foundation_design' as const, label: 'Foundation Design', desc: 'Isolated/combined footing checks' },
                { key: 'include_connection_design' as const, label: 'Connection Design', desc: 'Bolted/welded connection details' },
              ].map(section => (
                <label
                  key={section.key}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors border border-border/50"
                >
                  <input
                    type="checkbox"
                    checked={customization[section.key]}
                    onChange={(e) => updateCustomization(section.key, e.target.checked)}
                    className="mt-1 rounded bg-muted border-border text-primary focus:ring-primary/40"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">{section.label}</div>
                    <div className="text-[11px] text-muted-foreground">{section.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Style Tab */}
          {activeTab === 'style' && (
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Export Format
                </label>
                <div className="flex gap-2">
                  {(['PDF', 'DOCX', 'HTML'] as const).map(fmt => (
                    <button type="button"
                      key={fmt}
                      onClick={() => updateCustomization('format', fmt)}
                      className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                        customization.format === fmt
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-muted text-muted-foreground hover:bg-accent border border-border/60'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Page Size
                </label>
                <div className="flex gap-2">
                  {['A4', 'Letter'].map(size => (
                    <button type="button"
                      key={size}
                      onClick={() => updateCustomization('page_size', size)}
                      className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                        customization.page_size === size
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-muted text-muted-foreground hover:bg-accent border border-border/60'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Primary Color
                </label>
                <div className="flex gap-4">
                  {[
                    { name: 'Blue', color: [0.0, 0.4, 0.8] },
                    { name: 'Green', color: [0.0, 0.6, 0.3] },
                    { name: 'Red', color: [0.8, 0.2, 0.2] },
                    { name: 'Purple', color: [0.5, 0.2, 0.7] }
                  ].map(preset => (
                    <button type="button"
                      key={preset.name}
                      onClick={() => updateCustomization('primary_color', preset.color as [number, number, number])}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className={`w-12 h-12 rounded-lg border-2 transition-all shadow-md ${
                          JSON.stringify(customization.primary_color) === JSON.stringify(preset.color)
                            ? 'border-foreground scale-110 ring-2 ring-primary/30'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                        style={{
                          backgroundColor: `rgb(${preset.color.map(c => c * 255).join(', ')})`
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground font-medium">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t flex items-center justify-between sm:justify-between">
          <div className="text-[11px] text-muted-foreground">
            Report will be generated as PDF &middot; {customization.page_size}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !customization.project_name}
              className="flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  Generating…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
