/**
 * Canvas-Based Room Planner Renderer
 * 
 * Uses HTML5 Canvas 2D API for efficient rendering
 */

import type { Room, Door, Window, FurnitureItem, WalkPath, ValidationIssue, CanvasState } from './types';
import { getDoorSwingArc, formatDimension, getRotatedBoundingBox } from './geometry';

export interface RenderOptions {
  showGrid: boolean;
  showDimensions: boolean;
  showDoorSwings: boolean;
  showValidationHighlights: boolean;
  pixelsPerMm: number;
  panX: number;
  panY: number;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private options: RenderOptions;

  constructor(canvas: HTMLCanvasElement, options: Partial<RenderOptions> = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    this.options = {
      showGrid: true,
      showDimensions: true,
      showDoorSwings: true,
      showValidationHighlights: true,
      pixelsPerMm: 0.1,
      panX: 0,
      panY: 0,
      ...options,
    };
  }

  render(state: CanvasState, validationIssues: ValidationIssue[] = []): void {
    this.ctx.fillStyle = '#f5f5f5';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.options.showGrid) this.drawGrid(state.gridSpacing);

    state.walkPaths.forEach(p => this.drawWalkPath(p, state.selection.objectId === p.id));
    state.rooms.forEach(r => this.drawRoom(r, state.selection.objectId === r.id));
    
    state.doors.forEach(d => {
      const hasIssue = validationIssues.some(i => i.objectIds.includes(d.id));
      this.drawDoor(d, state.selection.objectId === d.id, hasIssue);
      if (this.options.showDoorSwings) this.drawDoorSwing(d);
    });

    (state.windows || []).forEach(w => this.drawWindow(w, state.selection.objectId === w.id));
    
    state.furniture.forEach(f => {
      const hasIssue = validationIssues.some(i => i.objectIds.includes(f.id));
      this.drawFurniture(f, state.selection.objectId === f.id, hasIssue);
    });

    if (this.options.showValidationHighlights) {
      this.drawValidationHighlights(validationIssues);
    }
  }

  private drawGrid(spacing: number = 200): void {
    const scale = this.options.pixelsPerMm;
    const panX = this.options.panX;
    const panY = this.options.panY;

    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 0.5;

    const startX = Math.floor((-panX / scale) / spacing) * spacing;
    const startY = Math.floor((-panY / scale) / spacing) * spacing;

    for (let x = startX; x < this.canvas.width / scale + startX; x += spacing) {
      const canvasX = x * scale + panX;
      this.ctx.beginPath();
      this.ctx.moveTo(canvasX, 0);
      this.ctx.lineTo(canvasX, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = startY; y < this.canvas.height / scale + startY; y += spacing) {
      const canvasY = y * scale + panY;
      this.ctx.beginPath();
      this.ctx.moveTo(0, canvasY);
      this.ctx.lineTo(this.canvas.width, canvasY);
      this.ctx.stroke();
    }
  }

  private drawRoom(room: Room, isSelected: boolean): void {
    const scale = this.options.pixelsPerMm;
    const x = room.x * scale + this.options.panX;
    const y = room.y * scale + this.options.panY;
    const width = room.width * scale;
    const height = room.height * scale;

    this.ctx.fillStyle = room.color;
    this.ctx.globalAlpha = 0.1;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.globalAlpha = 1;

    this.ctx.strokeStyle = isSelected ? '#2196F3' : '#333';
    this.ctx.lineWidth = isSelected ? 3 : 2;
    this.ctx.strokeRect(x, y, width, height);

    if (this.options.showDimensions) {
      this.ctx.fillStyle = '#333';
      this.ctx.font = 'bold 14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(room.name, x + width / 2, y + 20);
    }

    if (isSelected) {
      this.drawResizeHandles({ x, y, width, height });
    }
  }

  private drawDoor(door: Door, isSelected: boolean, hasIssue: boolean): void {
    const scale = this.options.pixelsPerMm;
    const x = door.x * scale + this.options.panX;
    const y = door.y * scale + this.options.panY;
    const width = door.width * scale;
    const height = door.height * scale;

    this.ctx.fillStyle = hasIssue ? '#ff6b6b' : (isSelected ? '#2196F3' : '#FFB300');
    this.ctx.fillRect(x - width / 2, y - height / 2, width, height);

    this.ctx.strokeStyle = hasIssue ? '#d32f2f' : (isSelected ? '#1976D2' : '#F57C00');
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x - width / 2, y - height / 2, width, height);
  }

  private drawDoorSwing(door: Door): void {
    const swingArc = getDoorSwingArc(door, door.swingAngle || 120);
    const scale = this.options.pixelsPerMm;

    this.ctx.fillStyle = 'rgba(33, 150, 243, 0.05)';
    this.ctx.strokeStyle = 'rgba(33, 150, 243, 0.2)';
    this.ctx.lineWidth = 1;

    this.ctx.beginPath();
    const first = swingArc[0];
    this.ctx.moveTo(first.x * scale + this.options.panX, first.y * scale + this.options.panY);

    for (let i = 1; i < swingArc.length; i++) {
      const point = swingArc[i];
      this.ctx.lineTo(point.x * scale + this.options.panX, point.y * scale + this.options.panY);
    }

    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawWindow(window: Window, isSelected: boolean): void {
    const scale = this.options.pixelsPerMm;
    const x = window.x * scale + this.options.panX;
    const y = window.y * scale + this.options.panY;
    const width = window.width * scale;
    const height = window.height * scale;

    this.ctx.fillStyle = 'rgba(135, 206, 250, 0.3)';
    this.ctx.fillRect(x - width / 2, y - height / 2, width, height);

    this.ctx.strokeStyle = isSelected ? '#0077BE' : '#1E90FF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x - width / 2, y - height / 2, width, height);
  }

  private drawFurniture(furniture: FurnitureItem, isSelected: boolean, hasIssue: boolean): void {
    const scale = this.options.pixelsPerMm;
    const x = furniture.x * scale + this.options.panX;
    const y = furniture.y * scale + this.options.panY;
    const width = furniture.width * scale;
    const height = furniture.depth * scale;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate((furniture.rotation * Math.PI) / 180);

    this.ctx.fillStyle = hasIssue ? '#ffcccc' : furniture.color;
    this.ctx.globalAlpha = hasIssue ? 0.8 : 0.6;
    this.ctx.fillRect(-width / 2, -height / 2, width, height);
    this.ctx.globalAlpha = 1;

    this.ctx.strokeStyle = hasIssue ? '#d32f2f' : (isSelected ? '#2196F3' : '#555');
    this.ctx.lineWidth = isSelected ? 3 : 2;
    this.ctx.strokeRect(-width / 2, -height / 2, width, height);

    this.ctx.restore();

    if (isSelected) {
      this.drawResizeHandles({ x, y, width, height });
    }
  }

  private drawWalkPath(path: WalkPath, isSelected: boolean): void {
    const scale = this.options.pixelsPerMm;

    this.ctx.strokeStyle = isSelected ? '#4CAF50' : '#81C784';
    this.ctx.lineWidth = path.width * scale;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    for (let i = 0; i < path.points.length; i++) {
      const point = path.points[i];
      const canvasX = point.x * scale + this.options.panX;
      const canvasY = point.y * scale + this.options.panY;

      if (i === 0) {
        this.ctx.moveTo(canvasX, canvasY);
      } else {
        this.ctx.lineTo(canvasX, canvasY);
      }
    }

    this.ctx.stroke();
  }

  private drawValidationHighlights(issues: ValidationIssue[]): void {
    const scale = this.options.pixelsPerMm;

    for (const issue of issues) {
      if (issue.affectedArea) {
        const x = issue.affectedArea.x * scale + this.options.panX;
        const y = issue.affectedArea.y * scale + this.options.panY;
        const width = issue.affectedArea.width * scale;
        const height = issue.affectedArea.height * scale;

        this.ctx.strokeStyle = issue.severity === 'error' ? '#d32f2f' : '#f57c00';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
      }

      const markerX = issue.location.x * scale + this.options.panX;
      const markerY = issue.location.y * scale + this.options.panY;

      this.ctx.fillStyle = issue.severity === 'error' ? '#d32f2f' : '#f57c00';
      this.ctx.beginPath();
      this.ctx.arc(markerX, markerY, 6, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  private drawResizeHandles(bounds: { x: number; y: number; width: number; height: number }): void {
    const handleSize = 8;
    const positions = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ];

    for (const pos of positions) {
      this.ctx.fillStyle = '#2196F3';
      this.ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);

      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
    }
  }

  updateOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
