import { DEFAULT_RECT_ADJACENCY_TOL_M, DEFAULT_EDGE_TOL_M } from './constants';

export class Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  get area(): number {
    return this.width * this.height;
  }

  get aspect_ratio(): number {
    const short = Math.min(this.width, this.height);
    if (short <= 0) return Infinity;
    return Math.max(this.width, this.height) / short;
  }

  get min_dim(): number {
    return Math.min(this.width, this.height);
  }

  get max_dim(): number {
    return Math.max(this.width, this.height);
  }

  get center(): [number, number] {
    return [this.x + this.width / 2, this.y + this.height / 2];
  }

  get bounds(): [number, number, number, number] {
    return [this.x, this.y, this.x + this.width, this.y + this.height];
  }

  contains_point(px: number, py: number): boolean {
    const [x0, y0, x1, y1] = this.bounds;
    return x0 <= px && px <= x1 && y0 <= py && py <= y1;
  }

  shares_edge_with(boundary: Rectangle, tol: number = DEFAULT_EDGE_TOL_M): boolean {
    const [bx0, by0, bx1, by1] = boundary.bounds;
    const [x0, y0, x1, y1] = this.bounds;
    return (
      Math.abs(x0 - bx0) < tol ||
      Math.abs(x1 - bx1) < tol ||
      Math.abs(y0 - by0) < tol ||
      Math.abs(y1 - by1) < tol
    );
  }

  exterior_facades(boundary: Rectangle, tol: number = DEFAULT_EDGE_TOL_M): string[] {
    const facades: string[] = [];
    const [bx0, by0, bx1, by1] = boundary.bounds;
    const [x0, y0, x1, y1] = this.bounds;
    if (Math.abs(x0 - bx0) < tol) facades.push('left');
    if (Math.abs(x1 - bx1) < tol) facades.push('right');
    if (Math.abs(y0 - by0) < tol) facades.push('bottom');
    if (Math.abs(y1 - by1) < tol) facades.push('top');
    return facades;
  }

  distance_to(other: Rectangle): number {
    const [ax0, ay0, ax1, ay1] = this.bounds;
    const [bx0, by0, bx1, by1] = other.bounds;
    const dx = Math.max(0, Math.max(ax0 - bx1, bx0 - ax1));
    const dy = Math.max(0, Math.max(ay0 - by1, by0 - ay1));
    return Math.hypot(dx, dy);
  }
}

export function snap_to_grid(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function rectangles_overlap(r1: Rectangle, r2: Rectangle, tol: number = 0.01): boolean {
  const a = r1.bounds;
  const b = r2.bounds;
  return !(
    a[2] <= b[0] + tol ||
    b[2] <= a[0] + tol ||
    a[3] <= b[1] + tol ||
    b[3] <= a[1] + tol
  );
}

export function rectangles_adjacent(
  r1: Rectangle,
  r2: Rectangle,
  tol: number = DEFAULT_RECT_ADJACENCY_TOL_M
): boolean {
  const a = r1.bounds;
  const b = r2.bounds;
  if (Math.abs(a[2] - b[0]) <= tol || Math.abs(b[2] - a[0]) <= tol) {
    if (!(a[3] < b[1] || b[3] < a[1])) return true;
  }
  if (Math.abs(a[3] - b[1]) <= tol || Math.abs(b[3] - a[1]) <= tol) {
    if (!(a[2] < b[0] || b[2] < a[0])) return true;
  }
  return false;
}