/**
 * API Integration Dashboard - Developer & External System Integration
 * 
 * Purpose: Comprehensive API management for integrating BeamLab with external
 * systems, automation workflows, and third-party applications.
 * 
 * Industry Parity: Matches STAAD OpenAPI, SAP2000 OAPI, ETABS API,
 * and modern cloud engineering platform integrations.
 */

import React, { useState } from 'react';
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
  status: 'connected' | 'available' | 'coming-soon';
  features: string[];
}

const APIIntegrationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'webhooks' | 'docs' | 'integrations'>('overview');
  
  const [apiKeys] = useState<APIKey[]>([
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

  const [webhooks] = useState<Webhook[]>([
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

  const [integrations] = useState<IntegrationApp[]>([
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
  ]);

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
                <p className="text-white/80 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-white">
                  {stat.value}
                  {stat.total && <span className="text-lg text-white/60">{stat.total}</span>}
                </p>
                {stat.change && <p className="text-white/60 text-sm">{stat.change}</p>}
              </div>
              <span className="text-3xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* API Usage Chart */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
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
              <span className="text-gray-600 dark:text-gray-400 text-xs">
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
          <button
            key={idx}
            onClick={action.action}
            className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-center"
          >
            <span className="text-3xl">{action.icon}</span>
            <p className="text-white mt-2">{action.label}</p>
          </button>
        ))}
      </div>

      {/* Recent API Calls */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
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
            <div key={idx} className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg">
              <span className={`px-2 py-1 text-xs font-bold text-white rounded ${methodColors[call.method]}`}>
                {call.method}
              </span>
              <span className="flex-1 text-gray-700 dark:text-gray-300 font-mono text-sm">{call.path}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                call.status < 300 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {call.status}
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-sm w-16">{call.time}</span>
              <span className="text-gray-500 text-sm w-24">{call.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderKeys = () => (
    <div className="space-y-6">
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🔑</span>
            API Keys
          </h3>
          <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors flex items-center gap-2">
            <span>➕</span>
            Generate New Key
          </button>
        </div>

        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <h4 className="text-white font-medium">{key.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-gray-600 dark:text-gray-400 text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {key.key.slice(0, 20)}...
                      </code>
                      <button className="text-cyan-400 text-sm hover:text-cyan-300">Copy</button>
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
                  <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-white hover:bg-gray-600 rounded">
                    ⚙️
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Created</p>
                  <p className="text-white">{key.created}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Last Used</p>
                  <p className="text-white">{key.lastUsed}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Requests Today</p>
                  <p className="text-white">{key.requestsToday.toLocaleString()} / {key.rateLimit.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {key.permissions.map((perm, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded capitalize">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Usage bar */}
              <div className="mt-4">
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    style={{ width: `${(key.requestsToday / key.rateLimit) * 100}%` }}
                  />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                  {((key.requestsToday / key.rateLimit) * 100).toFixed(1)}% of daily limit used
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Key Settings */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">⚙️</span>
          Rate Limiting & Security
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Rate Limit (requests/day)</label>
              <select className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                <option value="1000">1,000 (Free tier)</option>
                <option value="5000">5,000 (Starter)</option>
                <option value="10000" selected>10,000 (Professional)</option>
                <option value="50000">50,000 (Enterprise)</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">IP Whitelist</label>
              <textarea
                placeholder="192.168.1.1&#10;10.0.0.0/24"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
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
              <label key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer">
                <span className="text-gray-700 dark:text-gray-300">{setting.name}</span>
                <div className={`relative w-12 h-6 rounded-full transition-colors ${setting.enabled ? 'bg-green-600' : 'bg-gray-500'}`}>
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
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🔗</span>
            Webhooks
          </h3>
          <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors flex items-center gap-2">
            <span>➕</span>
            Add Webhook
          </button>
        </div>

        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="p-4 bg-gray-700 rounded-lg border border-gray-600"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">📡</span>
                  <div>
                    <h4 className="text-white font-medium">{webhook.name}</h4>
                    <code className="text-gray-600 dark:text-gray-400 text-sm">{webhook.url}</code>
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
                  <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-white hover:bg-gray-600 rounded">
                    ⚙️
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Events: </span>
                  {webhook.events.map((event, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-600 text-cyan-400 text-xs rounded ml-1">
                      {event}
                    </span>
                  ))}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Last triggered: <span className="text-white">{webhook.lastTriggered}</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Success rate: <span className={webhook.successRate >= 95 ? 'text-green-400' : 'text-yellow-400'}>{webhook.successRate}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Events */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
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
            <div key={idx} className="p-4 bg-gray-700 rounded-lg">
              <h4 className="text-white font-medium mb-2">{cat.category}</h4>
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
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📖</span>
          API Documentation
        </h3>
        
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Base URL: <code className="text-cyan-400 bg-gray-700 px-2 py-1 rounded">https://api.beamlab.io/v1</code>
          </p>
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500">
              📥 Download OpenAPI Spec
            </button>
            <button className="px-4 py-2 bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-600">
              🔗 View in Swagger
            </button>
          </div>
        </div>

        {/* Endpoints by Category */}
        {['Projects', 'Model', 'Analysis', 'Design', 'Export'].map((category) => (
          <div key={category} className="mb-6">
            <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
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
                    className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <span className={`px-2 py-1 text-xs font-bold text-white rounded min-w-16 text-center ${methodColors[endpoint.method]}`}>
                      {endpoint.method}
                    </span>
                    <code className="text-cyan-400 font-mono text-sm flex-1">{endpoint.path}</code>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">{endpoint.description}</span>
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
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">💻</span>
          Example Code
        </h3>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-700 dark:text-gray-300">
{`// Run structural analysis via API
const response = await fetch('https://api.beamlab.io/v1/projects/123/analyze', {
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
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
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
                  ? 'bg-gray-700 border-gray-600 hover:border-cyan-500'
                  : 'bg-gray-700/50 border-gray-300 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{integration.icon}</span>
                <div>
                  <h4 className="text-white font-medium">{integration.name}</h4>
                  <span className={`text-xs capitalize ${
                    integration.status === 'connected' ? 'text-green-400' :
                    integration.status === 'available' ? 'text-cyan-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {integration.status === 'connected' ? '✓ Connected' :
                     integration.status === 'available' ? 'Available' :
                     'Coming Soon'}
                  </span>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{integration.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {integration.features.map((feature, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded">
                    {feature}
                  </span>
                ))}
              </div>
              <button
                className={`w-full py-2 rounded text-sm ${
                  integration.status === 'connected'
                    ? 'bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-500'
                    : integration.status === 'available'
                    ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                    : 'bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                }`}
                disabled={integration.status === 'coming-soon'}
              >
                {integration.status === 'connected' ? 'Configure' :
                 integration.status === 'available' ? 'Connect' :
                 'Coming Soon'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Plugin Downloads */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📥</span>
          Desktop Plugins
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Revit Plugin', version: '2.1.0', size: '45 MB', platform: 'Revit 2022-2024' },
            { name: 'AutoCAD Plugin', version: '1.5.2', size: '28 MB', platform: 'AutoCAD 2021+' },
            { name: 'Excel Add-in', version: '1.2.0', size: '12 MB', platform: 'Excel 2019+' },
          ].map((plugin, idx) => (
            <div key={idx} className="p-4 bg-gray-700 rounded-lg flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">{plugin.name}</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">v{plugin.version} • {plugin.size}</p>
                <p className="text-gray-500 text-xs">{plugin.platform}</p>
              </div>
              <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500">
                📥 Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
            🔌 API Integration Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
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
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-600'
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

export default APIIntegrationDashboard;
