/**
 * SurveyingService.ts
 * 
 * Basic Surveying & Quantity Takeoff Module
 * 
 * Features:
 * - Coordinate geometry
 * - Area calculations
 * - Volume calculations
 * - Leveling
 * - Curve setting
 */

// ============================================
// TYPES
// ============================================

export interface Point {
    id?: string;
    x: number;      // Easting
    y: number;      // Northing
    z?: number;     // Elevation
}

export interface TraverseStation {
    id: string;
    bearing: number;    // degrees
    distance: number;   // m
    coordinates?: Point;
}

export interface LevelReading {
    station: string;
    BS?: number;        // Back Sight
    IS?: number;        // Intermediate Sight
    FS?: number;        // Fore Sight
    RL?: number;        // Reduced Level
}

export interface ContourPoint {
    x: number;
    y: number;
    z: number;
}

// ============================================
// SURVEYING SERVICE
// ============================================

class SurveyingServiceClass {
    /**
     * Calculate area using coordinate method (Shoelace formula)
     */
    calculateArea(points: Point[]): number {
        const n = points.length;
        if (n < 3) return 0;

        let area = 0;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }

        return Math.abs(area) / 2;
    }

    /**
     * Calculate traverse coordinates
     */
    calculateTraverse(
        startPoint: Point,
        stations: TraverseStation[]
    ): TraverseStation[] {
        let currentX = startPoint.x;
        let currentY = startPoint.y;

        return stations.map(station => {
            const bearingRad = station.bearing * Math.PI / 180;

            // Calculate departures and latitudes
            const departure = station.distance * Math.sin(bearingRad);
            const latitude = station.distance * Math.cos(bearingRad);

            currentX += departure;
            currentY += latitude;

            return {
                ...station,
                coordinates: { x: currentX, y: currentY }
            };
        });
    }

    /**
     * Calculate closing error
     */
    calculateClosingError(
        startPoint: Point,
        endPoint: Point,
        totalDistance: number
    ): { linear: number; ratio: number } {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const linear = Math.sqrt(dx * dx + dy * dy);
        const ratio = totalDistance / linear;

        return { linear, ratio };
    }

    /**
     * Reduce levels (Rise and Fall method)
     */
    reduceLevels(readings: LevelReading[], benchmarkRL: number): LevelReading[] {
        const result: LevelReading[] = [];
        let currentRL = benchmarkRL;

        for (let i = 0; i < readings.length; i++) {
            const reading = readings[i];

            if (i === 0 && reading.BS !== undefined) {
                // First reading - set from benchmark
                currentRL = benchmarkRL;
                result.push({ ...reading, RL: currentRL });
            } else if (reading.FS !== undefined) {
                // Calculate rise/fall from previous
                const prevReading = readings[i - 1];
                const prevHI = (prevReading.BS !== undefined)
                    ? result[i - 1].RL! + prevReading.BS
                    : result[i - 1].RL!;

                currentRL = prevHI - reading.FS;
                result.push({ ...reading, RL: currentRL });
            } else if (reading.IS !== undefined) {
                // Intermediate sight
                const prevReading = readings.slice(0, i).reverse()
                    .find(r => r.BS !== undefined);
                if (prevReading) {
                    const bsIndex = readings.indexOf(prevReading);
                    const HI = result[bsIndex].RL! + prevReading.BS!;
                    currentRL = HI - reading.IS;
                }
                result.push({ ...reading, RL: currentRL });
            } else if (reading.BS !== undefined) {
                // New setup
                result.push({ ...reading, RL: currentRL });
            }
        }

        return result;
    }

    /**
     * Calculate volume (Trapezoidal/Simpson's rule)
     */
    calculateVolume(
        crossSections: Array<{ station: number; area: number }>,
        method: 'trapezoidal' | 'prismoidal' = 'trapezoidal'
    ): number {
        const n = crossSections.length;
        if (n < 2) return 0;

        // Sort by station
        crossSections.sort((a, b) => a.station - b.station);

        let volume = 0;

        if (method === 'trapezoidal') {
            // Average end area method
            for (let i = 0; i < n - 1; i++) {
                const d = crossSections[i + 1].station - crossSections[i].station;
                const avgArea = (crossSections[i].area + crossSections[i + 1].area) / 2;
                volume += avgArea * d;
            }
        } else {
            // Prismoidal (Simpson's rule for even intervals)
            for (let i = 0; i < n - 2; i += 2) {
                const d = crossSections[i + 2].station - crossSections[i].station;
                const A1 = crossSections[i].area;
                const A2 = crossSections[i + 1].area;
                const A3 = crossSections[i + 2].area;
                volume += (d / 6) * (A1 + 4 * A2 + A3);
            }
        }

        return volume;
    }

    /**
     * Calculate cut/fill volumes
     */
    calculateCutFill(
        existingLevels: number[][],    // Grid of existing elevations
        proposedLevels: number[][],    // Grid of proposed elevations
        gridSpacing: number
    ): { cut: number; fill: number; net: number } {
        let cut = 0;
        let fill = 0;

        const rows = existingLevels.length;
        const cols = existingLevels[0].length;
        const cellArea = gridSpacing * gridSpacing;

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const diff = existingLevels[i][j] - proposedLevels[i][j];

                if (diff > 0) {
                    cut += diff * cellArea;
                } else {
                    fill += Math.abs(diff) * cellArea;
                }
            }
        }

        return {
            cut,
            fill,
            net: cut - fill
        };
    }

    /**
     * Set out circular curve
     */
    setOutCircularCurve(
        radius: number,
        deflectionAngle: number,   // degrees
        chainage: number,          // PC chainage
        intervals: number = 20     // Chord length
    ): Array<{ chainage: number; deflection: number; chord: number; point: Point }> {
        const delta = deflectionAngle * Math.PI / 180;
        const curveLength = radius * delta;
        const numPoints = Math.ceil(curveLength / intervals);

        const points: Array<{ chainage: number; deflection: number; chord: number; point: Point }> = [];

        let totalDeflection = 0;
        let currentChainage = chainage;

        for (let i = 1; i <= numPoints; i++) {
            const chordLength = Math.min(intervals, curveLength - (i - 1) * intervals);
            const deflection = (chordLength / (2 * radius)) * (180 / Math.PI);

            totalDeflection += deflection;
            currentChainage += chordLength;

            // Calculate point coordinates (relative to PC)
            const theta = totalDeflection * 2 * Math.PI / 180;
            const x = radius * Math.sin(theta);
            const y = radius * (1 - Math.cos(theta));

            points.push({
                chainage: currentChainage,
                deflection: totalDeflection,
                chord: chordLength,
                point: { x, y }
            });
        }

        return points;
    }

    /**
     * Calculate bearing between two points
     */
    calculateBearing(from: Point, to: Point): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        let bearing = Math.atan2(dx, dy) * 180 / Math.PI;
        if (bearing < 0) bearing += 360;

        return bearing;
    }

    /**
     * Calculate distance between two points
     */
    calculateDistance(from: Point, to: Point): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dz = (to.z || 0) - (from.z || 0);

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Interpolate contours
     */
    interpolateContours(
        points: ContourPoint[],
        interval: number
    ): Map<number, Point[]> {
        const contours = new Map<number, Point[]>();

        // Find elevation range
        const elevations = points.map(p => p.z);
        const minZ = Math.floor(Math.min(...elevations) / interval) * interval;
        const maxZ = Math.ceil(Math.max(...elevations) / interval) * interval;

        // Create contour elevation levels
        for (let z = minZ; z <= maxZ; z += interval) {
            contours.set(z, []);
        }

        // For each triangle of points, find contour crossings
        // (Simplified - would use proper triangulation)

        return contours;
    }
}

// ============================================
// SINGLETON
// ============================================

export const surveying = new SurveyingServiceClass();

export default SurveyingServiceClass;
