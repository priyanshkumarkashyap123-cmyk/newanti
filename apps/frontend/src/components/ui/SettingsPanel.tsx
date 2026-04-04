/**
 * ============================================================================
 * SETTINGS PANEL - STRUCTURAL DESIGN CENTER
 * ============================================================================
 * 
 * Comprehensive settings interface for design preferences, units,
 * default values, and export configurations.
 * 
 * @version 1.0.0
 */


import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Check,
  ChevronRight,
  Globe,
  Ruler,
  Palette,
  Shield,
  FileText,
  Bell,
  Database,
  Keyboard,
  Monitor,
  Sun,
  Moon,
  Save,
  RotateCcw,
  Download,
  Upload,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type UnitSystem = 'SI' | 'Imperial' | 'MKS';
type DesignCode = 'IS456' | 'ACI318' | 'EN1992' | 'AS3600' | 'BS8110';
type SteelCode = 'IS800' | 'AISC360' | 'EN1993' | 'AS4100';

interface DesignSettings {
  // General
  unitSystem: UnitSystem;
  defaultCode: DesignCode;
  defaultSteelCode: SteelCode;
  language: string;
  
  // Materials
  defaultConcreteGrade: string;
  defaultSteelGrade: string;
  defaultStructuralSteel: string;
  
  // Design Preferences
  autoCalculate: boolean;
  showWarnings: boolean;
  roundResults: boolean;
  decimalPlaces: number;
  
  // Export
  exportFormat: 'pdf' | 'excel' | 'both';
  includeDrawings: boolean;
  includeBOM: boolean;
  paperSize: 'A4' | 'A3' | 'Letter';
  
  // UI
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  sidebarPosition: 'left' | 'right';
  compactMode: boolean;
  
  // Notifications
  showCalculationComplete: boolean;
  showDesignWarnings: boolean;
  showUpdateNotifications: boolean;
}

const defaultSettings: DesignSettings = {
  unitSystem: 'SI',
  defaultCode: 'IS456',
  defaultSteelCode: 'IS800',
  language: 'en',
  defaultConcreteGrade: 'M25',
  defaultSteelGrade: 'Fe500',
  defaultStructuralSteel: 'E250',
  autoCalculate: true,
  showWarnings: true,
  roundResults: true,
  decimalPlaces: 2,
  exportFormat: 'pdf',
  includeDrawings: true,
  includeBOM: true,
  paperSize: 'A4',
  theme: 'dark',
  accentColor: 'blue',
  sidebarPosition: 'left',
  compactMode: false,
  showCalculationComplete: true,
  showDesignWarnings: true,
  showUpdateNotifications: false,
};

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: DesignSettings;
  onSave?: (settings: DesignSettings) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SettingsPanel({ 
  isOpen, 
  onClose, 
  settings = defaultSettings,
  onSave,
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState('general');
  const [localSettings, setLocalSettings] = useState<DesignSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'units', label: 'Units & Codes', icon: Ruler },
    { id: 'materials', label: 'Materials', icon: Database },
    { id: 'design', label: 'Design Preferences', icon: Shield },
    { id: 'export', label: 'Export', icon: FileText },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  ];

  const updateSetting = useCallback(<K extends keyof DesignSettings>(
    key: K,
    value: DesignSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(localSettings);
    setHasChanges(false);
    // Save to localStorage
    try {
      localStorage.setItem('structural-design-settings', JSON.stringify(localSettings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }, [localSettings, onSave]);

  const handleReset = useCallback(() => {
    setLocalSettings(defaultSettings);
    setHasChanges(true);
  }, []);

  const handleExportSettings = useCallback(() => {
    const blob = new Blob([JSON.stringify(localSettings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'structural-design-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [localSettings]);

  const handleImportSettings = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        setLocalSettings({ ...defaultSettings, ...imported });
        setHasChanges(true);
      } catch (err) {
        console.error('Failed to import settings:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] p-0 gap-0 flex">
            {/* Sidebar */}
            <div className="w-56 bg-[#131b2e] border-r border-[#1a2333]/50 flex flex-col">
              <div className="p-4 border-b border-[#1a2333]/50">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    Settings
                  </DialogTitle>
                </DialogHeader>
              </div>
              
              <nav className="flex-1 p-2 space-y-1">
                {sections.map(({ id, label, icon: Icon }) => (
                  <button type="button"
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeSection === id
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-[#869ab8] hover:bg-slate-200 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{label}</span>
                    {activeSection === id && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </nav>
              
              {/* Import/Export */}
              <div className="p-3 border-t border-[#1a2333]/50 space-y-2">
                <button type="button"
                  onClick={handleExportSettings}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-600/50 rounded-lg text-sm text-[#adc6ff] transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <label className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-600/50 rounded-lg text-sm text-[#adc6ff] transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Import
                  <input type="file" accept=".json" className="hidden" onChange={handleImportSettings} />
                </label>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-6 border-b border-[#1a2333]/50">
                <h3 className="text-lg font-semibold text-[#dae2fd] capitalize">
                  {sections.find(s => s.id === activeSection)?.label}
                </h3>
              </div>
              
              {/* Settings Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  {activeSection === 'general' && (
                    <SettingsSection key="general">
                      <SettingRow label="Language" description="Display language for the interface">
                        <select
                          value={localSettings.language}
                          onChange={(e) => updateSetting('language', e.target.value)}
                          className="w-40 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="en">English</option>
                          <option value="hi">Hindi</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                        </select>
                      </SettingRow>
                      
                      <SettingRow label="Auto Calculate" description="Automatically run calculations when inputs change">
                        <Toggle
                          checked={localSettings.autoCalculate}
                          onChange={(v) => updateSetting('autoCalculate', v)}
                        />
                      </SettingRow>
                      
                      <SettingRow label="Show Warnings" description="Display design warnings and recommendations">
                        <Toggle
                          checked={localSettings.showWarnings}
                          onChange={(v) => updateSetting('showWarnings', v)}
                        />
                      </SettingRow>
                    </SettingsSection>
                  )}
                  
                  {activeSection === 'units' && (
                    <SettingsSection key="units">
                      <SettingRow label="Unit System" description="Measurement unit system">
                        <select
                          value={localSettings.unitSystem}
                          onChange={(e) => updateSetting('unitSystem', e.target.value as UnitSystem)}
                          className="w-40 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="SI">SI (Metric)</option>
                          <option value="Imperial">Imperial (US)</option>
                          <option value="MKS">MKS</option>
                        </select>
                      </SettingRow>
                      
                      <SettingRow label="Concrete Design Code" description="Default code for RC design">
                        <select
                          value={localSettings.defaultCode}
                          onChange={(e) => updateSetting('defaultCode', e.target.value as DesignCode)}
                          className="w-48 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="IS456">IS 456:2000 (India)</option>
                          <option value="ACI318">ACI 318-19 (USA)</option>
                          <option value="EN1992">EN 1992-1-1 (Europe)</option>
                          <option value="AS3600">AS 3600 (Australia)</option>
                          <option value="BS8110">BS 8110 (UK)</option>
                        </select>
                      </SettingRow>
                      
                      <SettingRow label="Steel Design Code" description="Default code for steel design">
                        <select
                          value={localSettings.defaultSteelCode}
                          onChange={(e) => updateSetting('defaultSteelCode', e.target.value as SteelCode)}
                          className="w-48 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="IS800">IS 800:2007 (India)</option>
                          <option value="AISC360">AISC 360-22 (USA)</option>
                          <option value="EN1993">EN 1993-1-1 (Europe)</option>
                          <option value="AS4100">AS 4100 (Australia)</option>
                        </select>
                      </SettingRow>
                      
                      <SettingRow label="Decimal Places" description="Number of decimal places in results">
                        <select
                          value={localSettings.decimalPlaces}
                          onChange={(e) => updateSetting('decimalPlaces', parseInt(e.target.value))}
                          className="w-24 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value={0}>0</option>
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                        </select>
                      </SettingRow>
                    </SettingsSection>
                  )}
                  
                  {activeSection === 'materials' && (
                    <SettingsSection key="materials">
                      <SettingRow label="Default Concrete Grade" description="Default concrete strength">
                        <select
                          value={localSettings.defaultConcreteGrade}
                          onChange={(e) => updateSetting('defaultConcreteGrade', e.target.value)}
                          className="w-32 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="M20">M20</option>
                          <option value="M25">M25</option>
                          <option value="M30">M30</option>
                          <option value="M35">M35</option>
                          <option value="M40">M40</option>
                          <option value="M45">M45</option>
                          <option value="M50">M50</option>
                        </select>
                      </SettingRow>
                      
                      <SettingRow label="Default Rebar Grade" description="Default reinforcement steel">
                        <select
                          value={localSettings.defaultSteelGrade}
                          onChange={(e) => updateSetting('defaultSteelGrade', e.target.value)}
                          className="w-32 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="Fe415">Fe415</option>
                          <option value="Fe500">Fe500</option>
                          <option value="Fe550">Fe550</option>
                          <option value="Fe600">Fe600</option>
                        </select>
                      </SettingRow>
                      
                      <SettingRow label="Default Structural Steel" description="Default structural steel grade">
                        <select
                          value={localSettings.defaultStructuralSteel}
                          onChange={(e) => updateSetting('defaultStructuralSteel', e.target.value)}
                          className="w-40 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="E250">E250 (Fe 410W A)</option>
                          <option value="E300">E300 (Fe 440)</option>
                          <option value="E350">E350 (Fe 490)</option>
                          <option value="E410">E410 (Fe 540)</option>
                        </select>
                      </SettingRow>
                    </SettingsSection>
                  )}
                  
                  {activeSection === 'design' && (
                    <SettingsSection key="design">
                      <SettingRow label="Round Results" description="Round calculation results for display">
                        <Toggle
                          checked={localSettings.roundResults}
                          onChange={(v) => updateSetting('roundResults', v)}
                        />
                      </SettingRow>
                    </SettingsSection>
                  )}
                  
                  {activeSection === 'export' && (
                    <SettingsSection key="export">
                      <SettingRow label="Export Format" description="Default format for design reports">
                        <select
                          value={localSettings.exportFormat}
                          onChange={(e) => updateSetting('exportFormat', e.target.value as 'pdf' | 'excel' | 'both')}
                          className="w-32 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="pdf">PDF</option>
                          <option value="excel">Excel</option>
                          <option value="both">Both</option>
                        </select>
                      </SettingRow>
                      
                      <SettingRow label="Paper Size" description="Default paper size for PDFs">
                        <select
                          value={localSettings.paperSize}
                          onChange={(e) => updateSetting('paperSize', e.target.value as 'A4' | 'A3' | 'Letter')}
                          className="w-32 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                        >
                          <option value="A4">A4</option>
                          <option value="A3">A3</option>
                          <option value="Letter">Letter</option>
                        </select>
                      </SettingRow>
                      
                      <SettingRow label="Include Drawings" description="Include CAD drawings in exports">
                        <Toggle
                          checked={localSettings.includeDrawings}
                          onChange={(v) => updateSetting('includeDrawings', v)}
                        />
                      </SettingRow>
                      
                      <SettingRow label="Include BOM" description="Include bill of materials">
                        <Toggle
                          checked={localSettings.includeBOM}
                          onChange={(v) => updateSetting('includeBOM', v)}
                        />
                      </SettingRow>
                    </SettingsSection>
                  )}
                  
                  {activeSection === 'appearance' && (
                    <SettingsSection key="appearance">
                      <SettingRow label="Theme" description="Color theme for the interface">
                        <div className="flex items-center gap-2">
                          {[
                            { value: 'light', icon: Sun, label: 'Light' },
                            { value: 'dark', icon: Moon, label: 'Dark' },
                            { value: 'system', icon: Monitor, label: 'System' },
                          ].map(({ value, icon: Icon, label }) => (
                            <button type="button"
                              key={value}
                              onClick={() => updateSetting('theme', value as 'dark' | 'light' | 'system')}
                              className={`p-2 rounded-lg transition-all ${
                                localSettings.theme === value
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-700/50 text-[#869ab8] hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title={label}
                            >
                              <Icon className="w-5 h-5" />
                            </button>
                          ))}
                        </div>
                      </SettingRow>
                      
                      <SettingRow label="Accent Color" description="Primary accent color">
                        <div className="flex items-center gap-2">
                          {[
                            { value: 'blue', color: '#3b82f6' },
                            { value: 'emerald', color: '#10b981' },
                            { value: 'purple', color: '#8b5cf6' },
                            { value: 'amber', color: '#f59e0b' },
                            { value: 'rose', color: '#f43f5e' },
                          ].map(({ value, color }) => (
                            <button type="button"
                              key={value}
                              onClick={() => updateSetting('accentColor', value)}
                              className={`w-8 h-8 rounded-full transition-all ${
                                localSettings.accentColor === value 
                                  ? 'ring-2 ring-slate-300 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-800' 
                                  : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </SettingRow>
                      
                      <SettingRow label="Compact Mode" description="Use compact spacing">
                        <Toggle
                          checked={localSettings.compactMode}
                          onChange={(v) => updateSetting('compactMode', v)}
                        />
                      </SettingRow>
                    </SettingsSection>
                  )}
                  
                  {activeSection === 'notifications' && (
                    <SettingsSection key="notifications">
                      <SettingRow label="Calculation Complete" description="Notify when calculations finish">
                        <Toggle
                          checked={localSettings.showCalculationComplete}
                          onChange={(v) => updateSetting('showCalculationComplete', v)}
                        />
                      </SettingRow>
                      
                      <SettingRow label="Design Warnings" description="Show design warnings">
                        <Toggle
                          checked={localSettings.showDesignWarnings}
                          onChange={(v) => updateSetting('showDesignWarnings', v)}
                        />
                      </SettingRow>
                      
                      <SettingRow label="Update Notifications" description="Show update notifications">
                        <Toggle
                          checked={localSettings.showUpdateNotifications}
                          onChange={(v) => updateSetting('showUpdateNotifications', v)}
                        />
                      </SettingRow>
                    </SettingsSection>
                  )}
                  
                  {activeSection === 'shortcuts' && (
                    <SettingsSection key="shortcuts">
                      <div className="space-y-3">
                        <ShortcutRow shortcut="⌘ + S" description="Save current design" />
                        <ShortcutRow shortcut="⌘ + ⇧ + S" description="Save as new project" />
                        <ShortcutRow shortcut="⌘ + Enter" description="Run calculation" />
                        <ShortcutRow shortcut="⌘ + E" description="Export report" />
                        <ShortcutRow shortcut="⌘ + D" description="Duplicate element" />
                        <ShortcutRow shortcut="⌘ + /" description="Show keyboard shortcuts" />
                        <ShortcutRow shortcut="⌘ + ," description="Open settings" />
                        <ShortcutRow shortcut="Esc" description="Close dialog/panel" />
                      </div>
                    </SettingsSection>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Footer */}
              <div className="h-16 flex items-center justify-between px-6 border-t border-[#1a2333]/50 bg-[#131b2e]">
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  className="text-[#869ab8] hover:text-slate-900 dark:hover:text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Defaults
                </Button>
                
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function SettingsSection({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}

function SettingRow({ 
  label, 
  description, 
  children 
}: { 
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-[#131b2e] rounded-xl border border-[#1a2333]/50">
      <div>
        <p className="font-medium tracking-wide text-[#dae2fd]">{label}</p>
        <p className="text-sm text-[#869ab8]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ 
  checked, 
  onChange 
}: { 
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-blue-500' : 'bg-slate-600'
      }`}
    >
      <motion.div
        initial={false}
        animate={{ x: checked ? 20 : 2 }}
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
      />
    </button>
  );
}

function ShortcutRow({ shortcut, description }: { shortcut: string; description: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#131b2e] rounded-lg border border-[#1a2333]/50">
      <span className="text-[#adc6ff]">{description}</span>
      <kbd className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-mono text-[#adc6ff] border border-slate-300 dark:border-slate-600">
        {shortcut}
      </kbd>
    </div>
  );
}

export { defaultSettings };
export type { DesignSettings };
