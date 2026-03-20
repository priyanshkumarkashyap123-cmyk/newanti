/**
 * API Integration Dashboard - Developer & External System Integration
 * 
 * Purpose: Comprehensive API management for integrating BeamLab with external
 * systems, automation workflows, and third-party applications.
 * 
 * Industry Parity: Matches STAAD OpenAPI, SAP2000 OAPI, ETABS API,
 * and modern cloud engineering platform integrations.
 */

import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';

// Types
interface APIKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  permissions: string[];
  status: 'active' | 'revoked' | 'expired';
  requestsToday: number;
  rateLimit: number;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'paused' | 'failed';
  lastTriggered: string;
  successRate: number;
}

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: string;
  authentication: boolean;
}

interface IntegrationApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'cad' | 'bim' | 'pm' | 'cloud' | 'analysis';
  status: 'connected' | 'available';
  features: string[];
}

const APIIntegrationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'webhooks' | 'docs' | 'integrations'>('overview');
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerType, setBannerType] = useState<'success' | 'info'>('info');
  
  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    {
      id: '1',
      name: 'Production API',
      key: 'bl_prod_xxxxxxxxxxxxxxxxxxxxxxxx',
      created: '2025-01-15',
      lastUsed: '2 mins ago',
      permissions: ['read', 'write', 'analysis', 'export'],
      status: 'active',
      requestsToday: 1247,
      rateLimit: 10000,
    },
    {
      id: '2',
      name: 'Development API',
      key: 'bl_dev_xxxxxxxxxxxxxxxxxxxxxxxx',
      created: '2025-01-20',
      lastUsed: '1 hour ago',
      permissions: ['read', 'write'],
      status: 'active',
      requestsToday: 342,
      rateLimit: 5000,
    },
    {
      id: '3',
      name: 'Revit Plugin',
      key: 'bl_revit_xxxxxxxxxxxxxxxxxxxxxxxx',
      created: '2025-02-01',
      lastUsed: 'Yesterday',
      permissions: ['read', 'export', 'sync'],
      status: 'active',
      requestsToday: 89,
      rateLimit: 2000,
    },
  ]);

  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: '1',
      name: 'Analysis Complete',
      url: 'https://yourserver.com/webhooks/analysis',
      events: ['analysis.completed', 'analysis.failed'],
      status: 'active',
      lastTriggered: '10 mins ago',
      successRate: 99.2,
    },
    {
      id: '2',
      name: 'Design Approval',
      url: 'https://yourserver.com/webhooks/design',
      events: ['design.approved', 'design.rejected'],
      status: 'active',
      lastTriggered: '2 hours ago',
      successRate: 100,
    },
    {
      id: '3',
      name: 'Export Notification',
      url: 'https://yourserver.com/webhooks/export',
      events: ['export.completed'],
      status: 'paused',
      lastTriggered: '3 days ago',
      successRate: 95.5,
    },
  ]);

  const [endpoints] = useState<APIEndpoint[]>([
    // Project endpoints
    { method: 'GET', path: '/api/v1/projects', description: 'List all projects', category: 'Projects', authentication: true },
    { method: 'POST', path: '/api/v1/projects', description: 'Create new project', category: 'Projects', authentication: true },
    { method: 'GET', path: '/api/v1/projects/:id', description: 'Get project details', category: 'Projects', authentication: true },
    { method: 'PUT', path: '/api/v1/projects/:id', description: 'Update project', category: 'Projects', authentication: true },
    { method: 'DELETE', path: '/api/v1/projects/:id', description: 'Delete project', category: 'Projects', authentication: true },
    
    // Model endpoints
    { method: 'GET', path: '/api/v1/projects/:id/model', description: 'Get structural model', category: 'Model', authentication: true },
    { method: 'POST', path: '/api/v1/projects/:id/nodes', description: 'Add nodes', category: 'Model', authentication: true },
    { method: 'POST', path: '/api/v1/projects/:id/members', description: 'Add members', category: 'Model', authentication: true },
    { method: 'PUT', path: '/api/v1/projects/:id/members/:memberId', description: 'Update member', category: 'Model', authentication: true },
    
    // Analysis endpoints
    { method: 'POST', path: '/api/v1/projects/:id/analyze', description: 'Run structural analysis', category: 'Analysis', authentication: true },
    { method: 'GET', path: '/api/v1/projects/:id/results', description: 'Get analysis results', category: 'Analysis', authentication: true },
    { method: 'GET', path: '/api/v1/projects/:id/results/forces', description: 'Get member forces', category: 'Analysis', authentication: true },
    { method: 'GET', path: '/api/v1/projects/:id/results/displacements', description: 'Get displacements', category: 'Analysis', authentication: true },
    
    // Design endpoints
    { method: 'POST', path: '/api/v1/projects/:id/design', description: 'Run design checks', category: 'Design', authentication: true },
    { method: 'GET', path: '/api/v1/projects/:id/design/results', description: 'Get design results', category: 'Design', authentication: true },
    { method: 'GET', path: '/api/v1/projects/:id/design/ratios', description: 'Get utilization ratios', category: 'Design', authentication: true },
    
    // Export endpoints
    { method: 'POST', path: '/api/v1/projects/:id/export/ifc', description: 'Export to IFC', category: 'Export', authentication: true },
    { method: 'POST', path: '/api/v1/projects/:id/export/pdf', description: 'Export report PDF', category: 'Export', authentication: true },
    { method: 'POST', path: '/api/v1/projects/:id/export/dxf', description: 'Export to DXF', category: 'Export', authentication: true },
  ]);

  const [integrations, setIntegrations] = useState<IntegrationApp[]>(() => {
    const defaults: IntegrationApp[] = [
      {
        id: '1',
        name: 'Autodesk Revit',
        icon: '🔷',
        description: 'Two-way sync with Revit models',
        category: 'bim',
        status: 'connected',
        features: ['Model sync', 'Section mapping', 'Results overlay', 'Round-trip'],
      },
      {
        id: '2',
        name: 'Tekla Structures',
        icon: '🔶',
        description: 'Direct link to Tekla detailing',
        category: 'bim',
        status: 'available',
        features: ['Model export', 'Connection details', 'Fabrication data'],
      },
      {
        id: '3',
        name: 'AutoCAD',
        icon: '📐',
        description: 'DWG/DXF import and export',
        category: 'cad',
        status: 'connected',
        features: ['2D drawings', 'Layer mapping', 'Batch export'],
      },
      {
        id: '4',
        name: 'Procore',
        icon: '📊',
        description: 'Project management integration',
        category: 'pm',
        status: 'available',
        features: ['Document sync', 'RFI integration', 'Submittals'],
      },
      {
        id: '5',
        name: 'BIM 360',
        icon: '☁️',
        description: 'Cloud collaboration platform',
        category: 'cloud',
        status: 'connected',
        features: ['File sync', 'Version control', 'Team access'],
      },
      {
        id: '6',
        name: 'ETABS',
        icon: '🏗️',
        description: 'Import/export ETABS models',
        category: 'analysis',
        status: 'available',
        features: ['Model import', 'Results comparison', 'Section mapping'],
      },
      {
        id: '7',
        name: 'STAAD.Pro',
        icon: '🏢',
        description: 'STAAD file compatibility',
        category: 'analysis',
        status: 'available',
        features: ['STD import', 'ANL results', 'Design integration'],
      },
      {
        id: '8',
        name: 'Microsoft Excel',
        icon: '📗',
        description: 'Spreadsheet data exchange',
        category: 'cloud',
        status: 'connected',
        features: ['Data export', 'Template import', 'Live link'],
      },
    ];

    const saved = localStorage.getItem('beamlab_api_integrations');
    if (!saved) return defaults;

    try {
      const parsed = JSON.parse(saved) as IntegrationApp[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => { document.title = 'API Integration | BeamLab'; }, []);

  useEffect(() => {
    localStorage.setItem('beamlab_api_integrations', JSON.stringify(integrations));
  }, [integrations]);

  const showBanner = (message: string, type: 'success' | 'info' = 'info') => {
    setBannerType(type);
    setBannerMessage(message);
    setTimeout(() => setBannerMessage(null), 3000);
  };

  const downloadText = (content: string, filename: string, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateApiKey = () => {
    const suffix = Math.random().toString(36).slice(2, 26);
    const newKey: APIKey = {
      id: Date.now().toString(),
      name: `Generated Key ${apiKeys.length + 1}`,
      key: `bl_prod_${suffix}`,
      created: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
      permissions: ['read', 'analysis'],
      status: 'active',
      requestsToday: 0,
      rateLimit: 5000,
    };

    setApiKeys((prev) => [newKey, ...prev]);
    showBanner('New API key generated.', 'success');
  };

  const copyApiKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    showBanner('API key copied to clipboard.', 'success');
  };

  const addWebhook = () => {
    const nowId = Date.now().toString();
    const hook: Webhook = {
      id: nowId,
      name: `Webhook ${webhooks.length + 1}`,
      url: 'https://example.com/webhooks/beamlab',
      events: ['analysis.completed'],
      status: 'active',
      lastTriggered: 'Never',
      successRate: 100,
    };

    setWebhooks((prev) => [hook, ...prev]);
    showBanner('Webhook added with starter configuration.', 'success');
  };

  const handleIntegrationAction = (integration: IntegrationApp) => {
    if (integration.status === 'available') {
      setIntegrations((prev) =>
        prev.map((item) => (item.id === integration.id ? { ...item, status: 'connected' } : item)),
      );
      showBanner(`${integration.name} connected successfully.`, 'success');
      return;
    }

    if (integration.status === 'connected') {
      localStorage.setItem(
        `beamlab_integration_config_${integration.id}`,
        JSON.stringify({ integration: integration.name, configuredAt: new Date().toISOString() }),
      );
      showBanner(`${integration.name} configuration opened (saved locally).`, 'info');
      return;
    }

    showBanner(`${integration.name} status is already up to date.`, 'info');
  };

  const downloadOpenApiSpec = () => {
    const paths = endpoints.reduce<Record<string, Record<string, { summary: string }>>>((acc, ep) => {
      if (!acc[ep.path]) acc[ep.path] = {};
      acc[ep.path][ep.method.toLowerCase()] = { summary: ep.description };
      return acc;
    }, {});

    const spec = {
      openapi: '3.0.3',
      info: { title: 'BeamLab API', version: '1.0.0' },
      servers: [{ url: 'https://api.beamlabultimate.tech/v1' }],
      paths,
    };

    downloadText(JSON.stringify(spec, null, 2), `beamlab-openapi-${Date.now()}.json`, 'application/json');
    showBanner('OpenAPI specification downloaded.', 'success');
  };

  const openSwaggerDocs = () => {
    window.open('/api/docs', '_blank', 'noopener,noreferrer');
    showBanner('Opened Swagger documentation.', 'info');
  };

  const downloadPluginInstaller = (plugin: { name: string; version: string; size: string; platform: string }) => {
    const safe = plugin.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const generatedAt = new Date().toISOString();
    const manifest = {
      plugin: plugin.name,
      version: plugin.version,
      size: plugin.size,
      platform: plugin.platform,
      generatedAt,
      distributionChannel: 'beamlab-releases',
      installMode: 'signed-package',
      installSteps: [
        'Download the signed package from the BeamLab release channel.',
        'Verify digital signature before execution.',
        'Run installer with administrator privileges.',
        'Restart BeamLab and validate plugin health in Integration Dashboard.',
      ],
    };
    const content = [
      `BeamLab ${plugin.name}`,
      `Version: ${plugin.version}`,
      `Size: ${plugin.size}`,
      `Platform: ${plugin.platform}`,
      `Generated At: ${generatedAt}`,
      '',
      'Installer manifest generated for secure deployment.',
      '',
      JSON.stringify(manifest, null, 2),
    ].join('\n');

    downloadText(content, `${safe}-installer-${plugin.version}.txt`);
    showBanner(`${plugin.name} installer manifest downloaded.`, 'success');
  };

  const methodColors: Record<string, string> = {
    GET: 'bg-green-600',
    POST: 'bg-blue-600',
    PUT: 'bg-yellow-600',
    DELETE: 'bg-red-600',
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* API Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests Today', value: '1,678', change: '+12%', icon: '📊', color: 'from-blue-600 to-cyan-600' },
          { label: 'Active API Keys', value: '3', total: '/5', icon: '🔑', color: 'from-green-600 to-emerald-600' },
          { label: 'Webhook Success', value: '98.2%', change: '↑', icon: '🔗', color: 'from-purple-600 to-pink-600' },
          { label: 'Avg Response Time', value: '42ms', change: '-8%', icon: '⚡', color: 'from-yellow-600 to-orange-600' },
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 rounded-lg bg-gradient-to-r ${stat.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-900/80 dark:text-white/80 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-[#dae2fd]">
                  {stat.value}
                  {stat.total && <span className="text-lg text-slate-900/60 dark:text-white/60">{stat.total}</span>}
                </p>
                {stat.change && <p className="text-slate-900/60 dark:text-white/60 text-sm">{stat.change}</p>}
              </div>
              <span className="text-3xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* API Usage Chart */}
      <div className="bg-[#131b2e] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
          <span className="text-2xl">📈</span>
          API Usage (Last 7 Days)
        </h3>
        <div className="h-48 flex items-end gap-2">
          {[65, 82, 45, 90, 78, 95, 88].map((value, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full bg-gradient-to-t from-cyan-600 to-blue-500 rounded-t"
                style={{ height: `${value}%` }}
              />
              <span className="text-[#869ab8] text-xs">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Generate API Key', icon: '🔑', action: () => setActiveTab('keys') },
          { label: 'Add Webhook', icon: '🔗', action: () => setActiveTab('webhooks') },
          { label: 'View Documentation', icon: '📖', action: () => setActiveTab('docs') },
          { label: 'Manage Integrations', icon: '🔌', action: () => setActiveTab('integrations') },
        ].map((action, idx) => (
          <button type="button"
            key={idx}
            onClick={action.action}
            className="p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-center"
          >
            <span className="text-3xl">{action.icon}</span>
            <p className="text-[#dae2fd] mt-2">{action.label}</p>
          </button>
        ))}
      </div>

      {/* Recent API Calls */}
      <div className="bg-[#131b2e] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
          <span className="text-2xl">📜</span>
          Recent API Calls
        </h3>
        <div className="space-y-2">
          {[
            { method: 'POST', path: '/api/v1/projects/123/analyze', status: 200, time: '156ms', when: '2 mins ago' },
            { method: 'GET', path: '/api/v1/projects/123/results', status: 200, time: '42ms', when: '5 mins ago' },
            { method: 'POST', path: '/api/v1/projects', status: 201, time: '89ms', when: '15 mins ago' },
            { method: 'GET', path: '/api/v1/projects/122/design/ratios', status: 200, time: '31ms', when: '30 mins ago' },
            { method: 'POST', path: '/api/v1/projects/121/export/ifc', status: 202, time: '1.2s', when: '1 hour ago' },
          ].map((call, idx) => (
            <div key={idx} className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-lg">
              <span className={`px-2 py-1 text-xs font-bold text-[#dae2fd] rounded ${methodColors[call.method]}`}>
                {call.method}
              </span>
              <span className="flex-1 text-[#adc6ff] font-mono text-sm">{call.path}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                call.status < 300 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {call.status}
              </span>
              <span className="text-[#869ab8] text-sm w-16">{call.time}</span>
              <span className="text-slate-500 text-sm w-24">{call.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderKeys = () => (
    <div className="space-y-6">
      <div className="bg-[#131b2e] rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
            <span className="text-2xl">🔑</span>
            API Keys
          </h3>
          <button type="button" onClick={generateApiKey} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors flex items-center gap-2">
            <span>➕</span>
            Generate New Key
          </button>
        </div>

        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="p-4 bg-slate-700 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <h4 className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{key.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-[#869ab8] text-sm bg-[#131b2e] px-2 py-1 rounded">
                        {key.key.slice(0, 20)}...
                      </code>
                      <button type="button" onClick={() => copyApiKey(key.key)} className="text-cyan-400 text-sm hover:text-cyan-300">Copy</button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    key.status === 'active' ? 'bg-green-600 text-white' :
                    key.status === 'expired' ? 'bg-yellow-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    {key.status}
                  </span>
                  <button type="button" className="p-2 text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-600 rounded">
                    ⚙️
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[#869ab8]">Created</p>
                  <p className="text-[#dae2fd]">{key.created}</p>
                </div>
                <div>
                  <p className="text-[#869ab8]">Last Used</p>
                  <p className="text-[#dae2fd]">{key.lastUsed}</p>
                </div>
                <div>
                  <p className="text-[#869ab8]">Requests Today</p>
                  <p className="text-[#dae2fd]">{key.requestsToday.toLocaleString()} / {key.rateLimit.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[#869ab8]">Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {key.permissions.map((perm, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-600 text-[#adc6ff] text-xs rounded capitalize">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Usage bar */}
              <div className="mt-4">
                <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    style={{ width: `${(key.requestsToday / key.rateLimit) * 100}%` }}
                  />
                </div>
                <p className="text-[#869ab8] text-xs mt-1">
                  {((key.requestsToday / key.rateLimit) * 100).toFixed(1)}% of daily limit used
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Key Settings */}
      <div className="bg-[#131b2e] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
          <span className="text-2xl">⚙️</span>
          Rate Limiting & Security
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#adc6ff] mb-2">Rate Limit (requests/day)</label>
              <select className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-[#dae2fd]">
                <option value="1000">1,000 (Free tier)</option>
                <option value="5000">5,000 (Starter)</option>
                <option value="10000" selected>10,000 (Professional)</option>
                <option value="50000">50,000 (Enterprise)</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#adc6ff] mb-2">IP Whitelist</label>
              <textarea
                placeholder="192.168.1.1&#10;10.0.0.0/24"
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-[#dae2fd] placeholder-slate-400"
                rows={3}
              />
            </div>
          </div>
          <div className="space-y-4">
            {[
              { name: 'Require HTTPS', enabled: true },
              { name: 'API Key Expiration', enabled: false },
              { name: 'Request Logging', enabled: true },
              { name: 'Error Notifications', enabled: true },
            ].map((setting, idx) => (
              <label key={idx} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg cursor-pointer">
                <span className="text-[#adc6ff]">{setting.name}</span>
                <div className={`relative w-12 h-6 rounded-full transition-colors ${setting.enabled ? 'bg-green-600' : 'bg-slate-500'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${setting.enabled ? 'right-1' : 'left-1'}`} />
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderWebhooks = () => (
    <div className="space-y-6">
      <div className="bg-[#131b2e] rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
            <span className="text-2xl">🔗</span>
            Webhooks
          </h3>
          <button type="button" onClick={addWebhook} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors flex items-center gap-2">
            <span>➕</span>
            Add Webhook
          </button>
        </div>

        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="p-4 bg-slate-700 rounded-lg border border-slate-600"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">📡</span>
                  <div>
                    <h4 className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{webhook.name}</h4>
                    <code className="text-[#869ab8] text-sm">{webhook.url}</code>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    webhook.status === 'active' ? 'bg-green-600 text-white' :
                    webhook.status === 'paused' ? 'bg-yellow-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    {webhook.status}
                  </span>
                  <button type="button" className="p-2 text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-600 rounded">
                    ⚙️
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-[#869ab8]">Events: </span>
                  {webhook.events.map((event, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-600 text-cyan-400 text-xs rounded ml-1">
                      {event}
                    </span>
                  ))}
                </div>
                <div className="text-[#869ab8]">
                  Last triggered: <span className="text-[#dae2fd]">{webhook.lastTriggered}</span>
                </div>
                <div className="text-[#869ab8]">
                  Success rate: <span className={webhook.successRate >= 95 ? 'text-green-400' : 'text-yellow-400'}>{webhook.successRate}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Events */}
      <div className="bg-[#131b2e] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
          <span className="text-2xl">📋</span>
          Available Events
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { category: 'Analysis', events: ['analysis.started', 'analysis.completed', 'analysis.failed'] },
            { category: 'Design', events: ['design.started', 'design.completed', 'design.approved', 'design.rejected'] },
            { category: 'Export', events: ['export.started', 'export.completed', 'export.failed'] },
            { category: 'Project', events: ['project.created', 'project.updated', 'project.deleted', 'project.shared'] },
            { category: 'Comment', events: ['comment.added', 'comment.resolved'] },
            { category: 'User', events: ['user.joined', 'user.left', 'user.role_changed'] },
          ].map((cat, idx) => (
            <div key={idx} className="p-4 bg-slate-700 rounded-lg">
              <h4 className="text-[#dae2fd] font-medium tracking-wide tracking-wide mb-2">{cat.category}</h4>
              <div className="space-y-1">
                {cat.events.map((event, eIdx) => (
                  <div key={eIdx} className="text-sm text-cyan-400 font-mono">{event}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDocs = () => (
    <div className="space-y-6">
      <div className="bg-[#131b2e] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
          <span className="text-2xl">📖</span>
          API Documentation
        </h3>
        
        <div className="mb-6">
          <p className="text-[#869ab8] mb-4">
            Base URL: <code className="text-cyan-400 bg-slate-700 px-2 py-1 rounded">https://api.beamlabultimate.tech/v1</code>
          </p>
          <div className="flex gap-4">
            <button type="button" onClick={downloadOpenApiSpec} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500">
              📥 Download OpenAPI Spec
            </button>
            <button type="button" onClick={openSwaggerDocs} className="px-4 py-2 bg-slate-700 text-[#adc6ff] rounded-lg hover:bg-slate-600">
              🔗 View in Swagger
            </button>
          </div>
        </div>

        {/* Endpoints by Category */}
        {['Projects', 'Model', 'Analysis', 'Design', 'Export'].map((category) => (
          <div key={category} className="mb-6">
            <h4 className="text-lg font-medium tracking-wide tracking-wide text-[#dae2fd] mb-3 flex items-center gap-2">
              <span className="text-xl">
                {category === 'Projects' ? '📁' : 
                 category === 'Model' ? '🏗️' :
                 category === 'Analysis' ? '🔬' :
                 category === 'Design' ? '📐' : '📤'}
              </span>
              {category}
            </h4>
            <div className="space-y-2">
              {endpoints
                .filter(e => e.category === category)
                .map((endpoint, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <span className={`px-2 py-1 text-xs font-bold text-[#dae2fd] rounded min-w-16 text-center ${methodColors[endpoint.method]}`}>
                      {endpoint.method}
                    </span>
                    <code className="text-cyan-400 font-mono text-sm flex-1">{endpoint.path}</code>
                    <span className="text-[#869ab8] text-sm">{endpoint.description}</span>
                    {endpoint.authentication && (
                      <span className="text-yellow-500" title="Requires authentication">🔒</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Example Code */}
      <div className="bg-[#131b2e] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
          <span className="text-2xl">💻</span>
          Example Code
        </h3>
        <div className="bg-[#0b1326] rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-[#adc6ff]">
{`// Run structural analysis via API
const response = await fetch('https://api.beamlabultimate.tech/v1/projects/123/analyze', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer bl_prod_xxxx',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    loadCombinations: ['LC1', 'LC2', 'LC3'],
    options: {
      secondOrder: true,
      dynamicAnalysis: true
    }
  })
});

const results = await response.json();
// console.log('Analysis complete:', results.summary);`}
          </pre>
        </div>
      </div>
    </div>
  );

  const renderIntegrations = () => (
    <div className="space-y-6">
      <div className="bg-[#131b2e] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#dae2fd] mb-6 flex items-center gap-2">
          <span className="text-2xl">🔌</span>
          Available Integrations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                integration.status === 'connected' 
                  ? 'bg-green-900/20 border-green-600 hover:border-green-500'
                  : integration.status === 'available'
                  ? 'bg-slate-700 border-slate-600 hover:border-cyan-500'
                  : 'bg-slate-700/50 border-[#1a2333]'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{integration.icon}</span>
                <div>
                  <h4 className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{integration.name}</h4>
                  <span className={`text-xs capitalize ${
                    integration.status === 'connected' ? 'text-green-400' :
                    'text-cyan-400'
                  }`}>
                    {integration.status === 'connected' ? '✓ Connected' :
                     'Available'}
                  </span>
                </div>
              </div>
              <p className="text-[#869ab8] text-sm mb-3">{integration.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {integration.features.map((feature, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-slate-600 text-[#adc6ff] text-xs rounded">
                    {feature}
                  </span>
                ))}
              </div>
              <button type="button"
                onClick={() => handleIntegrationAction(integration)}
                className={`w-full py-2 rounded text-sm ${
                  integration.status === 'connected'
                    ? 'bg-slate-600 text-[#adc6ff] hover:bg-slate-500'
                    : 'bg-cyan-600 text-white hover:bg-cyan-500'
                }`}
              >
                {integration.status === 'connected' ? 'Configure' :
                 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Plugin Downloads */}
      <div className="bg-[#131b2e] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
          <span className="text-2xl">📥</span>
          Desktop Plugins
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Revit Plugin', version: '2.1.0', size: '45 MB', platform: 'Revit 2022-2024' },
            { name: 'AutoCAD Plugin', version: '1.5.2', size: '28 MB', platform: 'AutoCAD 2021+' },
            { name: 'Excel Add-in', version: '1.2.0', size: '12 MB', platform: 'Excel 2019+' },
          ].map((plugin, idx) => (
            <div key={idx} className="p-4 bg-slate-700 rounded-lg flex items-center justify-between">
              <div>
                <h4 className="text-[#dae2fd] font-medium tracking-wide tracking-wide">{plugin.name}</h4>
                <p className="text-[#869ab8] text-sm">v{plugin.version} • {plugin.size}</p>
                <p className="text-slate-500 text-xs">{plugin.platform}</p>
              </div>
              <button type="button" onClick={() => downloadPluginInstaller(plugin)} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500">
                📥 Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {bannerMessage && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${bannerType === 'success' ? 'bg-green-900/30 text-green-400 border border-green-700/40' : 'bg-cyan-900/30 text-cyan-300 border border-cyan-700/40'}`}>
            {bannerMessage}
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
            🔌 API Integration Dashboard
          </h1>
          <p className="text-[#869ab8]">
            REST API • Webhooks • Third-Party Integrations • Developer Tools
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'keys', label: 'API Keys', icon: '🔑' },
            { id: 'webhooks', label: 'Webhooks', icon: '🔗' },
            { id: 'docs', label: 'Documentation', icon: '📖' },
            { id: 'integrations', label: 'Integrations', icon: '🔌' },
          ].map((tab) => (
            <button type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-6 py-3 rounded-lg font-medium tracking-wide tracking-wide transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-[#adc6ff] hover:bg-slate-600'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'keys' && renderKeys()}
        {activeTab === 'webhooks' && renderWebhooks()}
        {activeTab === 'docs' && renderDocs()}
        {activeTab === 'integrations' && renderIntegrations()}
      </motion.div>
    </div>
  );
};

export default memo(APIIntegrationDashboard);
