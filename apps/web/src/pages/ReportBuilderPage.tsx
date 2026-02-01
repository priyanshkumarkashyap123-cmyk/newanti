import React, { useMemo, useState, useCallback } from 'react';
import { ReportBuilder, type ReportConfig } from '@/modules/reports/EngineeringReportGenerator';
import { FileText, Download, Eye, Settings, Plus, Trash2, GripVertical } from 'lucide-react';

interface ReportSection {
  id: string;
  title: string;
  content: string;
  level: 1 | 2 | 3;
}

export default function ReportBuilderPage() {
  const [config, setConfig] = useState<Partial<ReportConfig>>({
    title: 'Structural Design Report',
    projectName: 'Tower A',
    projectNumber: 'PRJ-2026-001',
    client: 'Acme Infrastructure',
    engineer: 'Lead Structural Engineer',
    date: new Date().toISOString().slice(0, 10),
    revision: 'A1',
    companyName: 'BeamLab Engineering',
    format: 'markdown',
    includeTableOfContents: true,
    includePageNumbers: true,
    includeCoverPage: true,
    includeAppendix: false,
    approver: 'Chief Structural Engineer'
  });

  const [sections, setSections] = useState<ReportSection[]>([
    { id: '1', title: 'Introduction', level: 1, content: 'This report presents the structural design calculations for Tower A, including analysis results, member designs, and code compliance checks.' },
    { id: '2', title: 'Design Basis', level: 1, content: 'Design codes: IS 456:2000, IS 800:2007, IS 1893:2016. Materials: M30 concrete, Fe500 reinforcement, Grade 350 steel.' },
    { id: '3', title: 'Load Analysis', level: 1, content: 'Dead loads, live loads, seismic loads, and wind loads as per IS 875 Parts 1-3 and IS 1893.' },
    { id: '4', title: 'Member Design', level: 1, content: 'All beams, columns, slabs, and footings designed with adequate safety factors.' },
    { id: '5', title: 'Conclusions', level: 1, content: 'The structure is safe and serviceable under all design load combinations.' },
  ]);

  const [showPreview, setShowPreview] = useState(false);
  const [newSection, setNewSection] = useState({ title: '', content: '' });

  const generatedReport = useMemo(() => {
    const builder = new ReportBuilder(config);
    
    sections.forEach(section => {
      builder.addSection(section.title, section.level);
      builder.addParagraph(section.content);
    });

    return builder.generate();
  }, [config, sections]);

  const addSection = useCallback(() => {
    if (!newSection.title) return;
    setSections(prev => [...prev, {
      id: String(Date.now()),
      title: newSection.title,
      content: newSection.content,
      level: 1
    }]);
    setNewSection({ title: '', content: '' });
  }, [newSection]);

  const removeSection = useCallback((id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateSection = useCallback((id: string, updates: Partial<ReportSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const downloadReport = useCallback((format: 'markdown' | 'html') => {
    const updatedConfig: ReportConfig = { 
      ...config, 
      format,
      title: config.title || 'Report',
      projectName: config.projectName || '',
      projectNumber: config.projectNumber || '',
      client: config.client || '',
      engineer: config.engineer || '',
      date: config.date || new Date().toISOString().slice(0, 10),
      revision: config.revision || 'A1',
      companyName: config.companyName || '',
      includeTableOfContents: config.includeTableOfContents ?? false,
      includePageNumbers: config.includePageNumbers ?? false,
      includeCoverPage: config.includeCoverPage ?? false,
      includeAppendix: config.includeAppendix ?? false,
    };
    const builder = new ReportBuilder(updatedConfig);
    sections.forEach(section => {
      builder.addSection(section.title, section.level);
      builder.addParagraph(section.content);
    });
    
    const content = builder.generate();
    const ext = format === 'markdown' ? 'md' : 'html';
    const mimeType = format === 'markdown' ? 'text/markdown' : 'text/html';
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.projectNumber || 'report'}_structural_report.${ext}`;
    a.click();
  }, [config, sections]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reports</p>
            <h1 className="text-2xl font-bold">Engineering Report Builder</h1>
            <p className="text-slate-400">Create professional structural design reports.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
              <Eye className="w-4 h-4" />
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            <button onClick={() => downloadReport('markdown')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Markdown
            </button>
            <button onClick={() => downloadReport('html')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              HTML
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Config Panel */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold">Report Settings</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Project Name</label>
                <input 
                  value={config.projectName || ''} 
                  onChange={e => setConfig(prev => ({ ...prev, projectName: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Project Number</label>
                <input 
                  value={config.projectNumber || ''} 
                  onChange={e => setConfig(prev => ({ ...prev, projectNumber: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Client</label>
                <input 
                  value={config.client || ''} 
                  onChange={e => setConfig(prev => ({ ...prev, client: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Engineer</label>
                <input 
                  value={config.engineer || ''} 
                  onChange={e => setConfig(prev => ({ ...prev, engineer: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Revision</label>
                  <input 
                    value={config.revision || ''} 
                    onChange={e => setConfig(prev => ({ ...prev, revision: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Date</label>
                  <input 
                    type="date"
                    value={config.date || ''} 
                    onChange={e => setConfig(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Cover Page</span>
                <input type="checkbox" checked={config.includeCoverPage} onChange={e => setConfig(prev => ({ ...prev, includeCoverPage: e.target.checked }))} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Table of Contents</span>
                <input type="checkbox" checked={config.includeTableOfContents} onChange={e => setConfig(prev => ({ ...prev, includeTableOfContents: e.target.checked }))} />
              </div>
            </div>
          </div>

          {/* Sections Panel */}
          <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold">Report Sections</h2>
              </div>
              <span className="text-xs text-slate-400">{sections.length} sections</span>
            </div>

            {showPreview ? (
              <div className="bg-white text-slate-900 rounded-lg p-6 max-h-96 overflow-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono">{generatedReport}</pre>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {sections.map(section => (
                    <div key={section.id} className="flex items-start gap-2 p-3 bg-slate-800/50 rounded-lg">
                      <GripVertical className="w-4 h-4 text-slate-500 mt-1 cursor-move" />
                      <div className="flex-1 space-y-1">
                        <input 
                          value={section.title}
                          onChange={e => updateSection(section.id, { title: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm font-medium"
                        />
                        <textarea 
                          value={section.content}
                          onChange={e => updateSection(section.id, { content: e.target.value })}
                          rows={2}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs resize-none"
                        />
                      </div>
                      <button onClick={() => removeSection(section.id)} className="p-1 text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-700 pt-4 space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Add Section</h3>
                  <input 
                    placeholder="Section Title"
                    value={newSection.title}
                    onChange={e => setNewSection(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                  />
                  <textarea 
                    placeholder="Section Content"
                    value={newSection.content}
                    onChange={e => setNewSection(prev => ({ ...prev, content: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm resize-none"
                  />
                  <button onClick={addSection} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition-colors">
                    Add Section
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
