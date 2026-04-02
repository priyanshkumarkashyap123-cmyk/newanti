/**
 * EnvironmentalAnalysisUtils - Sunlight and airflow analysis for floor plans
 *
 * Handles:
 * - Solar angle calculations and shadow pattern generation
 * - Natural lighting factor computation
 * - UV and glare risk assessment
 * - Cross-ventilation path identification
 * - Air changes per hour (ACH) calculation
 * - Stack ventilation potential scoring
 */

import {
  FloorPlan,
  SunlightAnalysis,
  AirflowAnalysis,
  SiteOrientation,
  CardinalDirection,
} from './types';

function generateShadowPatterns(latitude: number) {
  const patterns = [];
  for (let month = 1; month <= 12; month += 3) {
    for (let hour = 8; hour <= 17; hour += 3) {
      const sunAltitude = 45 + (month <= 6 ? month * 3 : (12 - month) * 3) - (hour - 12) * 2;
      const shadowLength = 1 / Math.tan((sunAltitude * Math.PI) / 180);
      patterns.push({
        hour,
        month,
        shadowPolygon: [
          { x: 0, y: 0 },
          { x: shadowLength, y: 0 },
          { x: shadowLength, y: shadowLength * 0.3 },
          { x: 0, y: shadowLength * 0.3 },
        ],
      });
    }
  }
  return patterns;
}

function generateSunlightRecommendations(roomSunlight: SunlightAnalysis['roomSunlight']): string[] {
  const recs: string[] = [];
  recs.push('East-facing windows provide morning sunlight — ideal for bedrooms and kitchen.');
  recs.push('South-facing windows (in Northern Hemisphere) get maximum winter sun.');
  recs.push('West-facing openings should have shading devices to prevent afternoon glare.');
  recs.push('North-facing rooms receive consistent indirect light — ideal for studies/offices.');

  const poorlyLitRooms = roomSunlight.filter((r) => r.naturalLightFactor < 0.3);
  if (poorlyLitRooms.length > 0) {
    recs.push(
      `${poorlyLitRooms.length} room(s) have low natural light — consider adding windows or skylights.`,
    );
  }

  const glareRooms = roomSunlight.filter((r) => r.glareRisk);
  if (glareRooms.length > 0) {
    recs.push(
      `${glareRooms.length} room(s) have glare risk — add external shading or low-e glazing.`,
    );
  }

  return recs;
}

export function generateSunlightAnalysisUtil(
  floorPlans: FloorPlan[],
  latitude: number,
  longitude: number,
): SunlightAnalysis {
  // Calculate solar angles based on latitude
  const summerAltitude = 90 - latitude + 23.44;
  const winterAltitude = 90 - latitude - 23.44;

  const roomSunlight = floorPlans.flatMap((fp) =>
    fp.rooms.map((room) => {
      const hasEastWindow = room.windows.some((w) => w.wallSide === 'E');
      const hasSouthWindow = room.windows.some((w) => w.wallSide === 'S');
      const hasWestWindow = room.windows.some((w) => w.wallSide === 'W');
      const hasNorthWindow = room.windows.some((w) => w.wallSide === 'N');

      const summerHours =
        (hasEastWindow ? 3 : 0) +
        (hasSouthWindow ? 2 : 0) +
        (hasWestWindow ? 3 : 0) +
        (hasNorthWindow ? 1 : 0);
      const winterHours =
        (hasEastWindow ? 2 : 0) + (hasSouthWindow ? 4 : 0) + (hasWestWindow ? 2 : 0);

      const windowArea = room.windows.reduce((sum, w) => sum + w.width * w.height, 0);
      const floorArea = room.width * room.height;
      const naturalLightFactor = Math.min(1, windowArea / (floorArea * 0.2));

      return {
        roomId: room.id,
        hoursOfDirectSun: { summer: summerHours, winter: winterHours },
        naturalLightFactor,
        glareRisk: hasWestWindow && room.spec.type === 'home_office',
        uvExposure: (hasWestWindow ? 'high' : hasEastWindow ? 'medium' : 'low') as
          | 'low'
          | 'medium'
          | 'high',
      };
    }),
  );

  return {
    latitude,
    longitude,
    timezone: 'Asia/Kolkata',
    solsticeAngles: {
      summer: { altitude: Math.min(90, summerAltitude), azimuth: 90 },
      winter: { altitude: Math.max(10, winterAltitude), azimuth: 135 },
    },
    roomSunlight,
    shadowPatterns: generateShadowPatterns(latitude),
    recommendations: generateSunlightRecommendations(roomSunlight),
  };
}

export function generateAirflowAnalysisUtil(
  floorPlans: FloorPlan[],
  orientation: SiteOrientation,
): AirflowAnalysis {
  const prevailingWind: CardinalDirection =
    orientation.plotFacing === 'N'
      ? 'SW'
      : orientation.plotFacing === 'S'
        ? 'NE'
        : orientation.plotFacing === 'E'
          ? 'W'
          : 'E';

  const roomVentilation = floorPlans.flatMap((fp) =>
    fp.rooms.map((room) => {
      const windowCount = room.windows.length;
      const totalOpenableArea = room.windows.reduce((sum, w) => sum + w.width * w.height, 0);
      const floorArea = room.width * room.height;
      const openingRatio = floorArea > 0 ? totalOpenableArea / floorArea : 0;

      const hasOppositeWindows =
        room.windows.some((w) => w.wallSide === 'N' || w.wallSide === 'E') &&
        room.windows.some((w) => w.wallSide === 'S' || w.wallSide === 'W');

      const corridorBonus = fp.corridors.some(
        (c) =>
          room.x + room.width > c.x &&
          room.x < c.x + c.width &&
          room.y + room.height > c.y &&
          room.y < c.y + c.height,
      )
        ? 0.5
        : 0;

      const wetMechanicalBoost = ['kitchen', 'bathroom', 'toilet', 'laundry'].includes(room.spec.type)
        ? 1.0
        : 0;

      const achBase = windowCount === 0 ? 0.6 : hasOppositeWindows ? 6.5 : windowCount >= 2 ? 4.2 : 2.6;
      const achFromOpenings = Math.min(2, openingRatio * 20);
      const ach = Math.round((achBase + achFromOpenings + corridorBonus + wetMechanicalBoost) * 10) / 10;

      return {
        roomId: room.id,
        airChangesPerHour: ach,
        adequacy: (ach >= 6 ? 'excellent' : ach >= 4 ? 'good' : ach >= 2 ? 'fair' : 'poor') as
          | 'excellent'
          | 'good'
          | 'fair'
          | 'poor',
        recommendation:
          ach < 4
            ? 'Consider adding windows on opposite walls for cross ventilation'
            : hasOppositeWindows
              ? 'Good cross ventilation and acceptable ACH'
              : 'Ventilation acceptable; opposite-wall openings can improve comfort',
      };
    }),
  );

  const crossVentilationPaths = floorPlans.flatMap((fp) => {
    const paths: AirflowAnalysis['crossVentilationPaths'] = [];
    for (const room of fp.rooms) {
      if (room.windows.length >= 2) {
        const sides = room.windows.map((w) => w.wallSide);
        if (
          (sides.includes('N') && sides.includes('S')) ||
          (sides.includes('E') && sides.includes('W'))
        ) {
          const openableArea = room.windows.reduce((sum, w) => sum + w.width * w.height, 0);
          const areaFactor = Math.min(1, openableArea / Math.max(1, room.width * room.height * 0.15));
          paths.push({
            inletRoom: room.id,
            outletRoom: room.id,
            effectiveness: Math.round((0.6 + areaFactor * 0.35) * 100) / 100,
          });
        }
      }
    }
    return paths;
  });

  const stackVentilationPotential =
    floorPlans.length > 1
      ? Math.min(0.9, 0.45 + floorPlans.length * 0.15)
      : 0.35;

  return {
    prevailingWindDirection: prevailingWind,
    windSpeed: 3.5,
    crossVentilationPaths,
    stackVentilationPotential,
    roomVentilation,
  };
}
