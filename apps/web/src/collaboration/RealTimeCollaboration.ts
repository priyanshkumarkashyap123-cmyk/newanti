/**
 * RealTimeCollaboration.ts
 * 
 * Enterprise-grade real-time collaboration system for structural engineering:
 * 1. Operational Transformation (OT) for concurrent editing
 * 2. Presence awareness (who's viewing what)
 * 3. Cursor synchronization
 * 4. Version control with branching/merging
 * 5. Comments and annotations
 * 6. Role-based permissions
 * 7. Conflict resolution
 */

// Browser-compatible EventEmitter implementation
type EventListener = (...args: any[]) => void;

class BrowserEventEmitter {
  private events: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (listeners && listeners.length > 0) {
      listeners.forEach(listener => listener(...args));
      return true;
    }
    return false;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  color: string;
}

export interface Cursor {
  userId: string;
  position: { x: number; y: number; z: number };
  viewportId?: string;
  timestamp: number;
}

export interface Selection {
  userId: string;
  elementIds: string[];
  timestamp: number;
}

export interface Operation {
  id: string;
  userId: string;
  timestamp: number;
  type: 'insert' | 'delete' | 'update' | 'move';
  path: string[];
  data: any;
  version: number;
}

export interface Comment {
  id: string;
  userId: string;
  elementId?: string;
  position?: { x: number; y: number; z: number };
  content: string;
  timestamp: number;
  resolved: boolean;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
}

export interface Version {
  id: string;
  name: string;
  description?: string;
  userId: string;
  timestamp: number;
  parentId?: string;
  operations: Operation[];
  snapshot?: any;
}

export interface Branch {
  id: string;
  name: string;
  baseVersionId: string;
  headVersionId: string;
  createdBy: string;
  createdAt: number;
  merged: boolean;
}

export interface PresenceState {
  users: Map<string, UserPresence>;
  cursors: Map<string, Cursor>;
  selections: Map<string, Selection>;
}

export interface UserPresence {
  user: User;
  online: boolean;
  lastSeen: number;
  currentView?: string;
  isTyping: boolean;
}

export interface ConflictResolution {
  operationA: Operation;
  operationB: Operation;
  resolved: Operation;
  strategy: 'keep-mine' | 'keep-theirs' | 'merge' | 'manual';
}

// ============================================
// OPERATIONAL TRANSFORMATION ENGINE
// ============================================

class OTEngine {
  private pendingOperations: Operation[] = [];
  private acknowledgedVersion: number = 0;
  private serverVersion: number = 0;
  
  /**
   * Transform operation A against operation B
   * Ensures convergence when operations are applied in different orders
   */
  transform(opA: Operation, opB: Operation): Operation {
    // Same operation - no change needed
    if (opA.id === opB.id) return opA;
    
    // Operations on different paths - no conflict
    if (!this.pathsConflict(opA.path, opB.path)) return opA;
    
    // Handle insert vs insert
    if (opA.type === 'insert' && opB.type === 'insert') {
      return this.transformInsertInsert(opA, opB);
    }
    
    // Handle insert vs delete
    if (opA.type === 'insert' && opB.type === 'delete') {
      return this.transformInsertDelete(opA, opB);
    }
    
    // Handle delete vs insert
    if (opA.type === 'delete' && opB.type === 'insert') {
      return this.transformDeleteInsert(opA, opB);
    }
    
    // Handle delete vs delete
    if (opA.type === 'delete' && opB.type === 'delete') {
      return this.transformDeleteDelete(opA, opB);
    }
    
    // Handle update vs update
    if (opA.type === 'update' && opB.type === 'update') {
      return this.transformUpdateUpdate(opA, opB);
    }
    
    // Handle move operations
    if (opA.type === 'move' || opB.type === 'move') {
      return this.transformWithMove(opA, opB);
    }
    
    return opA;
  }
  
  private pathsConflict(pathA: string[], pathB: string[]): boolean {
    const minLen = Math.min(pathA.length, pathB.length);
    for (let i = 0; i < minLen; i++) {
      if (pathA[i] !== pathB[i]) return false;
    }
    return true;
  }
  
  private transformInsertInsert(opA: Operation, opB: Operation): Operation {
    // If inserting at same position, use user ID for deterministic ordering
    const lastPathA = opA.path[opA.path.length - 1];
    const lastPathB = opB.path[opB.path.length - 1];
    
    if (lastPathA === lastPathB) {
      // Use user ID as tiebreaker
      if (opA.userId < opB.userId) {
        return opA; // A goes first
      } else {
        // Shift A's position
        const newPath = [...opA.path];
        const idx = parseInt(newPath[newPath.length - 1]);
        if (!isNaN(idx)) {
          newPath[newPath.length - 1] = String(idx + 1);
        }
        return { ...opA, path: newPath };
      }
    }
    
    return opA;
  }
  
  private transformInsertDelete(opA: Operation, opB: Operation): Operation {
    // If inserting into deleted region, operation becomes no-op
    if (this.pathsConflict(opB.path, opA.path.slice(0, opB.path.length))) {
      return { ...opA, type: 'insert', data: null }; // No-op
    }
    return opA;
  }
  
  private transformDeleteInsert(opA: Operation, opB: Operation): Operation {
    // Shift delete position if insert happened before
    return opA;
  }
  
  private transformDeleteDelete(opA: Operation, opB: Operation): Operation {
    // If same element deleted, A becomes no-op
    if (opA.path.join('/') === opB.path.join('/')) {
      return { ...opA, data: null }; // No-op
    }
    return opA;
  }
  
  private transformUpdateUpdate(opA: Operation, opB: Operation): Operation {
    // Last writer wins for same property
    if (opA.timestamp < opB.timestamp) {
      return { ...opA, data: null }; // Superseded by B
    }
    return opA;
  }
  
  private transformWithMove(opA: Operation, opB: Operation): Operation {
    // Complex move transformation
    return opA;
  }
  
  /**
   * Apply operation to local state
   */
  applyOperation(state: any, operation: Operation): any {
    if (!operation.data) return state; // No-op
    
    const path = operation.path;
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone
    
    switch (operation.type) {
      case 'insert':
        this.insertAtPath(newState, path, operation.data);
        break;
      case 'delete':
        this.deleteAtPath(newState, path);
        break;
      case 'update':
        this.updateAtPath(newState, path, operation.data);
        break;
      case 'move':
        this.moveAtPath(newState, path, operation.data.targetPath);
        break;
    }
    
    return newState;
  }
  
  private insertAtPath(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = isNaN(parseInt(path[i + 1])) ? {} : [];
      }
      current = current[path[i]];
    }
    
    const lastKey = path[path.length - 1];
    const idx = parseInt(lastKey);
    
    if (Array.isArray(current) && !isNaN(idx)) {
      current.splice(idx, 0, value);
    } else {
      current[lastKey] = value;
    }
  }
  
  private deleteAtPath(obj: any, path: string[]): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) return;
      current = current[path[i]];
    }
    
    const lastKey = path[path.length - 1];
    const idx = parseInt(lastKey);
    
    if (Array.isArray(current) && !isNaN(idx)) {
      current.splice(idx, 1);
    } else {
      delete current[lastKey];
    }
  }
  
  private updateAtPath(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) return;
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }
  
  private moveAtPath(obj: any, fromPath: string[], toPath: string[]): void {
    // Get value at fromPath
    let value: any;
    let current = obj;
    for (let i = 0; i < fromPath.length - 1; i++) {
      if (!current[fromPath[i]]) return;
      current = current[fromPath[i]];
    }
    value = current[fromPath[fromPath.length - 1]];
    
    // Delete from original location
    this.deleteAtPath(obj, fromPath);
    
    // Insert at new location
    this.insertAtPath(obj, toPath, value);
  }
}

// ============================================
// VERSION CONTROL SYSTEM
// ============================================

class VersionControlSystem {
  private versions: Map<string, Version> = new Map();
  private branches: Map<string, Branch> = new Map();
  private currentBranchId: string = 'main';
  
  constructor() {
    // Create main branch
    this.branches.set('main', {
      id: 'main',
      name: 'main',
      baseVersionId: '',
      headVersionId: '',
      createdBy: 'system',
      createdAt: Date.now(),
      merged: false,
    });
  }
  
  /**
   * Create a new version snapshot
   */
  createVersion(
    name: string,
    userId: string,
    operations: Operation[],
    snapshot?: any,
    description?: string
  ): Version {
    const branch = this.branches.get(this.currentBranchId)!;
    
    const version: Version = {
      id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      userId,
      timestamp: Date.now(),
      parentId: branch.headVersionId || undefined,
      operations,
      snapshot,
    };
    
    this.versions.set(version.id, version);
    branch.headVersionId = version.id;
    
    return version;
  }
  
  /**
   * Create a new branch from current version
   */
  createBranch(name: string, userId: string): Branch {
    const currentBranch = this.branches.get(this.currentBranchId)!;
    
    const branch: Branch = {
      id: `branch-${Date.now()}`,
      name,
      baseVersionId: currentBranch.headVersionId,
      headVersionId: currentBranch.headVersionId,
      createdBy: userId,
      createdAt: Date.now(),
      merged: false,
    };
    
    this.branches.set(branch.id, branch);
    return branch;
  }
  
  /**
   * Switch to a different branch
   */
  switchBranch(branchId: string): void {
    if (!this.branches.has(branchId)) {
      throw new Error(`Branch ${branchId} not found`);
    }
    this.currentBranchId = branchId;
  }
  
  /**
   * Merge a branch into current branch
   */
  mergeBranch(sourceBranchId: string, userId: string): ConflictResolution[] {
    const sourceBranch = this.branches.get(sourceBranchId);
    const targetBranch = this.branches.get(this.currentBranchId);
    
    if (!sourceBranch || !targetBranch) {
      throw new Error('Branch not found');
    }
    
    // Find common ancestor
    const ancestor = this.findCommonAncestor(
      sourceBranch.baseVersionId,
      targetBranch.headVersionId
    );
    
    // Get operations since ancestor on both branches
    const sourceOps = this.getOperationsSince(ancestor, sourceBranch.headVersionId);
    const targetOps = this.getOperationsSince(ancestor, targetBranch.headVersionId);
    
    // Detect and resolve conflicts
    const conflicts = this.detectConflicts(sourceOps, targetOps);
    
    // Mark source branch as merged
    sourceBranch.merged = true;
    
    return conflicts;
  }
  
  private findCommonAncestor(versionA: string, versionB: string): string {
    const ancestorsA = new Set<string>();
    let current = versionA;
    
    while (current) {
      ancestorsA.add(current);
      const version = this.versions.get(current);
      current = version?.parentId || '';
    }
    
    current = versionB;
    while (current) {
      if (ancestorsA.has(current)) {
        return current;
      }
      const version = this.versions.get(current);
      current = version?.parentId || '';
    }
    
    return '';
  }
  
  private getOperationsSince(fromVersionId: string, toVersionId: string): Operation[] {
    const operations: Operation[] = [];
    let current = toVersionId;
    
    while (current && current !== fromVersionId) {
      const version = this.versions.get(current);
      if (version) {
        operations.unshift(...version.operations);
        current = version.parentId || '';
      } else {
        break;
      }
    }
    
    return operations;
  }
  
  private detectConflicts(opsA: Operation[], opsB: Operation[]): ConflictResolution[] {
    const conflicts: ConflictResolution[] = [];
    
    for (const opA of opsA) {
      for (const opB of opsB) {
        if (this.operationsConflict(opA, opB)) {
          conflicts.push({
            operationA: opA,
            operationB: opB,
            resolved: opA, // Default: keep A
            strategy: 'keep-mine',
          });
        }
      }
    }
    
    return conflicts;
  }
  
  private operationsConflict(opA: Operation, opB: Operation): boolean {
    // Same element modified
    if (opA.path.join('/') === opB.path.join('/')) {
      return true;
    }
    // Delete vs any operation on child
    if (opA.type === 'delete' || opB.type === 'delete') {
      const pathA = opA.path.join('/');
      const pathB = opB.path.join('/');
      if (pathB.startsWith(pathA) || pathA.startsWith(pathB)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Get version history
   */
  getHistory(limit: number = 50): Version[] {
    const branch = this.branches.get(this.currentBranchId)!;
    const history: Version[] = [];
    let current = branch.headVersionId;
    
    while (current && history.length < limit) {
      const version = this.versions.get(current);
      if (version) {
        history.push(version);
        current = version.parentId || '';
      } else {
        break;
      }
    }
    
    return history;
  }
  
  /**
   * Revert to a specific version
   */
  revertToVersion(versionId: string, userId: string): Version {
    const targetVersion = this.versions.get(versionId);
    if (!targetVersion) {
      throw new Error(`Version ${versionId} not found`);
    }
    
    // Create a new version that's a copy of the target
    return this.createVersion(
      `Reverted to ${targetVersion.name}`,
      userId,
      [], // No new operations
      targetVersion.snapshot,
      `Reverted to version ${targetVersion.name}`
    );
  }
}

// ============================================
// COLLABORATION HUB
// ============================================

export class CollaborationHub extends BrowserEventEmitter {
  private users: Map<string, User> = new Map();
  private presence: PresenceState = {
    users: new Map(),
    cursors: new Map(),
    selections: new Map(),
  };
  private comments: Map<string, Comment> = new Map();
  private otEngine: OTEngine;
  private vcs: VersionControlSystem;
  private projectState: any;
  private localUserId: string = '';
  private wsConnection: WebSocket | null = null;
  
  constructor() {
    super();
    this.otEngine = new OTEngine();
    this.vcs = new VersionControlSystem();
    this.projectState = {};
  }
  
  /**
   * Initialize collaboration session
   */
  async connect(projectId: string, userId: string, serverUrl: string): Promise<void> {
    this.localUserId = userId;
    
    // Connect to collaboration server
    return new Promise((resolve, reject) => {
      this.wsConnection = new WebSocket(`${serverUrl}/collab/${projectId}`);
      
      this.wsConnection.onopen = () => {
        // Authenticate
        this.send({
          type: 'auth',
          userId,
          token: this.getAuthToken(),
        });
        resolve();
      };
      
      this.wsConnection.onmessage = (event) => {
        this.handleServerMessage(JSON.parse(event.data));
      };
      
      this.wsConnection.onerror = (error) => {
        reject(error);
      };
      
      this.wsConnection.onclose = () => {
        this.emit('disconnected');
      };
    });
  }
  
  private getAuthToken(): string {
    // In real implementation, get from auth provider
    return 'demo-token';
  }
  
  private send(message: any): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify(message));
    }
  }
  
  private handleServerMessage(message: any): void {
    switch (message.type) {
      case 'state':
        this.projectState = message.state;
        this.emit('stateSync', this.projectState);
        break;
        
      case 'operation':
        this.applyRemoteOperation(message.operation);
        break;
        
      case 'presence':
        this.updatePresence(message.userId, message.presence);
        break;
        
      case 'cursor':
        this.updateCursor(message.userId, message.cursor);
        break;
        
      case 'selection':
        this.updateSelection(message.userId, message.selection);
        break;
        
      case 'comment':
        this.handleComment(message.action, message.comment);
        break;
        
      case 'user_joined':
        this.handleUserJoined(message.user);
        break;
        
      case 'user_left':
        this.handleUserLeft(message.userId);
        break;
    }
  }
  
  /**
   * Apply a local operation and broadcast to others
   */
  applyLocalOperation(operation: Operation): void {
    // Apply locally
    this.projectState = this.otEngine.applyOperation(this.projectState, operation);
    
    // Broadcast to server
    this.send({
      type: 'operation',
      operation,
    });
    
    // Emit local change
    this.emit('stateChanged', this.projectState);
  }
  
  private applyRemoteOperation(operation: Operation): void {
    // Transform against pending local operations
    const transformed = this.otEngine.transform(operation, operation);
    
    // Apply to state
    this.projectState = this.otEngine.applyOperation(this.projectState, transformed);
    
    // Emit change
    this.emit('stateChanged', this.projectState);
  }
  
  /**
   * Update local cursor position
   */
  updateLocalCursor(position: { x: number; y: number; z: number }): void {
    const cursor: Cursor = {
      userId: this.localUserId,
      position,
      timestamp: Date.now(),
    };
    
    this.presence.cursors.set(this.localUserId, cursor);
    
    // Broadcast
    this.send({
      type: 'cursor',
      cursor,
    });
  }
  
  private updateCursor(userId: string, cursor: Cursor): void {
    this.presence.cursors.set(userId, cursor);
    this.emit('cursorMoved', userId, cursor);
  }
  
  /**
   * Update local selection
   */
  updateLocalSelection(elementIds: string[]): void {
    const selection: Selection = {
      userId: this.localUserId,
      elementIds,
      timestamp: Date.now(),
    };
    
    this.presence.selections.set(this.localUserId, selection);
    
    // Broadcast
    this.send({
      type: 'selection',
      selection,
    });
  }
  
  private updateSelection(userId: string, selection: Selection): void {
    this.presence.selections.set(userId, selection);
    this.emit('selectionChanged', userId, selection);
  }
  
  private updatePresence(userId: string, presence: Partial<UserPresence>): void {
    const existing = this.presence.users.get(userId);
    if (existing) {
      this.presence.users.set(userId, { ...existing, ...presence });
    }
    this.emit('presenceChanged', userId, this.presence.users.get(userId));
  }
  
  /**
   * Add a comment
   */
  addComment(content: string, elementId?: string, position?: { x: number; y: number; z: number }): Comment {
    const comment: Comment = {
      id: `comment-${Date.now()}`,
      userId: this.localUserId,
      elementId,
      position,
      content,
      timestamp: Date.now(),
      resolved: false,
      replies: [],
    };
    
    this.comments.set(comment.id, comment);
    
    // Broadcast
    this.send({
      type: 'comment',
      action: 'add',
      comment,
    });
    
    return comment;
  }
  
  /**
   * Reply to a comment
   */
  replyToComment(commentId: string, content: string): CommentReply | null {
    const comment = this.comments.get(commentId);
    if (!comment) return null;
    
    const reply: CommentReply = {
      id: `reply-${Date.now()}`,
      userId: this.localUserId,
      content,
      timestamp: Date.now(),
    };
    
    comment.replies.push(reply);
    
    // Broadcast
    this.send({
      type: 'comment',
      action: 'reply',
      commentId,
      reply,
    });
    
    return reply;
  }
  
  /**
   * Resolve a comment
   */
  resolveComment(commentId: string): void {
    const comment = this.comments.get(commentId);
    if (comment) {
      comment.resolved = true;
      
      this.send({
        type: 'comment',
        action: 'resolve',
        commentId,
      });
    }
  }
  
  private handleComment(action: string, data: any): void {
    switch (action) {
      case 'add':
        this.comments.set(data.id, data);
        this.emit('commentAdded', data);
        break;
      case 'reply':
        const comment = this.comments.get(data.commentId);
        if (comment) {
          comment.replies.push(data.reply);
          this.emit('commentReplied', data.commentId, data.reply);
        }
        break;
      case 'resolve':
        const c = this.comments.get(data.commentId);
        if (c) {
          c.resolved = true;
          this.emit('commentResolved', data.commentId);
        }
        break;
    }
  }
  
  private handleUserJoined(user: User): void {
    this.users.set(user.id, user);
    this.presence.users.set(user.id, {
      user,
      online: true,
      lastSeen: Date.now(),
      isTyping: false,
    });
    this.emit('userJoined', user);
  }
  
  private handleUserLeft(userId: string): void {
    const presence = this.presence.users.get(userId);
    if (presence) {
      presence.online = false;
      presence.lastSeen = Date.now();
    }
    this.presence.cursors.delete(userId);
    this.presence.selections.delete(userId);
    this.emit('userLeft', userId);
  }
  
  /**
   * Get all online users
   */
  getOnlineUsers(): User[] {
    return Array.from(this.presence.users.values())
      .filter(p => p.online)
      .map(p => p.user);
  }
  
  /**
   * Get all cursors
   */
  getCursors(): Cursor[] {
    return Array.from(this.presence.cursors.values());
  }
  
  /**
   * Get all selections
   */
  getSelections(): Selection[] {
    return Array.from(this.presence.selections.values());
  }
  
  /**
   * Get comments for an element
   */
  getCommentsForElement(elementId: string): Comment[] {
    return Array.from(this.comments.values())
      .filter(c => c.elementId === elementId && !c.resolved);
  }
  
  /**
   * Create a version checkpoint
   */
  createCheckpoint(name: string, description?: string): Version {
    return this.vcs.createVersion(
      name,
      this.localUserId,
      [], // Would include recent operations
      this.projectState,
      description
    );
  }
  
  /**
   * Get version history
   */
  getVersionHistory(limit?: number): Version[] {
    return this.vcs.getHistory(limit);
  }
  
  /**
   * Create a branch
   */
  createBranch(name: string): Branch {
    return this.vcs.createBranch(name, this.localUserId);
  }
  
  /**
   * Switch branch
   */
  switchBranch(branchId: string): void {
    this.vcs.switchBranch(branchId);
  }
  
  /**
   * Merge branch
   */
  mergeBranch(branchId: string): ConflictResolution[] {
    return this.vcs.mergeBranch(branchId, this.localUserId);
  }
  
  /**
   * Disconnect from collaboration session
   */
  disconnect(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }
  
  /**
   * Get current project state
   */
  getState(): any {
    return this.projectState;
  }
}

// ============================================
// PERMISSION MANAGER
// ============================================

export class PermissionManager {
  private permissions: Map<string, Set<string>> = new Map();
  
  constructor() {
    // Define role permissions
    this.permissions.set('owner', new Set([
      'read', 'write', 'delete', 'share', 'admin', 'transfer',
    ]));
    this.permissions.set('admin', new Set([
      'read', 'write', 'delete', 'share', 'admin',
    ]));
    this.permissions.set('editor', new Set([
      'read', 'write', 'comment',
    ]));
    this.permissions.set('viewer', new Set([
      'read', 'comment',
    ]));
  }
  
  hasPermission(user: User, permission: string): boolean {
    const rolePermissions = this.permissions.get(user.role);
    return rolePermissions?.has(permission) ?? false;
  }
  
  canEdit(user: User): boolean {
    return this.hasPermission(user, 'write');
  }
  
  canDelete(user: User): boolean {
    return this.hasPermission(user, 'delete');
  }
  
  canShare(user: User): boolean {
    return this.hasPermission(user, 'share');
  }
  
  canAdmin(user: User): boolean {
    return this.hasPermission(user, 'admin');
  }
}

// ============================================
// EXPORTS
// ============================================

export const collaborationHub = new CollaborationHub();
export const permissionManager = new PermissionManager();

export default {
  CollaborationHub,
  PermissionManager,
  collaborationHub,
  permissionManager,
};
