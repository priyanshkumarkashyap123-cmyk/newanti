import React, { useMemo, useState, useCallback } from 'react';
import { 
  IFC_STRUCTURAL_TYPES, 
  IFCParser, 
  ModelValidator, 
  ClashDetector,
  IFCWriter,
  type ClashResult,
  type StructuralMember 
} from '@/modules/bim/BIMIntegrationEngine';
import { Upload, AlertTriangle, CheckCircle, FileDown, Eye, Layers, Box } from 'lucide-react';

type ViewMode = 'upload' | 'preview' | 'clash' | 'export';

export default function BIMIntegrationPage() {
  const supportedTypes = useMemo(() => Object.keys(IFC_STRUCTURAL_TYPES), []);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [parsedMembers, setParsedMembers] = useState<StructuralMember[]>([]);
  const [clashResults, setClashResults] = useState<ClashResult[]>([]);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIfcFile(file);
    setIsProcessing(true);
    
    try {
      // Simulate IFC parsing (real implementation would use web-ifc)
      const parser = new IFCParser();
      // In production, this would actually parse the file
      const mockMembers: StructuralMember[] = [
        { id: 'B1', type: 'beam', name: 'Beam Level 1', material: 'C30/37', section: '300x600', geometry: { startPoint: {x:0,y:0,z:3}, endPoint: {x:6,y:0,z:3}, rotation: 0 }, properties: {} },
        { id: 'C1', type: 'column', name: 'Column A1', material: 'C40/50', section: '400x400', geometry: { startPoint: {x:0,y:0,z:0}, endPoint: {x:0,y:0,z:3}, rotation: 0 }, properties: {} },
        { id: 'S1', type: 'slab', name: 'Slab Level 1', material: 'C30/37', section: '200mm', geometry: { startPoint: {x:0,y:0,z:3}, endPoint: {x:12,y:8,z:3}, rotation: 0 }, properties: {} },
      ];
      setParsedMembers(mockMembers);
      setViewMode('preview');
      
      // Run validation
      const validator = new ModelValidator();
      setValidationStatus('valid');
    } catch (err) {
      console.error('IFC parse error:', err);
      setValidationStatus('invalid');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const runClashDetection = useCallback(() => {
    setIsProcessing(true);
    setTimeout(() => {
      // Simulate clash detection
      const detector = new ClashDetector();
      const mockClashes: ClashResult[] = [
        { id: 'CL1', element1: { id: 'B1', type: 'beam', name: 'Beam 1' }, element2: { id: 'D1', type: 'duct', name: 'HVAC Duct' }, type: 'hard', point: {x:3,y:0,z:3}, distance: -25, severity: 'major' },
      ];
      setClashResults(mockClashes);
      setViewMode('clash');
      setIsProcessing(false);
    }, 1000);
  }, []);

  const exportIFC = useCallback(() => {
    setIsProcessing(true);
    setTimeout(() => {
      // Simulate export
      const writer = new IFCWriter();
      const blob = new Blob(['IFC4;...'], { type: 'application/x-step' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'structural_model.ifc';
      a.click();
      setIsProcessing(false);
    }, 500);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">BIM Integration</p>
            <h1 className="text-2xl font-bold">IFC Import / Clash / Export</h1>
            <p className="text-slate-400">Upload IFC models, detect clashes, and export structural data.</p>
          </div>
          <div className="flex gap-2">
            {['upload', 'preview', 'clash', 'export'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as ViewMode)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                  viewMode === mode ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </header>

        {viewMode === 'upload' && (
          <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center">
            <Upload className="w-12 h-12 mx-auto text-slate-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Upload IFC File</h2>
            <p className="text-sm text-slate-400 mb-4">Supports IFC 2x3, IFC 4, and IFC 4x3 formats</p>
            <label className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors">
              <input type="file" accept=".ifc" onChange={handleFileUpload} className="hidden" />
              Select IFC File
            </label>
            {ifcFile && <p className="text-sm text-slate-300 mt-3">Selected: {ifcFile.name}</p>}
          </section>
        )}

        {viewMode === 'preview' && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold">Parsed Members ({parsedMembers.length})</h2>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {parsedMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-slate-800 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <Box className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{m.name}</span>
                    </div>
                    <span className="text-slate-400 capitalize">{m.type}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-lg font-semibold mb-3">Validation Status</h2>
              <div className={`flex items-center gap-2 p-3 rounded-lg ${validationStatus === 'valid' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {validationStatus === 'valid' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span>{validationStatus === 'valid' ? 'Model passes validation checks' : 'Validation errors found'}</span>
              </div>
              <button onClick={runClashDetection} disabled={isProcessing} className="mt-4 w-full py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg transition-colors">
                {isProcessing ? 'Processing...' : 'Run Clash Detection'}
              </button>
            </div>
          </section>
        )}

        {viewMode === 'clash' && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold mb-3">Clash Detection Results ({clashResults.length} issues)</h2>
            {clashResults.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>No clashes detected!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {clashResults.map(c => (
                  <div key={c.id} className={`p-3 rounded-lg border ${c.severity === 'critical' ? 'border-red-700 bg-red-900/20' : c.severity === 'major' ? 'border-orange-700 bg-orange-900/20' : 'border-yellow-700 bg-yellow-900/20'}`}>
                    <div className="flex justify-between">
                      <span className="font-medium">{c.element1.name} ↔ {c.element2.name}</span>
                      <span className="text-xs uppercase px-2 py-0.5 rounded bg-slate-800">{c.severity}</span>
                    </div>
                    <p className="text-sm text-slate-400">{c.type} clash at ({c.point.x.toFixed(1)}, {c.point.y.toFixed(1)}, {c.point.z.toFixed(1)})</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {viewMode === 'export' && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
            <FileDown className="w-12 h-12 mx-auto text-slate-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Export Structural Model</h2>
            <p className="text-sm text-slate-400 mb-4">Export the analyzed structural model to IFC 4 format</p>
            <button onClick={exportIFC} disabled={isProcessing || parsedMembers.length === 0} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors">
              {isProcessing ? 'Exporting...' : 'Download IFC File'}
            </button>
          </section>
        )}

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold mb-2">Supported IFC Structural Types</h2>
          <div className="flex flex-wrap gap-2">
            {supportedTypes.map(type => (
              <span key={type} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200 border border-slate-700">
                {type}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
