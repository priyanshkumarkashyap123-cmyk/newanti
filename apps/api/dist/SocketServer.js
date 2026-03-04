import { Server as SocketIOServer } from "socket.io";
import { verifySocketToken } from "./middleware/authMiddleware.js";
import { getAllowedOrigins } from "./config/cors.js";
const USER_COLORS = [
  "#3B82F6",
  // Blue
  "#10B981",
  // Green
  "#F59E0B",
  // Orange
  "#EF4444",
  // Red
  "#8B5CF6",
  // Purple
  "#EC4899",
  // Pink
  "#06B6D4",
  // Cyan
  "#F97316"
  // Orange-red
];
class SocketServer {
  io;
  users = /* @__PURE__ */ new Map();
  projects = /* @__PURE__ */ new Map();
  colorIndex = 0;
  constructor(httpServer) {
    const allOrigins = getAllowedOrigins();
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: allOrigins,
        methods: ["GET", "POST"],
        credentials: true
      },
      pingInterval: 1e4,
      pingTimeout: 5e3
    });
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) {
          return next(new Error("Authentication required: provide auth.token in handshake"));
        }
        const payload = await verifySocketToken(token);
        if (!payload) {
          return next(new Error("Invalid or expired authentication token"));
        }
        socket.userId = payload.userId ?? payload.sub ?? payload.id;
        next();
      } catch (err) {
        console.error("Socket auth failed:", err);
        next(new Error("Authentication failed"));
      }
    });
    this.setupEventHandlers();
    console.log("\u{1F50C} Socket.IO server initialized (with auth middleware)");
  }
  /**
   * Setup socket event handlers
   */
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`\u{1F464} User connected: ${socket.id}`);
      const user = {
        id: socket.id,
        socketId: socket.id,
        name: `User ${this.users.size + 1}`,
        color: this.getNextColor(),
        projectId: null,
        lastActivity: /* @__PURE__ */ new Date()
      };
      this.users.set(socket.id, user);
      socket.emit("user_connected", {
        userId: user.id,
        name: user.name,
        color: user.color
      });
      socket.on("join_project", (data) => {
        this.handleJoinProject(socket, data);
      });
      socket.on("leave_project", () => {
        this.handleLeaveProject(socket);
      });
      socket.on("update_node", (data) => {
        this.handleNodeUpdate(socket, data);
      });
      socket.on("delete_node", (data) => {
        this.handleDeleteNode(socket, data);
      });
      socket.on("update_member", (data) => {
        this.handleMemberUpdate(socket, data);
      });
      socket.on("delete_member", (data) => {
        this.handleDeleteMember(socket, data);
      });
      socket.on("update_load", (data) => {
        this.handleLoadUpdate(socket, data);
      });
      socket.on("delete_load", (data) => {
        this.handleDeleteLoad(socket, data);
      });
      socket.on("cursor_move", (data) => {
        this.handleCursorMove(socket, data);
      });
      socket.on("analysis_started", (data) => {
        const user2 = this.users.get(socket.id);
        if (user2?.projectId) {
          socket.to(user2.projectId).emit("analysis_started", {
            userId: data.userId,
            userName: user2.name
          });
        }
      });
      socket.on("analysis_complete", (data) => {
        const user2 = this.users.get(socket.id);
        if (user2?.projectId) {
          socket.to(user2.projectId).emit("analysis_complete", {
            results: data.results,
            userId: data.userId,
            userName: user2.name
          });
        }
      });
      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }
  /**
   * Handle user joining a project room
   */
  handleJoinProject(socket, data) {
    const user = this.users.get(socket.id);
    if (!user) return;
    if (user.projectId) {
      socket.leave(user.projectId);
      this.broadcastUserLeft(socket, user.projectId, user);
    }
    user.projectId = data.projectId;
    if (data.userName) {
      user.name = data.userName;
    }
    user.lastActivity = /* @__PURE__ */ new Date();
    socket.join(data.projectId);
    if (!this.projects.has(data.projectId)) {
      this.projects.set(data.projectId, {
        projectId: data.projectId,
        users: /* @__PURE__ */ new Map(),
        lastModified: /* @__PURE__ */ new Date(),
        version: 0
      });
    }
    const project = this.projects.get(data.projectId);
    project.users.set(user.id, user);
    const usersInProject = Array.from(project.users.values()).map((u) => ({
      id: u.id,
      name: u.name,
      color: u.color,
      cursor: u.cursor
    }));
    socket.emit("project_joined", {
      projectId: data.projectId,
      userId: user.id,
      users: usersInProject,
      version: project.version
    });
    socket.to(data.projectId).emit("user_joined", {
      userId: user.id,
      name: user.name,
      color: user.color
    });
    console.log(`\u{1F4C2} ${user.name} joined project: ${data.projectId}`);
  }
  /**
   * Handle user leaving a project
   */
  handleLeaveProject(socket) {
    const user = this.users.get(socket.id);
    if (!user || !user.projectId) return;
    const projectId = user.projectId;
    socket.leave(projectId);
    const project = this.projects.get(projectId);
    if (project) {
      project.users.delete(user.id);
    }
    this.broadcastUserLeft(socket, projectId, user);
    user.projectId = null;
  }
  /**
   * Broadcast that a user left
   */
  broadcastUserLeft(socket, projectId, user) {
    socket.to(projectId).emit("user_left", {
      userId: user.id,
      name: user.name
    });
  }
  /**
   * Handle node update (Last-Write-Wins)
   */
  handleNodeUpdate(socket, data) {
    const user = this.users.get(socket.id);
    if (!user?.projectId) return;
    const project = this.projects.get(user.projectId);
    if (project) {
      project.version++;
      project.lastModified = /* @__PURE__ */ new Date();
    }
    socket.to(user.projectId).emit("server_update", {
      type: "node_update",
      data: {
        ...data,
        userId: user.id,
        userName: user.name
      },
      version: project?.version
    });
    console.log(`\u{1F4CD} Node ${data.nodeId} updated by ${user.name}`);
  }
  /**
   * Handle node deletion
   */
  handleDeleteNode(socket, data) {
    const user = this.users.get(socket.id);
    if (!user?.projectId) return;
    socket.to(user.projectId).emit("server_update", {
      type: "node_delete",
      data: {
        nodeId: data.nodeId,
        userId: user.id,
        userName: user.name
      }
    });
  }
  /**
   * Handle member update (Last-Write-Wins)
   */
  handleMemberUpdate(socket, data) {
    const user = this.users.get(socket.id);
    if (!user?.projectId) return;
    const project = this.projects.get(user.projectId);
    if (project) {
      project.version++;
      project.lastModified = /* @__PURE__ */ new Date();
    }
    socket.to(user.projectId).emit("server_update", {
      type: "member_update",
      data: {
        ...data,
        userId: user.id,
        userName: user.name
      },
      version: project?.version
    });
    console.log(`\u{1F517} Member ${data.memberId} updated by ${user.name}`);
  }
  /**
   * Handle member deletion
   */
  handleDeleteMember(socket, data) {
    const user = this.users.get(socket.id);
    if (!user?.projectId) return;
    socket.to(user.projectId).emit("server_update", {
      type: "member_delete",
      data: {
        memberId: data.memberId,
        userId: user.id,
        userName: user.name
      }
    });
  }
  /**
   * Handle load update
   */
  handleLoadUpdate(socket, data) {
    const user = this.users.get(socket.id);
    if (!user?.projectId) return;
    socket.to(user.projectId).emit("server_update", {
      type: "load_update",
      data: {
        ...data,
        userId: user.id,
        userName: user.name
      }
    });
  }
  /**
   * Handle load deletion
   */
  handleDeleteLoad(socket, data) {
    const user = this.users.get(socket.id);
    if (!user?.projectId) return;
    socket.to(user.projectId).emit("server_update", {
      type: "load_delete",
      data: {
        loadId: data.loadId,
        userId: user.id,
        userName: user.name
      }
    });
  }
  /**
   * Handle cursor movement
   */
  handleCursorMove(socket, data) {
    const user = this.users.get(socket.id);
    if (!user?.projectId) return;
    user.cursor = data;
    user.lastActivity = /* @__PURE__ */ new Date();
    socket.to(user.projectId).emit("cursor_update", {
      userId: user.id,
      name: user.name,
      color: user.color,
      cursor: data
    });
  }
  /**
   * Handle user disconnect
   */
  handleDisconnect(socket) {
    const user = this.users.get(socket.id);
    if (user) {
      if (user.projectId) {
        const project = this.projects.get(user.projectId);
        if (project) {
          project.users.delete(user.id);
        }
        this.broadcastUserLeft(socket, user.projectId, user);
      }
      this.users.delete(socket.id);
      console.log(`\u{1F44B} User disconnected: ${user.name}`);
    }
  }
  /**
   * Get next user color (cycles through palette)
   */
  getNextColor() {
    const color = USER_COLORS[this.colorIndex % USER_COLORS.length] ?? "#3B82F6";
    this.colorIndex++;
    return color;
  }
  /**
   * Get all users in a project
   */
  getProjectUsers(projectId) {
    const project = this.projects.get(projectId);
    if (!project) return [];
    return Array.from(project.users.values());
  }
  /**
   * Get socket.io server instance
   */
  getIO() {
    return this.io;
  }
  /**
   * Gracefully close all socket connections and the server itself.
   * Used during shutdown to ensure clients receive disconnect events.
   */
  close() {
    this.io.disconnectSockets(true);
    this.io.close();
  }
}
var SocketServer_default = SocketServer;
export {
  SocketServer,
  SocketServer_default as default
};
//# sourceMappingURL=SocketServer.js.map
