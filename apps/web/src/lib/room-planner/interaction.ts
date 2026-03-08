/**
 * Room Planner Canvas Interaction Handler
 * 
 * Handles:
 * - Mouse/touch events on canvas
 * - Object selection and dragging
 * - Furniture placement and rotation
 * - Door/window placement
 * - Room drawing
 * - Grid snapping
 */

import type { CanvasState, CanvasToolMode, SelectionType, FurnitureItem, Door, Room } from './types';
import { snapToGrid, snapFurnitureToRoom, snapToWall } from './geometry';

export interface InteractionEvent {
  type: 'select' | 'deselect' | 'drag' | 'drop' | 'resize' | 'rotate' | 'delete';
  objectId?: string;
  x: number;
  y: number;
}

export interface InteractionHandler {
  onInteraction: (event: InteractionEvent) => void;
  onStateChange: (state: CanvasState) => void;
}

export class CanvasInteractionManager {
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private state: CanvasState;
  private handler: InteractionHandler;
  private pixelsPerMm: number = 0.1;
  private panX: number = 0;
  private panY: number = 0;

  constructor(state: CanvasState, handler: InteractionHandler) {
    this.state = state;
    this.handler = handler;
  }

  /**
   * Handle mouse down
   */
  handleMouseDown(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const worldX = (canvasX - this.panX) / this.pixelsPerMm;
    const worldY = (canvasY - this.panY) / this.pixelsPerMm;

    this.isDragging = true;
    this.dragStartX = worldX;
    this.dragStartY = worldY;

    // Find what was clicked
    const objectId = this.getObjectAtPosition(worldX, worldY);

    if (objectId) {
      this.state.selection = {
        type: 'furniture',
        objectId,
        isDragging: true,
        dragStartX: worldX,
        dragStartY: worldY,
      };
      this.handler.onInteraction({ type: 'select', objectId, x: worldX, y: worldY });
    } else {
      this.state.selection = { type: 'none', isDragging: false };
      this.handler.onInteraction({ type: 'deselect', x: worldX, y: worldY });
    }
  }

  /**
   * Handle mouse move
   */
  handleMouseMove(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const worldX = (canvasX - this.panX) / this.pixelsPerMm;
    const worldY = (canvasY - this.panY) / this.pixelsPerMm;

    if (!this.isDragging || !this.state.selection.objectId) return;

    const deltaX = worldX - (this.state.selection.dragStartX || 0);
    const deltaY = worldY - (this.state.selection.dragStartY || 0);

    // Update furniture position
    const furniture = this.state.furniture.find(f => f.id === this.state.selection.objectId);
    if (furniture) {
      const newX = this.dragStartX + deltaX;
      const newY = this.dragStartY + deltaY;

      // Apply snapping if enabled
      let snappedX = newX;
      let snappedY = newY;

      if (this.state.snapToGrid) {
        const snap = snapToGrid({ x: newX, y: newY }, this.state.gridSpacing);
        snappedX = snap.x;
        snappedY = snap.y;
      }

      furniture.x = snappedX;
      furniture.y = snappedY;

      this.handler.onStateChange(this.state);
    }
  }

  /**
   * Handle mouse up
   */
  handleMouseUp(event: MouseEvent, canvas: HTMLCanvasElement): void {
    this.isDragging = false;

    if (!this.state.selection.objectId) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const worldX = (canvasX - this.panX) / this.pixelsPerMm;
    const worldY = (canvasY - this.panY) / this.pixelsPerMm;

    this.handler.onInteraction({
      type: 'drop',
      objectId: this.state.selection.objectId,
      x: worldX,
      y: worldY,
    });
  }

  /**
   * Handle double-click for rotation
   */
  handleDoubleClick(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const worldX = (canvasX - this.panX) / this.pixelsPerMm;
    const worldY = (canvasY - this.panY) / this.pixelsPerMm;

    const objectId = this.getObjectAtPosition(worldX, worldY);
    if (!objectId) return;

    const furniture = this.state.furniture.find(f => f.id === objectId);
    if (furniture) {
      // Rotate 90 degrees
      furniture.rotation = (furniture.rotation + 90) % 360;

      this.handler.onInteraction({
        type: 'rotate',
        objectId,
        x: worldX,
        y: worldY,
      });

      this.handler.onStateChange(this.state);
    }
  }

  /**
   * Find object at given position
   */
  private getObjectAtPosition(worldX: number, worldY: number): string | undefined {
    // Check furniture (top to bottom - last drawn is on top)
    for (let i = this.state.furniture.length - 1; i >= 0; i--) {
      const f = this.state.furniture[i];
      const bounds = {
        x: f.x - f.width / 2,
        y: f.y - f.depth / 2,
        width: f.width,
        height: f.depth,
      };

      if (this.pointInRect(worldX, worldY, bounds)) {
        return f.id;
      }
    }

    // Check doors
    for (const d of this.state.doors) {
      const bounds = {
        x: d.x - d.width / 2,
        y: d.y - d.height / 2,
        width: d.width,
        height: d.height,
      };

      if (this.pointInRect(worldX, worldY, bounds)) {
        return d.id;
      }
    }

    // Check rooms
    for (const r of this.state.rooms) {
      const bounds = {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };

      if (this.pointInRect(worldX, worldY, bounds)) {
        return r.id;
      }
    }

    return undefined;
  }

  /**
   * Point in rectangle test
   */
  private pointInRect(
    x: number,
    y: number,
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    );
  }

  /**
   * Place furniture by type
   */
  placeFurniture(furnishingId: string, itemType: string, room: Room): void {
    const newFurniture: FurnitureItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: itemType as any,
      x: room.x + room.width / 2,
      y: room.y + room.height / 2,
      width: 600,
      depth: 600,
      height: 600,
      rotation: 0,
      color: '#8B4513',
    };

    this.state.furniture.push(newFurniture);
    this.handler.onStateChange(this.state);
  }

  /**
   * Delete selected object
   */
  deleteSelected(): void {
    const { objectId } = this.state.selection;
    if (!objectId) return;

    this.state.furniture = this.state.furniture.filter(f => f.id !== objectId);
    this.state.doors = this.state.doors.filter(d => d.id !== objectId);
    this.state.rooms = this.state.rooms.filter(r => r.id !== objectId);

    this.state.selection = { type: 'none', isDragging: false };

    this.handler.onStateChange(this.state);
  }

  /**
   * Set pan/zoom
   */
  setViewport(pixelsPerMm: number, panX: number, panY: number): void {
    this.pixelsPerMm = pixelsPerMm;
    this.panX = panX;
    this.panY = panY;
  }

  /**
   * Get current state
   */
  getState(): CanvasState {
    return this.state;
  }

  /**
   * Update state
   */
  setState(newState: CanvasState): void {
    this.state = newState;
  }
}
