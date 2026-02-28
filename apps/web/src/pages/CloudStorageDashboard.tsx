/**
 * Cloud Storage Dashboard - Enterprise Project Management
 *
 * Features:
 * - Cloud project storage with automatic backup
 * - Version history and rollback
 * - Project templates library
 * - Cross-device sync
 * - Team sharing and collaboration
 * - Export to various formats
 *
 * Industry Standard: Matches STAAD.Pro Connect Edition, Tekla Model Sharing
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Cloud,
  HardDrive,
  Download,
  Upload,
  Folder,
  FolderOpen,
  File,
  FileText,
  Clock,
  History,
  Share2,
  Lock,
  Unlock,
  RefreshCw,
  Settings,
  Search,
  Filter,
  Grid,
  List,
  MoreVertical,
  Trash2,
  Copy,
  Edit,
  Star,
  StarOff,
  Users,
  Link,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Home,
  Building2,
  Box,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";

// Types
interface CloudProject {
  id: string;
  name: string;
  description: string;
  type: "building" | "bridge" | "industrial" | "foundation" | "other";
  status: "active" | "archived" | "shared";
  lastModified: Date;
  created: Date;
  size: number; // in bytes
  version: number;
  isStarred: boolean;
  isShared: boolean;
  collaborators: string[];
  syncStatus: "synced" | "syncing" | "offline" | "error";
  thumbnail?: string;
  tags: string[];
}

interface ProjectVersion {
  id: string;
  version: number;
  timestamp: Date;
  author: string;
  description: string;
  size: number;
  isAutoSave: boolean;
}

interface StorageStats {
  used: number;
  total: number;
  projects: number;
  backups: number;
  lastSync: Date;
}

const CloudStorageDashboard: React.FC = () => {
  useEffect(() => { document.title = 'Cloud Storage | BeamLab'; }, []);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProject, setSelectedProject] = useState<CloudProject | null>(
    null,
  );
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "modified" | "size">(
    "modified",
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Mock data
  const [projects] = useState<CloudProject[]>([
    {
      id: "p1",
      name: "10-Story Office Building",
      description:
        "Commercial office building with RCC frame, Zone IV seismic design",
      type: "building",
      status: "active",
      lastModified: new Date("2025-01-29T14:30:00"),
      created: new Date("2024-11-15T09:00:00"),
      size: 45670000,
      version: 23,
      isStarred: true,
      isShared: true,
      collaborators: ["john@eng.com", "sarah@struct.com"],
      syncStatus: "synced",
      tags: ["RCC", "Seismic", "IS 1893"],
    },
    {
      id: "p2",
      name: "Highway Bridge - NH44",
      description: "PSC Box Girder Bridge, 3 spans of 40m each",
      type: "bridge",
      status: "active",
      lastModified: new Date("2025-01-28T10:15:00"),
      created: new Date("2024-10-01T11:00:00"),
      size: 78340000,
      version: 45,
      isStarred: true,
      isShared: false,
      collaborators: [],
      syncStatus: "synced",
      tags: ["PSC", "Bridge", "IRC 112"],
    },
    {
      id: "p3",
      name: "Industrial Warehouse",
      description: "Steel portal frame, 30m clear span, PEB structure",
      type: "industrial",
      status: "active",
      lastModified: new Date("2025-01-27T16:45:00"),
      created: new Date("2024-12-01T08:30:00"),
      size: 23450000,
      version: 12,
      isStarred: false,
      isShared: true,
      collaborators: ["mike@steel.com"],
      syncStatus: "syncing",
      tags: ["Steel", "PEB", "IS 800"],
    },
    {
      id: "p4",
      name: "Residential Tower - G+25",
      description: "High-rise residential with shear wall core and flat slab",
      type: "building",
      status: "active",
      lastModified: new Date("2025-01-26T09:30:00"),
      created: new Date("2024-08-15T10:00:00"),
      size: 92100000,
      version: 67,
      isStarred: false,
      isShared: false,
      collaborators: [],
      syncStatus: "synced",
      tags: ["RCC", "High-rise", "IS 456"],
    },
    {
      id: "p5",
      name: "Foundation Design - Factory",
      description: "Machine foundation with vibration isolation",
      type: "foundation",
      status: "archived",
      lastModified: new Date("2025-01-10T11:00:00"),
      created: new Date("2024-06-01T09:00:00"),
      size: 12340000,
      version: 8,
      isStarred: false,
      isShared: false,
      collaborators: [],
      syncStatus: "synced",
      tags: ["Foundation", "Vibration", "IS 2974"],
    },
  ]);

  const [versions] = useState<ProjectVersion[]>([
    {
      id: "v23",
      version: 23,
      timestamp: new Date("2025-01-29T14:30:00"),
      author: "You",
      description: "Updated seismic analysis results",
      size: 45670000,
      isAutoSave: false,
    },
    {
      id: "v22",
      version: 22,
      timestamp: new Date("2025-01-29T12:15:00"),
      author: "You",
      description: "Auto-save",
      size: 45650000,
      isAutoSave: true,
    },
    {
      id: "v21",
      version: 21,
      timestamp: new Date("2025-01-29T10:00:00"),
      author: "Sarah",
      description: "Added pushover analysis",
      size: 45600000,
      isAutoSave: false,
    },
    {
      id: "v20",
      version: 20,
      timestamp: new Date("2025-01-28T16:45:00"),
      author: "You",
      description: "Revised column sections",
      size: 45400000,
      isAutoSave: false,
    },
    {
      id: "v19",
      version: 19,
      timestamp: new Date("2025-01-28T14:30:00"),
      author: "John",
      description: "Foundation design update",
      size: 45300000,
      isAutoSave: false,
    },
  ]);

  const [storageStats] = useState<StorageStats>({
    used: 251890000,
    total: 5000000000, // 5 GB
    projects: 12,
    backups: 156,
    lastSync: new Date(),
  });

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Format date
  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) return "Just now";
    if (hours < 24) return `${Math.floor(hours)} hours ago`;
    if (hours < 48) return "Yesterday";
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get icon for project type
  const getProjectIcon = (type: string) => {
    switch (type) {
      case "building":
        return Building2;
      case "bridge":
        return Box;
      case "industrial":
        return Folder;
      case "foundation":
        return HardDrive;
      default:
        return File;
    }
  };

  // Get sync status color
  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case "synced":
        return "text-green-400";
      case "syncing":
        return "text-blue-400 animate-spin";
      case "offline":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  // Filter and sort projects
  const filteredProjects = projects
    .filter((p) => {
      if (
        searchQuery &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      if (filterType !== "all" && p.type !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "modified":
          return b.lastModified.getTime() - a.lastModified.getTime();
        case "size":
          return b.size - a.size;
        default:
          return 0;
      }
    });

  // Handle file upload
  const uploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
    },
    [],
  );

  const handleUpload = useCallback(() => {
    setIsUploading(true);
    setUploadProgress(0);

    uploadIntervalRef.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          if (uploadIntervalRef.current)
            clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-700/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <RouterLink
                to="/dashboard"
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </RouterLink>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Cloud className="w-7 h-7 text-blue-400" />
                  Cloud Storage
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Enterprise project management with automatic backup
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleUpload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Project
              </button>
              <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Storage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-300 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 dark:text-slate-400 text-sm">Storage Used</span>
              <HardDrive className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {formatSize(storageStats.used)}
            </p>
            <div className="mt-2 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                style={{
                  width: `${(storageStats.used / storageStats.total) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              of {formatSize(storageStats.total)}
            </p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-300 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 dark:text-slate-400 text-sm">Projects</span>
              <Folder className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {storageStats.projects}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Active projects</p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-300 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 dark:text-slate-400 text-sm">Backups</span>
              <History className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {storageStats.backups}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Version snapshots</p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-300 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 dark:text-slate-400 text-sm">Last Sync</span>
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-lg font-bold text-white">
              {formatDate(storageStats.lastSync)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle className="w-3 h-3 text-green-400" />
              <p className="text-xs text-green-400">All synced</p>
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <span className="text-white font-medium">
                  Uploading project...
                </span>
              </div>
              <span className="text-blue-400">{uploadProgress}%</span>
            </div>
            <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="building">Buildings</option>
              <option value="bridge">Bridges</option>
              <option value="industrial">Industrial</option>
              <option value="foundation">Foundation</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
            >
              <option value="modified">Last Modified</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>

            <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2.5 ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-white"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2.5 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Projects Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => {
              const Icon = getProjectIcon(project.type);
              return (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className={`bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border transition-all cursor-pointer group ${
                    selectedProject?.id === project.id
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "border-slate-300 dark:border-slate-700/50 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <RefreshCw
                        className={`w-4 h-4 ${getSyncStatusColor(project.syncStatus)}`}
                      />
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <Star
                          className={`w-4 h-4 ${project.isStarred ? "text-yellow-400 fill-yellow-400" : "text-slate-600 dark:text-slate-400"}`}
                        />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-1 truncate">
                    {project.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {project.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-slate-700/50 text-slate-700 dark:text-slate-300 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDate(project.lastModified)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 dark:text-slate-400">
                        {formatSize(project.size)}
                      </span>
                      {project.isShared && (
                        <div className="flex items-center gap-1 text-blue-400">
                          <Users className="w-3.5 h-3.5" />
                          <span>{project.collaborators.length + 1}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-300 dark:border-slate-700/50 flex items-center justify-between">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      v{project.version}
                    </span>
                    <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                      Open <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-300 dark:border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="text-left p-4 text-slate-600 dark:text-slate-400 font-medium text-sm">
                    Project
                  </th>
                  <th className="text-left p-4 text-slate-600 dark:text-slate-400 font-medium text-sm">
                    Type
                  </th>
                  <th className="text-left p-4 text-slate-600 dark:text-slate-400 font-medium text-sm">
                    Modified
                  </th>
                  <th className="text-right p-4 text-slate-600 dark:text-slate-400 font-medium text-sm">
                    Size
                  </th>
                  <th className="text-center p-4 text-slate-600 dark:text-slate-400 font-medium text-sm">
                    Version
                  </th>
                  <th className="text-center p-4 text-slate-600 dark:text-slate-400 font-medium text-sm">
                    Status
                  </th>
                  <th className="text-right p-4 text-slate-600 dark:text-slate-400 font-medium text-sm">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const Icon = getProjectIcon(project.type);
                  return (
                    <tr
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className={`border-t border-slate-300 dark:border-slate-700/50 cursor-pointer transition-colors ${
                        selectedProject?.id === project.id
                          ? "bg-blue-900/20"
                          : "hover:bg-slate-200 dark:hover:bg-slate-700/30"
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-white font-medium">
                              {project.name}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs">
                              {project.description}
                            </p>
                          </div>
                          {project.isStarred && (
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 capitalize">
                        {project.type}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {formatDate(project.lastModified)}
                      </td>
                      <td className="p-4 text-right text-slate-600 dark:text-slate-400">
                        {formatSize(project.size)}
                      </td>
                      <td className="p-4 text-center text-slate-600 dark:text-slate-400">
                        v{project.version}
                      </td>
                      <td className="p-4 text-center">
                        <RefreshCw
                          className={`w-4 h-4 mx-auto ${getSyncStatusColor(project.syncStatus)}`}
                        />
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-1.5 hover:bg-slate-600/50 rounded text-slate-600 dark:text-slate-400 hover:text-white">
                            <Download className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-slate-600/50 rounded text-slate-600 dark:text-slate-400 hover:text-white">
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-slate-600/50 rounded text-slate-600 dark:text-slate-400 hover:text-white">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Selected Project Details Panel */}
        {selectedProject && (
          <div className="fixed inset-y-0 right-0 w-96 bg-slate-50 dark:bg-slate-900 border-l border-slate-300 dark:border-slate-700 shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  Project Details
                </h2>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Project Info */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {selectedProject.name}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    {selectedProject.description}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {selectedProject.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-slate-700/50 text-slate-700 dark:text-slate-300 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-600 dark:text-slate-400 text-xs">Size</p>
                    <p className="text-white font-semibold">
                      {formatSize(selectedProject.size)}
                    </p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-600 dark:text-slate-400 text-xs">Version</p>
                    <p className="text-white font-semibold">
                      v{selectedProject.version}
                    </p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-600 dark:text-slate-400 text-xs">Created</p>
                    <p className="text-white font-semibold text-sm">
                      {formatDate(selectedProject.created)}
                    </p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-600 dark:text-slate-400 text-xs">Modified</p>
                    <p className="text-white font-semibold text-sm">
                      {formatDate(selectedProject.lastModified)}
                    </p>
                  </div>
                </div>

                {/* Collaborators */}
                {selectedProject.isShared && (
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Collaborators
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          Y
                        </div>
                        <div>
                          <p className="text-white text-sm">You</p>
                          <p className="text-slate-600 dark:text-slate-400 text-xs">Owner</p>
                        </div>
                      </div>
                      {selectedProject.collaborators.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg"
                        >
                          <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white text-sm">{email}</p>
                            <p className="text-slate-600 dark:text-slate-400 text-xs">Editor</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Version History */}
                <div>
                  <button
                    onClick={() => setShowVersionHistory(!showVersionHistory)}
                    className="w-full flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-white">
                      <History className="w-4 h-4" />
                      Version History
                    </span>
                    {showVersionHistory ? (
                      <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    )}
                  </button>

                  {showVersionHistory && (
                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="p-3 bg-slate-100 dark:bg-slate-800/30 rounded-lg border border-slate-300 dark:border-slate-700/30"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-medium text-sm">
                              v{version.version}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 text-xs">
                              {formatSize(version.size)}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">
                            {version.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400 text-xs">
                              {version.author} • {formatDate(version.timestamp)}
                            </span>
                            <button className="text-blue-400 hover:text-blue-300 text-xs">
                              Restore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t border-slate-300 dark:border-slate-700">
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                    <ExternalLink className="w-4 h-4" />
                    Open in Editor
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Templates Section */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Project Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                name: "Multi-Story Building",
                type: "RCC Frame",
                icon: Building2,
                color: "from-blue-600 to-cyan-600",
              },
              {
                name: "Bridge Structure",
                type: "PSC/Steel",
                icon: Box,
                color: "from-green-600 to-emerald-600",
              },
              {
                name: "Industrial Shed",
                type: "Steel Portal",
                icon: Folder,
                color: "from-orange-600 to-red-600",
              },
              {
                name: "Foundation",
                type: "Isolated/Combined",
                icon: HardDrive,
                color: "from-purple-600 to-pink-600",
              },
            ].map((template) => (
              <button
                key={template.name}
                className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-300 dark:border-slate-700/50 hover:border-slate-600 transition-all group text-left"
              >
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center mb-3`}
                >
                  <template.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">
                  {template.name}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">{template.type}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloudStorageDashboard;
