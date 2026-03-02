/**
 * Collaboration Hub - Multi-User Real-Time Collaboration
 *
 * Purpose: Team collaboration features for structural engineering projects
 * with real-time editing, comments, version control, and project management.
 *
 * Industry Parity: Matches Bluebeam collaboration, BIM 360 coordination,
 * and modern cloud engineering workflows.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useMultiplayer, RemoteUser } from "../hooks/useMultiplayer";

// Types
interface TeamMember {
  id: string;
  name: string;
  role: "admin" | "engineer" | "reviewer" | "viewer";
  avatar: string;
  status: "online" | "away" | "offline";
  lastActive: string;
  department: string;
}

interface ProjectActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  timestamp: string;
  details?: string;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  content: string;
  timestamp: string;
  location?: { element: string; coordinates: string };
  status: "open" | "resolved" | "pending";
  replies: Comment[];
}

interface ProjectVersion {
  id: string;
  version: string;
  name: string;
  author: string;
  timestamp: string;
  changes: string[];
  status: "current" | "previous" | "milestone";
}

interface SharedProject {
  id: string;
  name: string;
  owner: string;
  lastModified: string;
  members: number;
  status: "active" | "review" | "completed" | "archived";
  progress: number;
}

const CollaborationHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "team" | "comments" | "versions" | "sharing"
  >("dashboard");
  const [commentFilter, setCommentFilter] = useState<
    "all" | "open" | "pending" | "resolved"
  >("all");
  const [newCommentText, setNewCommentText] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "viewer" | "engineer" | "reviewer"
  >("viewer");
  const [shareLink] = useState(
    `https://beamlab.app/project/${Date.now().toString(36)}`,
  );
  const [linkCopied, setLinkCopied] = useState(false);
  const [accessSettings, setAccessSettings] = useState<Record<string, boolean>>(
    {
      publicLink: false,
      allowComments: true,
      downloadPermission: true,
      watermarkExports: true,
      expiration: false,
    },
  );

  useEffect(() => { document.title = 'Collaboration | BeamLab'; }, []);

  // ============================================
  // REAL MULTIPLAYER CONNECTION
  // ============================================
  const DEMO_ACTIVITIES: ProjectActivity[] = [
    {
      id: "demo-a1",
      userId: "demo-1",
      userName: "Priya Sharma",
      action: "completed analysis on",
      target: "Frame A — Seismic LC",
      timestamp: "10 min ago",
    },
    {
      id: "demo-a2",
      userId: "demo-2",
      userName: "Amit Kumar",
      action: "updated",
      target: "Beam B-201 reinforcement spacing",
      timestamp: "25 min ago",
    },
    {
      id: "demo-a3",
      userId: "demo-3",
      userName: "Neha Patel",
      action: "commented on",
      target: "Foundation F-03 SBC check",
      timestamp: "1 hour ago",
    },
    {
      id: "demo-a4",
      userId: "self",
      userName: "You",
      action: "created version",
      target: "v2.4.1 — Current Working",
      timestamp: "2 hours ago",
    },
    {
      id: "demo-a5",
      userId: "demo-4",
      userName: "Rahul Singh",
      action: "uploaded",
      target: "Soil Investigation Report.pdf",
      timestamp: "Yesterday",
    },
  ];
  const activitiesRef = useRef<ProjectActivity[]>([]);
  const [activities, setActivities] =
    useState<ProjectActivity[]>(DEMO_ACTIVITIES);

  const {
    isConnected,
    userId: myId,
    userName: myName,
    userColor: _myColor, // eslint-disable-line @typescript-eslint/no-unused-vars
    remoteUsers,
    projectVersion,
  } = useMultiplayer({
    projectId: "collab-hub-default",
    userName: localStorage.getItem("user_name") || "You",
    onUserJoined: (user) => {
      addActivity(user.name, "joined", "the project");
    },
    onUserLeft: (uid) => {
      addActivity(uid, "left", "the project");
    },
    onAnalysisStarted: (name) => {
      addActivity(name, "started analysis on", "the current model");
    },
    onAnalysisComplete: (_results, name) => {
      addActivity(name, "completed analysis on", "the current model");
    },
  });

  const addActivity = useCallback(
    (userName: string, action: string, target: string, details?: string) => {
      const activity: ProjectActivity = {
        id: String(Date.now()),
        userId: "0",
        userName,
        action,
        target,
        timestamp: new Date().toLocaleTimeString(),
        details,
      };
      activitiesRef.current = [activity, ...activitiesRef.current].slice(0, 50);
      setActivities([...activitiesRef.current]);
    },
    [],
  );

  // Demo team members shown when server is not connected
  const DEMO_TEAM: TeamMember[] = [
    {
      id: "demo-1",
      name: "Priya Sharma",
      role: "engineer",
      avatar: "👩‍💻",
      status: "online",
      lastActive: "Now",
      department: "Structural Design",
    },
    {
      id: "demo-2",
      name: "Amit Kumar",
      role: "engineer",
      avatar: "👨‍💻",
      status: "online",
      lastActive: "5 min ago",
      department: "Analysis",
    },
    {
      id: "demo-3",
      name: "Neha Patel",
      role: "reviewer",
      avatar: "👩‍🔬",
      status: "away",
      lastActive: "30 min ago",
      department: "QA / Review",
    },
    {
      id: "demo-4",
      name: "Rahul Singh",
      role: "viewer",
      avatar: "👨‍🔧",
      status: "offline",
      lastActive: "2 hours ago",
      department: "Site Engineering",
    },
  ];

  // Derive team members from real connected users (or use demo data)
  const teamMembers: TeamMember[] = [
    // Current user
    {
      id: myId || "self",
      name: myName || "You",
      role: "admin" as const,
      avatar: "👨‍💼",
      status: "online" as const,
      lastActive: "Now",
      department: "Structural Design",
    },
    // Remote users from socket.io
    ...remoteUsers.map((u: RemoteUser) => ({
      id: u.id,
      name: u.name,
      role: "engineer" as const,
      avatar: "👨‍💻",
      status: (u.isActive ? "online" : "offline") as "online" | "offline",
      lastActive: u.isActive ? "Now" : "Unknown",
      department: "Team",
    })),
    // Show demo members when not connected to give a populated UI
    ...(!isConnected ? DEMO_TEAM : []),
  ];

  const [comments, setComments] = useState<Comment[]>([
    {
      id: "1",
      userId: "4",
      userName: "Neha Patel",
      avatar: "👩‍🔬",
      content:
        "Please verify the shear reinforcement spacing in Beam B-201. Current 150mm c/c may not satisfy IS 13920 requirements for ductile detailing.",
      timestamp: "1 hour ago",
      location: { element: "Beam B-201", coordinates: "Grid A-B, Level 2" },
      status: "open",
      replies: [
        {
          id: "1a",
          userId: "3",
          userName: "Amit Kumar",
          avatar: "👨‍💻",
          content:
            "You're right. I'll update to 100mm c/c in the critical zone.",
          timestamp: "45 mins ago",
          status: "open",
          replies: [],
        },
      ],
    },
    {
      id: "2",
      userId: "2",
      userName: "Priya Sharma",
      avatar: "👩‍💻",
      content:
        "Modal analysis shows torsional irregularity. Recommend adding shear walls at Grid C to balance the stiffness.",
      timestamp: "3 hours ago",
      location: { element: "Building Model", coordinates: "Global" },
      status: "pending",
      replies: [],
    },
    {
      id: "3",
      userId: "5",
      userName: "Rahul Singh",
      avatar: "👨‍🔧",
      content:
        "SBC from soil report is 180 kN/m². Please update foundation design accordingly.",
      timestamp: "Yesterday",
      location: { element: "Foundation", coordinates: "All footings" },
      status: "resolved",
      replies: [],
    },
  ]);

  const [versions] = useState<ProjectVersion[]>([
    {
      id: "1",
      version: "v2.4.1",
      name: "Current Working",
      author: "Rakshit Tiwari",
      timestamp: "2 hours ago",
      changes: [
        "Updated beam reinforcement",
        "Fixed column splice details",
        "Added shear wall at Grid C",
      ],
      status: "current",
    },
    {
      id: "2",
      version: "v2.4.0",
      name: "Client Review",
      author: "Priya Sharma",
      timestamp: "Yesterday",
      changes: [
        "Completed seismic analysis",
        "Added response spectrum results",
        "Updated drift checks",
      ],
      status: "milestone",
    },
    {
      id: "3",
      version: "v2.3.0",
      name: "Foundation Complete",
      author: "Rahul Singh",
      timestamp: "3 days ago",
      changes: [
        "Finalized all footings",
        "Added pile cap details",
        "Updated BOQ",
      ],
      status: "milestone",
    },
    {
      id: "4",
      version: "v2.2.5",
      name: "Analysis Update",
      author: "Priya Sharma",
      timestamp: "1 week ago",
      changes: ["Fixed load combinations", "Updated material properties"],
      status: "previous",
    },
    {
      id: "5",
      version: "v2.0.0",
      name: "Schematic Design",
      author: "Rakshit Tiwari",
      timestamp: "2 weeks ago",
      changes: ["Initial structural layout", "Preliminary member sizing"],
      status: "milestone",
    },
  ]);

  const [sharedProjects] = useState<SharedProject[]>([
    {
      id: "1",
      name: "Commercial Complex - Phase 1",
      owner: "Rakshit Tiwari",
      lastModified: "2 hours ago",
      members: 6,
      status: "active",
      progress: 75,
    },
    {
      id: "2",
      name: "Residential Tower B",
      owner: "Priya Sharma",
      lastModified: "Yesterday",
      members: 4,
      status: "review",
      progress: 90,
    },
    {
      id: "3",
      name: "Industrial Warehouse",
      owner: "Amit Kumar",
      lastModified: "3 days ago",
      members: 3,
      status: "completed",
      progress: 100,
    },
    {
      id: "4",
      name: "School Building Retrofit",
      owner: "Neha Patel",
      lastModified: "1 week ago",
      members: 5,
      status: "active",
      progress: 45,
    },
  ]);

  const roleColors: Record<string, string> = {
    admin: "bg-purple-600",
    engineer: "bg-blue-600",
    reviewer: "bg-green-600",
    viewer: "bg-slate-600",
  };

  const statusColors: Record<string, string> = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    offline: "bg-slate-500",
  };

  const projectStatusColors: Record<string, string> = {
    active: "text-green-400 bg-green-900/30",
    review: "text-yellow-400 bg-yellow-900/30",
    completed: "text-blue-400 bg-blue-900/30",
    archived: "text-slate-600 dark:text-slate-400 bg-slate-700",
  };

  // ============================================
  // HANDLER FUNCTIONS
  // ============================================

  const handleInviteMember = useCallback(() => {
    if (!inviteEmail.trim()) return;
    // In production this would send an email invite via the API.
    // For now, log the activity and notify the user.
    addActivity(myName || "You", "invited", inviteEmail + " as " + inviteRole);
    setInviteEmail("");
  }, [inviteEmail, inviteRole, myName, addActivity]);

  const handlePostComment = useCallback(() => {
    if (!newCommentText.trim()) return;
    const newComment: Comment = {
      id: String(Date.now()),
      userId: myId || "self",
      userName: myName || "You",
      avatar: "👤",
      content: newCommentText.trim(),
      timestamp: new Date().toLocaleTimeString(),
      status: "open",
      replies: [],
    };
    setComments((prev) => [newComment, ...prev]);
    addActivity(
      myName || "You",
      "commented",
      newCommentText.trim().slice(0, 50),
    );
    setNewCommentText("");
  }, [newCommentText, myId, myName, addActivity]);

  const handleResolveComment = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, status: "resolved" as const } : c,
      ),
    );
  }, []);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => {
        // Fallback for non-HTTPS
        const textArea = document.createElement("textarea");
        textArea.value = shareLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      });
  }, [shareLink]);

  const handleToggleAccess = useCallback((key: string) => {
    setAccessSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const filteredComments =
    commentFilter === "all"
      ? comments
      : comments.filter((c) => c.status === commentFilter);

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Team Online",
            value: teamMembers.filter((m) => m.status === "online").length,
            total: teamMembers.length,
            icon: "👥",
            color: "from-green-600 to-emerald-600",
          },
          {
            label: "Open Comments",
            value: comments.filter((c) => c.status === "open").length,
            total: comments.length,
            icon: "💬",
            color: "from-yellow-600 to-orange-600",
          },
          {
            label: "Active Projects",
            value: sharedProjects.filter((p) => p.status === "active").length,
            total: sharedProjects.length,
            icon: "📊",
            color: "from-blue-600 to-cyan-600",
          },
          {
            label: "This Week",
            value: "23",
            total: "activities",
            icon: "📈",
            color: "from-purple-600 to-pink-600",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg bg-gradient-to-r ${stat.color}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-900/80 dark:text-white/80 text-sm">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stat.value}
                  <span className="text-lg text-slate-900/60 dark:text-white/60">
                    /{stat.total}
                  </span>
                </p>
              </div>
              <span className="text-3xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">📜</span>
            Recent Activity
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 bg-slate-700/50 rounded-lg"
              >
                <span className="text-2xl">
                  {teamMembers.find((m) => m.id === activity.userId)?.avatar ||
                    "👤"}
                </span>
                <div className="flex-1">
                  <p className="text-slate-700 dark:text-slate-300">
                    <span className="text-slate-900 dark:text-white font-medium">
                      {activity.userName}
                    </span>{" "}
                    {activity.action}{" "}
                    <span className="text-cyan-400">{activity.target}</span>
                  </p>
                  {activity.details && (
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                      "{activity.details}"
                    </p>
                  )}
                  <p className="text-slate-500 text-xs mt-1">
                    {activity.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Status */}
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">👥</span>
            Team Status
          </h3>
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <div className="relative">
                  <span className="text-2xl">{member.avatar}</span>
                  <span
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-200 dark:border-slate-800 ${statusColors[member.status]}`}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-slate-900 dark:text-white text-sm font-medium">
                    {member.name}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">
                    {member.department}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs ${roleColors[member.role]} text-slate-900 dark:text-white`}
                >
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shared Projects */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📁</span>
          Shared Projects
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sharedProjects.map((project) => (
            <div
              key={project.id}
              className="p-4 bg-slate-700 rounded-lg hover:bg-slate-600/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-slate-900 dark:text-white font-medium">
                  {project.name}
                </h4>
                <span
                  className={`px-2 py-1 rounded text-xs capitalize ${projectStatusColors[project.status]}`}
                >
                  {project.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 mb-3">
                <span>👤 {project.owner}</span>
                <span>👥 {project.members} members</span>
              </div>
              <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-600 dark:text-slate-400">
                <span>{project.progress}% complete</span>
                <span>{project.lastModified}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-6">
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">👥</span>
            Team Members
          </h3>
          <button type="button"
            onClick={handleInviteMember}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors flex items-center gap-2"
          >
            <span>➕</span>
            Invite Member
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="p-4 bg-slate-700 rounded-lg border border-slate-600 hover:border-cyan-500 transition-all"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center text-3xl">
                    {member.avatar}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-700 ${statusColors[member.status]}`}
                  />
                </div>
                <div>
                  <h4 className="text-slate-900 dark:text-white font-medium">
                    {member.name}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    {member.department}
                  </p>
                  <span
                    className={`inline-block mt-1 px-2 py-1 rounded text-xs ${roleColors[member.role]} text-slate-900 dark:text-white capitalize`}
                  >
                    {member.role}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Last active: {member.lastActive}
                </span>
                <div className="flex gap-2">
                  <button type="button" className="p-2 text-blue-400 hover:bg-blue-900/30 rounded">
                    💬
                  </button>
                  <button type="button" className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-600 rounded">
                    ⚙️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Permissions */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          Role Permissions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-300 dark:border-slate-700">
                <th className="text-left p-3 text-slate-600 dark:text-slate-400">
                  Permission
                </th>
                <th className="text-center p-3 text-purple-400">Admin</th>
                <th className="text-center p-3 text-blue-400">Engineer</th>
                <th className="text-center p-3 text-green-400">Reviewer</th>
                <th className="text-center p-3 text-slate-600 dark:text-slate-400">
                  Viewer
                </th>
              </tr>
            </thead>
            <tbody className="text-center">
              {[
                {
                  name: "View Model",
                  admin: true,
                  engineer: true,
                  reviewer: true,
                  viewer: true,
                },
                {
                  name: "Edit Model",
                  admin: true,
                  engineer: true,
                  reviewer: false,
                  viewer: false,
                },
                {
                  name: "Run Analysis",
                  admin: true,
                  engineer: true,
                  reviewer: false,
                  viewer: false,
                },
                {
                  name: "Add Comments",
                  admin: true,
                  engineer: true,
                  reviewer: true,
                  viewer: false,
                },
                {
                  name: "Approve Designs",
                  admin: true,
                  engineer: false,
                  reviewer: true,
                  viewer: false,
                },
                {
                  name: "Export Results",
                  admin: true,
                  engineer: true,
                  reviewer: true,
                  viewer: false,
                },
                {
                  name: "Manage Team",
                  admin: true,
                  engineer: false,
                  reviewer: false,
                  viewer: false,
                },
                {
                  name: "Delete Project",
                  admin: true,
                  engineer: false,
                  reviewer: false,
                  viewer: false,
                },
              ].map((perm, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-300 dark:border-slate-700/50"
                >
                  <td className="text-left p-3 text-slate-700 dark:text-slate-300">
                    {perm.name}
                  </td>
                  <td className="p-3">{perm.admin ? "✅" : "❌"}</td>
                  <td className="p-3">{perm.engineer ? "✅" : "❌"}</td>
                  <td className="p-3">{perm.reviewer ? "✅" : "❌"}</td>
                  <td className="p-3">{perm.viewer ? "✅" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderComments = () => (
    <div className="space-y-6">
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">💬</span>
            Design Comments & Issues
          </h3>
          <div className="flex gap-2">
            {(["all", "open", "pending", "resolved"] as const).map((filter) => (
              <button type="button"
                key={filter}
                onClick={() => setCommentFilter(filter)}
                className={`px-3 py-1 rounded-lg text-sm capitalize transition-colors ${
                  commentFilter === filter
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-600"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredComments.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 rounded-lg border-l-4 ${
                comment.status === "open"
                  ? "border-yellow-500 bg-yellow-900/10"
                  : comment.status === "pending"
                    ? "border-blue-500 bg-blue-900/10"
                    : "border-green-500 bg-green-900/10"
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl">{comment.avatar}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-slate-900 dark:text-white font-medium">
                        {comment.userName}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 text-sm ml-2">
                        • {comment.timestamp}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs capitalize ${
                        comment.status === "open"
                          ? "bg-yellow-600 text-white"
                          : comment.status === "pending"
                            ? "bg-blue-600 text-white"
                            : "bg-green-600 text-white"
                      }`}
                    >
                      {comment.status}
                    </span>
                  </div>

                  {comment.location && (
                    <div className="flex items-center gap-2 mb-2 text-sm text-cyan-400">
                      <span>📍</span>
                      <span>{comment.location.element}</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {comment.location.coordinates}
                      </span>
                    </div>
                  )}

                  <p className="text-slate-700 dark:text-slate-300">
                    {comment.content}
                  </p>

                  {/* Replies */}
                  {comment.replies.length > 0 && (
                    <div className="mt-4 pl-4 border-l-2 border-slate-600 space-y-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-3">
                          <span className="text-xl">{reply.avatar}</span>
                          <div>
                            <span className="text-slate-900 dark:text-white text-sm font-medium">
                              {reply.userName}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 text-xs ml-2">
                              {reply.timestamp}
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                              {reply.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button type="button" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                      ↩️ Reply
                    </button>
                    <button type="button"
                      onClick={() => handleResolveComment(comment.id)}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      ✅ Resolve
                    </button>
                    <button type="button" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                      📍 Show in Model
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Comment */}
        <div className="mt-6 p-4 bg-slate-700 rounded-lg">
          <textarea
            placeholder="Add a comment or flag an issue..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 resize-none"
            rows={3}
          />
          <div className="flex justify-between items-center mt-3">
            <div className="flex gap-2">
              <button type="button" className="px-3 py-1 bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-sm hover:bg-slate-500">
                📍 Pin to Element
              </button>
              <button type="button" className="px-3 py-1 bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-sm hover:bg-slate-500">
                📎 Attach File
              </button>
            </div>
            <button type="button"
              onClick={handlePostComment}
              disabled={!newCommentText.trim()}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Post Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVersions = () => (
    <div className="space-y-6">
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📚</span>
            Version History
          </h3>
          <button type="button" className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors flex items-center gap-2">
            <span>📌</span>
            Create Milestone
          </button>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-600" />

          <div className="space-y-6">
            {versions.map((version, _idx) => (
              <div key={version.id} className="relative flex gap-6">
                {/* Timeline dot */}
                <div
                  className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center text-slate-900 dark:text-white font-bold ${
                    version.status === "current"
                      ? "bg-green-600"
                      : version.status === "milestone"
                        ? "bg-cyan-600"
                        : "bg-slate-600"
                  }`}
                >
                  {version.status === "current"
                    ? "🔵"
                    : version.status === "milestone"
                      ? "⭐"
                      : "○"}
                </div>

                <div
                  className={`flex-1 p-4 rounded-lg border ${
                    version.status === "current"
                      ? "bg-green-900/20 border-green-600"
                      : version.status === "milestone"
                        ? "bg-cyan-900/20 border-cyan-600"
                        : "bg-slate-700 border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-900 dark:text-white font-bold text-lg">
                        {version.version}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {version.name}
                      </span>
                      {version.status === "current" && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                          Current
                        </span>
                      )}
                      {version.status === "milestone" && (
                        <span className="px-2 py-1 bg-cyan-600 text-white text-xs rounded">
                          Milestone
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" aria-label="View" className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-600 rounded">
                        👁️
                      </button>
                      <button type="button" aria-label="Restore" className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-600 rounded">
                        ↩️
                      </button>
                      <button type="button" aria-label="Download" className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-600 rounded">
                        📥
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                    By {version.author} • {version.timestamp}
                  </p>

                  <div className="space-y-1">
                    {version.changes.map((change, cIdx) => (
                      <div
                        key={cIdx}
                        className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <span className="text-green-400">+</span>
                        {change}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compare Versions */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🔍</span>
          Compare Versions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
              From Version
            </label>
            <select className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white">
              {versions.map((v) => (
                <option key={v.id} value={v.version}>
                  {v.version} - {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
              To Version
            </label>
            <select className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white">
              {versions.map((v) => (
                <option key={v.id} value={v.version}>
                  {v.version} - {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-center mt-4">
          <button type="button" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors flex items-center gap-2">
            <span>🔍</span>
            Compare Changes
          </button>
        </div>
      </div>
    </div>
  );

  const renderSharing = () => (
    <div className="space-y-6">
      {/* Sharing Settings */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🔗</span>
          Share Project
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-700 dark:text-slate-300"
              />
              <button type="button"
                onClick={handleCopyLink}
                className={`px-4 py-2 rounded-lg transition-colors ${linkCopied ? "bg-green-600 text-white" : "bg-cyan-600 text-white hover:bg-cyan-500"}`}
              >
                {linkCopied ? "✅ Copied!" : "📋 Copy"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
              Invite by Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(
                    e.target.value as "viewer" | "engineer" | "reviewer",
                  )
                }
                className="p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="viewer">Viewer</option>
                <option value="engineer">Engineer</option>
                <option value="reviewer">Reviewer</option>
              </select>
              <button type="button"
                onClick={handleInviteMember}
                disabled={!inviteEmail.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                ➕ Invite
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Access Settings */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          Access Settings
        </h3>

        <div className="space-y-4">
          {[
            {
              key: "publicLink",
              name: "Public Link Access",
              desc: "Anyone with the link can view",
            },
            {
              key: "allowComments",
              name: "Allow Comments",
              desc: "Viewers can add comments",
            },
            {
              key: "downloadPermission",
              name: "Download Permission",
              desc: "Allow exporting results",
            },
            {
              key: "watermarkExports",
              name: "Watermark Exports",
              desc: "Add company watermark to exports",
            },
            {
              key: "expiration",
              name: "Expiration",
              desc: "Link expires after 30 days",
            },
          ].map((setting, idx) => (
            <label
              key={idx}
              onClick={() => handleToggleAccess(setting.key)}
              className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors"
            >
              <div>
                <p className="text-slate-900 dark:text-white font-medium">
                  {setting.name}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {setting.desc}
                </p>
              </div>
              <div
                className={`relative w-12 h-6 rounded-full transition-colors ${accessSettings[setting.key] ? "bg-green-600" : "bg-slate-500"}`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${accessSettings[setting.key] ? "right-1" : "left-1"}`}
                />
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* External Integration */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🔌</span>
          External Integrations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "BIM 360",
              icon: "🔷",
              status: "connected",
              desc: "Autodesk collaboration",
            },
            {
              name: "Procore",
              icon: "📊",
              status: "available",
              desc: "Project management",
            },
            {
              name: "Bluebeam",
              icon: "📘",
              status: "available",
              desc: "PDF collaboration",
            },
            {
              name: "Microsoft Teams",
              icon: "💬",
              status: "connected",
              desc: "Team communication",
            },
            {
              name: "Google Drive",
              icon: "📁",
              status: "available",
              desc: "File storage",
            },
            {
              name: "Slack",
              icon: "💭",
              status: "available",
              desc: "Notifications",
            },
          ].map((int, idx) => (
            <div
              key={idx}
              className="p-4 bg-slate-700 rounded-lg border border-slate-600"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{int.icon}</span>
                <div>
                  <p className="text-slate-900 dark:text-white font-medium">
                    {int.name}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">
                    {int.desc}
                  </p>
                </div>
              </div>
              <button type="button"
                className={`w-full py-2 rounded text-sm ${
                  int.status === "connected"
                    ? "bg-green-600 text-white"
                    : "bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-500"
                }`}
              >
                {int.status === "connected" ? "✓ Connected" : "Connect"}
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
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
            👥 Collaboration Hub
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Real-Time Team Collaboration • Version Control • Comments & Issues •
            Project Sharing
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-pulse"}`}
            />
            <span className="text-sm text-slate-500">
              {isConnected
                ? `Connected — ${teamMembers.length} user${teamMembers.length !== 1 ? "s" : ""} • v${projectVersion}`
                : `Demo Mode — ${teamMembers.length} sample users • Connect a server for real-time collaboration`}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { id: "dashboard", label: "Dashboard", icon: "📊" },
            { id: "team", label: "Team", icon: "👥" },
            { id: "comments", label: "Comments", icon: "💬" },
            { id: "versions", label: "Versions", icon: "📚" },
            { id: "sharing", label: "Sharing", icon: "🔗" },
          ].map((tab) => (
            <button type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-600"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "dashboard" && renderDashboard()}
        {activeTab === "team" && renderTeam()}
        {activeTab === "comments" && renderComments()}
        {activeTab === "versions" && renderVersions()}
        {activeTab === "sharing" && renderSharing()}
      </motion.div>
    </div>
  );
};

export default CollaborationHub;
