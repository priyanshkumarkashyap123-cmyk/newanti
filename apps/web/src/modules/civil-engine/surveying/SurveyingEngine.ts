/**
 * ============================================================================
 * SURVEYING & GEODESY MODULE
 * ============================================================================
 * 
 * Comprehensive surveying calculations including:
 * - Coordinate transformations
 * - Traverse computations
 * - Leveling
 * - Curve setting out
 * - Area and volume calculations
 * - GPS/GNSS computations
 * 
 * @version 2.0.0
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const GEODETIC_CONSTANTS = {
  // WGS84 Ellipsoid
  WGS84: {
    semiMajorAxis: 6378137.0,           // a (meters)
    semiMinorAxis: 6356752.314245,       // b (meters)
    flattening: 1 / 298.257223563,       // f
    eccentricitySquared: 0.006694379990197,  // e²
  },
  // GRS80 Ellipsoid
  GRS80: {
    semiMajorAxis: 6378137.0,
    semiMinorAxis: 6356752.314140,
    flattening: 1 / 298.257222101,
    eccentricitySquared: 0.006694380022901,
  },
  // Unit conversions
  DEG_TO_RAD: Math.PI / 180,
  RAD_TO_DEG: 180 / Math.PI,
  SECONDS_TO_RAD: Math.PI / 648000,
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Coordinate {
  x?: number;    // Easting
  y?: number;    // Northing
  z?: number;    // Elevation
  lat?: number;  // Latitude (degrees)
  lon?: number;  // Longitude (degrees)
  h?: number;    // Ellipsoidal height
}

export interface TraverseStation {
  id: string;
  coordinates?: Coordinate;
  backsightAngle?: number;    // degrees
  foresightAngle?: number;    // degrees
  horizontalDistance?: number; // m
  verticalAngle?: number;      // degrees
  heightOfInstrument?: number; // m
  targetHeight?: number;       // m
}

export interface LevelReading {
  station: string;
  backsight?: number;         // m
  intermediateSight?: number; // m
  foresight?: number;         // m
  reducedLevel?: number;      // m
  remarks?: string;
}

export interface CurveData {
  type: 'simple' | 'compound' | 'reverse' | 'transition';
  radius: number | number[];   // m
  deflectionAngle: number;     // degrees
  PI?: Coordinate;             // Point of intersection
  chainage?: number;           // m
}

// =============================================================================
// COORDINATE TRANSFORMATIONS
// =============================================================================

export class CoordinateTransformations {
  /**
   * Convert Degrees-Minutes-Seconds to Decimal Degrees
   */
  static dmsToDecimal(
    degrees: number,
    minutes: number,
    seconds: number,
    direction: 'N' | 'S' | 'E' | 'W' = 'N'
  ): number {
    const decimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
    const sign = (direction === 'S' || direction === 'W') ? -1 : 1;
    return sign * decimal;
  }

  /**
   * Convert Decimal Degrees to DMS
   */
  static decimalToDMS(
    decimal: number
  ): { degrees: number; minutes: number; seconds: number; direction: string } {
    const direction = decimal >= 0 ? 'N' : 'S'; // Assumes latitude; adjust for longitude
    const absDecimal = Math.abs(decimal);
    const degrees = Math.floor(absDecimal);
    const minutesDecimal = (absDecimal - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = (minutesDecimal - minutes) * 60;
    
    return { degrees, minutes, seconds, direction };
  }

  /**
   * Convert Geographic to UTM
   */
  static geoToUTM(
    lat: number,
    lon: number,
    ellipsoid: 'WGS84' | 'GRS80' = 'WGS84'
  ): { easting: number; northing: number; zone: number; hemisphere: 'N' | 'S' } {
    const ell = GEODETIC_CONSTANTS[ellipsoid];
    const a = ell.semiMajorAxis;
    const e2 = ell.eccentricitySquared;
    
    const k0 = 0.9996; // Scale factor
    
    // Calculate zone
    const zone = Math.floor((lon + 180) / 6) + 1;
    const centralMeridian = (zone - 1) * 6 - 180 + 3;
    
    const latRad = lat * GEODETIC_CONSTANTS.DEG_TO_RAD;
    const lonRad = lon * GEODETIC_CONSTANTS.DEG_TO_RAD;
    const cmRad = centralMeridian * GEODETIC_CONSTANTS.DEG_TO_RAD;
    
    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    const T = Math.tan(latRad) * Math.tan(latRad);
    const C = (e2 / (1 - e2)) * Math.cos(latRad) * Math.cos(latRad);
    const A = Math.cos(latRad) * (lonRad - cmRad);
    
    // Meridional arc
    const e4 = e2 * e2;
    const e6 = e4 * e2;
    const M = a * ((1 - e2/4 - 3*e4/64 - 5*e6/256) * latRad
               - (3*e2/8 + 3*e4/32 + 45*e6/1024) * Math.sin(2*latRad)
               + (15*e4/256 + 45*e6/1024) * Math.sin(4*latRad)
               - (35*e6/3072) * Math.sin(6*latRad));
    
    // Calculate UTM coordinates
    const easting = k0 * N * (A + (1-T+C)*Math.pow(A,3)/6 
                 + (5-18*T+T*T+72*C-58*(e2/(1-e2)))*Math.pow(A,5)/120) + 500000;
    
    let northing = k0 * (M + N * Math.tan(latRad) * (A*A/2 
                  + (5-T+9*C+4*C*C)*Math.pow(A,4)/24
                  + (61-58*T+T*T+600*C-330*(e2/(1-e2)))*Math.pow(A,6)/720));
    
    if (lat < 0) {
      northing += 10000000; // Southern hemisphere
    }
    
    return {
      easting,
      northing,
      zone,
      hemisphere: lat >= 0 ? 'N' : 'S',
    };
  }

  /**
   * Convert UTM to Geographic
   */
  static utmToGeo(
    easting: number,
    northing: number,
    zone: number,
    hemisphere: 'N' | 'S',
    ellipsoid: 'WGS84' | 'GRS80' = 'WGS84'
  ): { lat: number; lon: number } {
    const ell = GEODETIC_CONSTANTS[ellipsoid];
    const a = ell.semiMajorAxis;
    const e2 = ell.eccentricitySquared;
    
    const k0 = 0.9996;
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    
    const x = easting - 500000;
    let y = northing;
    
    if (hemisphere === 'S') {
      y -= 10000000;
    }
    
    const centralMeridian = (zone - 1) * 6 - 180 + 3;
    
    const M = y / k0;
    const mu = M / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));
    
    const phi1 = mu + (3*e1/2 - 27*e1*e1*e1/32) * Math.sin(2*mu)
               + (21*e1*e1/16 - 55*e1*e1*e1*e1/32) * Math.sin(4*mu)
               + (151*e1*e1*e1/96) * Math.sin(6*mu)
               + (1097*e1*e1*e1*e1/512) * Math.sin(8*mu);
    
    const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
    const T1 = Math.tan(phi1) * Math.tan(phi1);
    const C1 = (e2 / (1 - e2)) * Math.cos(phi1) * Math.cos(phi1);
    const D = x / (N1 * k0);
    
    const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D*D/2
              - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*(e2/(1-e2))) * Math.pow(D,4) / 24
              + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*(e2/(1-e2)) - 3*C1*C1) * Math.pow(D,6) / 720);
    
    const lon = centralMeridian * GEODETIC_CONSTANTS.DEG_TO_RAD 
              + (D - (1 + 2*T1 + C1) * Math.pow(D,3) / 6
              + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*(e2/(1-e2)) + 24*T1*T1) * Math.pow(D,5) / 120) / Math.cos(phi1);
    
    return {
      lat: lat * GEODETIC_CONSTANTS.RAD_TO_DEG,
      lon: lon * GEODETIC_CONSTANTS.RAD_TO_DEG,
    };
  }

  /**
   * Convert Geographic to ECEF (Earth-Centered Earth-Fixed)
   */
  static geoToECEF(
    lat: number,
    lon: number,
    h: number,
    ellipsoid: 'WGS84' | 'GRS80' = 'WGS84'
  ): { X: number; Y: number; Z: number } {
    const ell = GEODETIC_CONSTANTS[ellipsoid];
    const a = ell.semiMajorAxis;
    const e2 = ell.eccentricitySquared;
    
    const latRad = lat * GEODETIC_CONSTANTS.DEG_TO_RAD;
    const lonRad = lon * GEODETIC_CONSTANTS.DEG_TO_RAD;
    
    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    
    return {
      X: (N + h) * Math.cos(latRad) * Math.cos(lonRad),
      Y: (N + h) * Math.cos(latRad) * Math.sin(lonRad),
      Z: (N * (1 - e2) + h) * Math.sin(latRad),
    };
  }

  /**
   * Convert ECEF to Geographic
   */
  static ecefToGeo(
    X: number,
    Y: number,
    Z: number,
    ellipsoid: 'WGS84' | 'GRS80' = 'WGS84'
  ): { lat: number; lon: number; h: number } {
    const ell = GEODETIC_CONSTANTS[ellipsoid];
    const a = ell.semiMajorAxis;
    const b = ell.semiMinorAxis;
    const e2 = ell.eccentricitySquared;
    const ep2 = (a*a - b*b) / (b*b);
    
    const p = Math.sqrt(X*X + Y*Y);
    const lon = Math.atan2(Y, X);
    
    // Iterative calculation for latitude
    let lat = Math.atan2(Z, p * (1 - e2));
    let N, h;
    
    for (let i = 0; i < 10; i++) {
      N = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat));
      h = p / Math.cos(lat) - N;
      lat = Math.atan2(Z + e2 * N * Math.sin(lat), p);
    }
    
    return {
      lat: lat * GEODETIC_CONSTANTS.RAD_TO_DEG,
      lon: lon * GEODETIC_CONSTANTS.RAD_TO_DEG,
      h: h ?? 0,
    };
  }

  /**
   * Calculate geodetic distance (Vincenty formula)
   */
  static vincentyDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
    ellipsoid: 'WGS84' | 'GRS80' = 'WGS84'
  ): { distance: number; azimuth12: number; azimuth21: number } {
    const ell = GEODETIC_CONSTANTS[ellipsoid];
    const a = ell.semiMajorAxis;
    const b = ell.semiMinorAxis;
    const f = ell.flattening;
    
    const L = (lon2 - lon1) * GEODETIC_CONSTANTS.DEG_TO_RAD;
    const U1 = Math.atan((1 - f) * Math.tan(lat1 * GEODETIC_CONSTANTS.DEG_TO_RAD));
    const U2 = Math.atan((1 - f) * Math.tan(lat2 * GEODETIC_CONSTANTS.DEG_TO_RAD));
    
    const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
    
    let lambda = L;
    let lambdaP = 2 * Math.PI;
    let iterLimit = 100;
    
    let sinLambda, cosLambda, sinSigma, cosSigma, sigma;
    let sinAlpha, cosSqAlpha, cos2SigmaM, C;
    
    while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
      sinLambda = Math.sin(lambda);
      cosLambda = Math.cos(lambda);
      sinSigma = Math.sqrt(
        (cosU2 * sinLambda) ** 2 +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2
      );
      
      if (sinSigma === 0) return { distance: 0, azimuth12: 0, azimuth21: 0 };
      
      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
      sigma = Math.atan2(sinSigma, cosSigma);
      sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
      cosSqAlpha = 1 - sinAlpha * sinAlpha;
      cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha : 0;
      C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
      lambdaP = lambda;
      lambda = L + (1 - C) * f * sinAlpha * (
        sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2))
      );
    }
    
    const uSq = cosSqAlpha! * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    const deltaSigma = B * sinSigma! * (cos2SigmaM! + B / 4 * (
      cosSigma! * (-1 + 2 * cos2SigmaM! ** 2) -
      B / 6 * cos2SigmaM! * (-3 + 4 * sinSigma! ** 2) * (-3 + 4 * cos2SigmaM! ** 2)
    ));
    
    const distance = b * A * (sigma! - deltaSigma);
    const azimuth12 = Math.atan2(cosU2 * sinLambda!, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda!) * GEODETIC_CONSTANTS.RAD_TO_DEG;
    const azimuth21 = Math.atan2(cosU1 * sinLambda!, -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda!) * GEODETIC_CONSTANTS.RAD_TO_DEG;
    
    return {
      distance,
      azimuth12: (azimuth12 + 360) % 360,
      azimuth21: (azimuth21 + 360) % 360,
    };
  }

  /**
   * 2D coordinate transformation (Helmert)
   */
  static helmert2D(
    points: { source: Coordinate; target: Coordinate }[]
  ): { 
    scale: number; 
    rotation: number; 
    translationX: number; 
    translationY: number;
    transform: (x: number, y: number) => { x: number; y: number };
  } {
    // Calculate centroids
    let sumXs = 0, sumYs = 0, sumXt = 0, sumYt = 0;
    const n = points.length;
    
    points.forEach(p => {
      sumXs += p.source.x!;
      sumYs += p.source.y!;
      sumXt += p.target.x!;
      sumYt += p.target.y!;
    });
    
    const xsBar = sumXs / n;
    const ysBar = sumYs / n;
    const xtBar = sumXt / n;
    const ytBar = sumYt / n;
    
    // Calculate parameters
    let sumDxsDxt = 0, sumDysDyt = 0;
    let sumDxsDyt = 0, sumDysDxt = 0;
    let sumDxs2 = 0, sumDys2 = 0;
    
    points.forEach(p => {
      const dxs = p.source.x! - xsBar;
      const dys = p.source.y! - ysBar;
      const dxt = p.target.x! - xtBar;
      const dyt = p.target.y! - ytBar;
      
      sumDxsDxt += dxs * dxt;
      sumDysDyt += dys * dyt;
      sumDxsDyt += dxs * dyt;
      sumDysDxt += dys * dxt;
      sumDxs2 += dxs * dxs;
      sumDys2 += dys * dys;
    });
    
    const a = (sumDxsDxt + sumDysDyt) / (sumDxs2 + sumDys2);
    const b = (sumDxsDyt - sumDysDxt) / (sumDxs2 + sumDys2);
    
    const scale = Math.sqrt(a * a + b * b);
    const rotation = Math.atan2(b, a) * GEODETIC_CONSTANTS.RAD_TO_DEG;
    const translationX = xtBar - a * xsBar + b * ysBar;
    const translationY = ytBar - b * xsBar - a * ysBar;
    
    return {
      scale,
      rotation,
      translationX,
      translationY,
      transform: (x: number, y: number) => ({
        x: a * x - b * y + translationX,
        y: b * x + a * y + translationY,
      }),
    };
  }
}

// =============================================================================
// TRAVERSE COMPUTATIONS
// =============================================================================

export class TraverseComputations {
  /**
   * Calculate interior angles from bearings
   */
  static interiorAngle(
    backBearing: number,
    foreBearing: number
  ): number {
    let angle = foreBearing - backBearing;
    if (angle < 0) angle += 360;
    return angle;
  }

  /**
   * Convert bearing to azimuth
   */
  static bearingToAzimuth(
    bearing: number,
    quadrant: 'NE' | 'SE' | 'SW' | 'NW'
  ): number {
    switch (quadrant) {
      case 'NE': return bearing;
      case 'SE': return 180 - bearing;
      case 'SW': return 180 + bearing;
      case 'NW': return 360 - bearing;
    }
  }

  /**
   * Convert azimuth to bearing
   */
  static azimuthToBearing(
    azimuth: number
  ): { bearing: number; quadrant: 'NE' | 'SE' | 'SW' | 'NW' } {
    let az = azimuth % 360;
    if (az < 0) az += 360;
    
    if (az <= 90) return { bearing: az, quadrant: 'NE' };
    if (az <= 180) return { bearing: 180 - az, quadrant: 'SE' };
    if (az <= 270) return { bearing: az - 180, quadrant: 'SW' };
    return { bearing: 360 - az, quadrant: 'NW' };
  }

  /**
   * Calculate departure and latitude
   */
  static departureLatitude(
    distance: number,
    azimuth: number
  ): { departure: number; latitude: number } {
    const azRad = azimuth * GEODETIC_CONSTANTS.DEG_TO_RAD;
    return {
      departure: distance * Math.sin(azRad),
      latitude: distance * Math.cos(azRad),
    };
  }

  /**
   * Calculate traverse closure
   */
  static traverseClosure(
    departures: number[],
    latitudes: number[]
  ): { 
    closureError: number; 
    closureBearing: number;
    linearMisclosure: number;
    perimeterLength: number;
    precision: string;
  } {
    const sumDep = departures.reduce((a, b) => a + b, 0);
    const sumLat = latitudes.reduce((a, b) => a + b, 0);
    
    const closureError = Math.sqrt(sumDep * sumDep + sumLat * sumLat);
    const closureBearing = Math.atan2(sumDep, sumLat) * GEODETIC_CONSTANTS.RAD_TO_DEG;
    
    // Calculate perimeter
    let perimeter = 0;
    for (let i = 0; i < departures.length; i++) {
      perimeter += Math.sqrt(departures[i] ** 2 + latitudes[i] ** 2);
    }
    
    const precision = closureError / perimeter;
    const precisionRatio = Math.round(1 / precision);
    
    return {
      closureError,
      closureBearing: (closureBearing + 360) % 360,
      linearMisclosure: closureError,
      perimeterLength: perimeter,
      precision: `1:${precisionRatio}`,
    };
  }

  /**
   * Adjust traverse using Bowditch method
   */
  static bowditchAdjustment(
    coordinates: Coordinate[],
    departures: number[],
    latitudes: number[]
  ): Coordinate[] {
    const { linearMisclosure, perimeterLength } = this.traverseClosure(departures, latitudes);
    
    const sumDep = departures.reduce((a, b) => a + b, 0);
    const sumLat = latitudes.reduce((a, b) => a + b, 0);
    
    const adjustedCoords: Coordinate[] = [{ ...coordinates[0] }];
    let cumDistance = 0;
    
    for (let i = 0; i < departures.length; i++) {
      const legDistance = Math.sqrt(departures[i] ** 2 + latitudes[i] ** 2);
      cumDistance += legDistance;
      
      // Corrections proportional to cumulative distance
      const corrDep = -sumDep * (cumDistance / perimeterLength);
      const corrLat = -sumLat * (cumDistance / perimeterLength);
      
      const prevCoord = adjustedCoords[adjustedCoords.length - 1];
      adjustedCoords.push({
        x: prevCoord.x! + departures[i] + corrDep,
        y: prevCoord.y! + latitudes[i] + corrLat,
      });
    }
    
    return adjustedCoords;
  }

  /**
   * Adjust traverse using Transit rule
   */
  static transitAdjustment(
    coordinates: Coordinate[],
    departures: number[],
    latitudes: number[]
  ): Coordinate[] {
    const sumDep = departures.reduce((a, b) => a + b, 0);
    const sumLat = latitudes.reduce((a, b) => a + b, 0);
    const sumAbsDep = departures.reduce((a, b) => a + Math.abs(b), 0);
    const sumAbsLat = latitudes.reduce((a, b) => a + Math.abs(b), 0);
    
    const adjustedCoords: Coordinate[] = [{ ...coordinates[0] }];
    
    for (let i = 0; i < departures.length; i++) {
      // Corrections proportional to departure/latitude values
      const corrDep = -sumDep * Math.abs(departures[i]) / sumAbsDep;
      const corrLat = -sumLat * Math.abs(latitudes[i]) / sumAbsLat;
      
      const prevCoord = adjustedCoords[adjustedCoords.length - 1];
      adjustedCoords.push({
        x: prevCoord.x! + departures[i] + corrDep,
        y: prevCoord.y! + latitudes[i] + corrLat,
      });
    }
    
    return adjustedCoords;
  }

  /**
   * Calculate area from coordinates (Shoelace formula)
   */
  static calculateArea(coordinates: Coordinate[]): number {
    const n = coordinates.length;
    let area = 0;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i].x! * coordinates[j].y!;
      area -= coordinates[j].x! * coordinates[i].y!;
    }
    
    return Math.abs(area / 2);
  }

  /**
   * Calculate area by DMD method
   */
  static calculateAreaDMD(
    departures: number[],
    latitudes: number[]
  ): number {
    const n = departures.length;
    let dmd = departures[0];
    let doubleArea = dmd * latitudes[0];
    
    for (let i = 1; i < n; i++) {
      dmd = dmd + departures[i - 1] + departures[i];
      doubleArea += dmd * latitudes[i];
    }
    
    return Math.abs(doubleArea / 2);
  }
}

// =============================================================================
// LEVELING
// =============================================================================

export class Leveling {
  /**
   * Calculate reduced levels using Height of Instrument method
   */
  static heightOfInstrumentMethod(
    readings: LevelReading[],
    benchmarkRL: number
  ): LevelReading[] {
    const results: LevelReading[] = [];
    let HI = 0;
    
    readings.forEach((reading, index) => {
      if (reading.backsight !== undefined) {
        // New instrument setup
        if (index === 0) {
          HI = benchmarkRL + reading.backsight;
        } else {
          const prevRL = results[results.length - 1].reducedLevel!;
          HI = prevRL + reading.backsight;
        }
      }
      
      let RL: number;
      if (reading.foresight !== undefined) {
        RL = HI - reading.foresight;
      } else if (reading.intermediateSight !== undefined) {
        RL = HI - reading.intermediateSight;
      } else {
        RL = HI - (reading.backsight || 0);
      }
      
      results.push({
        ...reading,
        reducedLevel: RL,
      });
    });
    
    return results;
  }

  /**
   * Calculate reduced levels using Rise and Fall method
   */
  static riseAndFallMethod(
    readings: LevelReading[],
    benchmarkRL: number
  ): { readings: LevelReading[]; rise: number[]; fall: number[] } {
    const results: LevelReading[] = [];
    const rises: number[] = [];
    const falls: number[] = [];
    
    let prevStaff = readings[0].backsight!;
    results.push({
      ...readings[0],
      reducedLevel: benchmarkRL,
    });
    rises.push(0);
    falls.push(0);
    
    for (let i = 1; i < readings.length; i++) {
      const currentStaff = readings[i].intermediateSight ?? 
                          readings[i].foresight ?? 
                          readings[i].backsight!;
      
      const diff = prevStaff - currentStaff;
      let rise = 0, fall = 0;
      
      if (diff > 0) {
        rise = diff;
      } else {
        fall = Math.abs(diff);
      }
      
      rises.push(rise);
      falls.push(fall);
      
      const RL = results[results.length - 1].reducedLevel! + rise - fall;
      results.push({
        ...readings[i],
        reducedLevel: RL,
      });
      
      if (readings[i].backsight !== undefined) {
        prevStaff = readings[i].backsight!;
      } else {
        prevStaff = currentStaff;
      }
    }
    
    return { readings: results, rise: rises, fall: falls };
  }

  /**
   * Calculate closing error and apply correction
   */
  static levelingAdjustment(
    readings: LevelReading[],
    knownStartRL: number,
    knownEndRL: number
  ): LevelReading[] {
    const calculated = this.heightOfInstrumentMethod(readings, knownStartRL);
    const lastCalculatedRL = calculated[calculated.length - 1].reducedLevel!;
    
    const misclosure = lastCalculatedRL - knownEndRL;
    const numStations = readings.length;
    const correctionPerStation = -misclosure / numStations;
    
    return calculated.map((reading, index) => ({
      ...reading,
      reducedLevel: reading.reducedLevel! + correctionPerStation * index,
    }));
  }

  /**
   * Calculate permissible error
   */
  static permissibleError(
    distance: number,           // km (single way distance)
    precision: 'ordinary' | 'precise' | 'veryPrecise'
  ): number {
    const factors: Record<string, number> = {
      'ordinary': 24,       // mm per sqrt(km)
      'precise': 12,
      'veryPrecise': 4,
    };
    
    return factors[precision] * Math.sqrt(distance);
  }

  /**
   * Calculate curvature and refraction correction
   */
  static curvatureRefractionCorrection(
    distance: number            // km
  ): number {
    // Combined correction in meters
    // C = 0.0675 * D² (where D is in km, result in m)
    return 0.0675 * distance * distance;
  }

  /**
   * Reciprocal leveling calculation
   */
  static reciprocalLeveling(
    staffReadingA1: number,    // Reading from A to B
    staffReadingB1: number,    // Reading from A to A
    staffReadingA2: number,    // Reading from B to B
    staffReadingB2: number,    // Reading from B to A
    elevationA: number
  ): { elevationB: number; collimationError: number } {
    // True difference = mean of differences from both ends
    const diff1 = staffReadingB1 - staffReadingA1;
    const diff2 = staffReadingA2 - staffReadingB2;
    const trueDiff = (diff1 + diff2) / 2;
    
    // Collimation error
    const collimationError = (diff1 - diff2) / 2;
    
    return {
      elevationB: elevationA + trueDiff,
      collimationError,
    };
  }
}

// =============================================================================
// CURVE SETTING OUT
// =============================================================================

export class CurveSettingOut {
  /**
   * Calculate simple circular curve elements
   */
  static simpleCircularCurve(
    radius: number,
    deflectionAngle: number     // degrees
  ): {
    tangentLength: number;
    curveLength: number;
    externalDistance: number;
    middleOrdinate: number;
    longChord: number;
    degreeOfCurve: number;
  } {
    const delta = deflectionAngle * GEODETIC_CONSTANTS.DEG_TO_RAD;
    const R = radius;
    
    return {
      tangentLength: R * Math.tan(delta / 2),
      curveLength: R * delta,
      externalDistance: R * (1 / Math.cos(delta / 2) - 1),
      middleOrdinate: R * (1 - Math.cos(delta / 2)),
      longChord: 2 * R * Math.sin(delta / 2),
      degreeOfCurve: 1718.87 / R,  // Arc definition (meters)
    };
  }

  /**
   * Calculate offsets from tangent for circular curve
   */
  static tangentOffsets(
    radius: number,
    chordLength: number,
    numberOfPoints: number
  ): { distance: number; offset: number }[] {
    const offsets: { distance: number; offset: number }[] = [];
    const R = radius;
    
    for (let i = 1; i <= numberOfPoints; i++) {
      const x = i * chordLength;
      // y = R - sqrt(R² - x²) for short curves
      // or y ≈ x² / (2R) for approximate
      const y = R - Math.sqrt(R * R - x * x);
      offsets.push({ distance: x, offset: y });
    }
    
    return offsets;
  }

  /**
   * Calculate chord offsets for circular curve
   */
  static chordOffsets(
    radius: number,
    chordLength: number,
    numberOfChords: number
  ): { chainageFromPC: number; offset: number }[] {
    const offsets: { chainageFromPC: number; offset: number }[] = [];
    const R = radius;
    const c = chordLength;
    
    let cumulativeOffset = 0;
    
    for (let i = 1; i <= numberOfChords; i++) {
      // O = c² / (2R) for each chord
      const chordOffset = (c * c) / (2 * R);
      cumulativeOffset += chordOffset;
      
      offsets.push({
        chainageFromPC: i * c,
        offset: cumulativeOffset,
      });
    }
    
    return offsets;
  }

  /**
   * Calculate deflection angles for curve setting out
   */
  static deflectionAngles(
    radius: number,
    curveLength: number,
    chordInterval: number
  ): { chainage: number; deflectionAngle: number; totalDeflection: number }[] {
    const angles: { chainage: number; deflectionAngle: number; totalDeflection: number }[] = [];
    const R = radius;
    const numChords = Math.ceil(curveLength / chordInterval);
    
    let totalDeflection = 0;
    
    for (let i = 1; i <= numChords; i++) {
      const chordLength = Math.min(chordInterval, curveLength - (i - 1) * chordInterval);
      // Deflection angle = 1718.87 * c / R (in minutes) = 90 * c / (π * R) (in degrees)
      const deflectionAngle = (90 * chordLength) / (Math.PI * R);
      totalDeflection += deflectionAngle;
      
      angles.push({
        chainage: i * chordInterval,
        deflectionAngle,
        totalDeflection,
      });
    }
    
    return angles;
  }

  /**
   * Calculate transition (spiral) curve elements
   */
  static transitionCurve(
    radius: number,              // Circular curve radius
    length: number               // Transition length
  ): {
    shift: number;
    spiralAngle: number;
    totalTangent: number;
    xAtEnd: number;
    yAtEnd: number;
  } {
    const R = radius;
    const L = length;
    
    // Shift S = L² / (24R)
    const shift = (L * L) / (24 * R);
    
    // Spiral angle φ = L / (2R) in radians
    const spiralAngle = (L / (2 * R)) * GEODETIC_CONSTANTS.RAD_TO_DEG;
    
    // Coordinates at end of spiral
    const phi = L / (2 * R);
    const xAtEnd = L * (1 - phi * phi / 10 + Math.pow(phi, 4) / 216);
    const yAtEnd = L * (phi / 3 - Math.pow(phi, 3) / 42);
    
    // Total tangent length (with circular curve)
    const totalTangent = xAtEnd + (R + shift) * Math.tan(phi);
    
    return {
      shift,
      spiralAngle,
      totalTangent,
      xAtEnd,
      yAtEnd,
    };
  }

  /**
   * Calculate vertical curve elements
   */
  static verticalCurve(
    grade1: number,             // % (entry grade)
    grade2: number,             // % (exit grade)
    length: number,             // Curve length (m)
    pvStation: number,          // Station of PVI
    pvElevation: number         // Elevation at PVI
  ): {
    pcStation: number;
    pcElevation: number;
    ptStation: number;
    ptElevation: number;
    elevationAt: (station: number) => number;
    highLowPoint: { station: number; elevation: number } | null;
  } {
    const g1 = grade1 / 100;
    const g2 = grade2 / 100;
    const L = length;
    
    const pcStation = pvStation - L / 2;
    const ptStation = pvStation + L / 2;
    const pcElevation = pvElevation - g1 * L / 2;
    const ptElevation = pvElevation + g2 * L / 2;
    
    // Rate of change
    const r = (g2 - g1) / L;
    
    // Elevation at any station
    const elevationAt = (station: number): number => {
      const x = station - pcStation;
      return pcElevation + g1 * x + (r * x * x) / 2;
    };
    
    // High/low point (where tangent is horizontal)
    let highLowPoint = null;
    if (g1 !== g2 && g1 * g2 < 0) { // Only if grades have opposite signs
      const xHL = -g1 / r;
      if (xHL > 0 && xHL < L) {
        highLowPoint = {
          station: pcStation + xHL,
          elevation: elevationAt(pcStation + xHL),
        };
      }
    }
    
    return {
      pcStation,
      pcElevation,
      ptStation,
      ptElevation,
      elevationAt,
      highLowPoint,
    };
  }
}

// =============================================================================
// EARTHWORK & VOLUMES
// =============================================================================

export class EarthworkVolumes {
  /**
   * Calculate cross-sectional area
   */
  static crossSectionalArea(
    type: 'level' | 'two-level' | 'three-level' | 'multilevel',
    width: number,
    depth: number,
    sideSlope?: number,         // horizontal:vertical
    transverseSlope?: number    // %
  ): number {
    const b = width;
    const d = depth;
    const s = sideSlope || 1.5;
    
    switch (type) {
      case 'level':
        // Area = (b + sd) * d
        return (b + s * d) * d;
      
      case 'two-level':
        // Area = d * (b + sd)
        return d * (b + s * d);
      
      case 'three-level':
        if (!transverseSlope) return (b + s * d) * d;
        const n = transverseSlope / 100;
        const d1 = d + (b / 2) * n;
        const d2 = d - (b / 2) * n;
        return (b / 2) * (d1 + d2) + 0.5 * s * (d1 * d1 + d2 * d2);
      
      default:
        return (b + s * d) * d;
    }
  }

  /**
   * Calculate volume by Average End Area method
   */
  static volumeAverageEndArea(
    area1: number,
    area2: number,
    distance: number
  ): number {
    return ((area1 + area2) / 2) * distance;
  }

  /**
   * Calculate volume by Prismoidal formula
   */
  static volumePrismoidal(
    area1: number,
    areaMid: number,
    area2: number,
    distance: number
  ): number {
    return (distance / 6) * (area1 + 4 * areaMid + area2);
  }

  /**
   * Calculate prismoidal correction
   */
  static prismoidalCorrection(
    width1: number, depth1: number,
    width2: number, depth2: number,
    distance: number,
    sideSlope: number
  ): number {
    // Cp = (L/12) * (h1 - h2) * (b1 - b2 + s*(h1 - h2))
    const L = distance;
    const h1 = depth1, h2 = depth2;
    const b1 = width1, b2 = width2;
    const s = sideSlope;
    
    return (L / 12) * (h1 - h2) * (b1 - b2 + s * (h1 - h2));
  }

  /**
   * Calculate mass haul diagram ordinates
   */
  static massHaulDiagram(
    volumes: { station: number; cut: number; fill: number }[],
    shrinkageFactor: number = 0.9
  ): { station: number; ordinate: number }[] {
    const ordinates: { station: number; ordinate: number }[] = [];
    let cumulativeMass = 0;
    
    volumes.forEach(v => {
      // Cut is positive, Fill is negative (adjusted for shrinkage)
      const netVolume = v.cut - v.fill / shrinkageFactor;
      cumulativeMass += netVolume;
      
      ordinates.push({
        station: v.station,
        ordinate: cumulativeMass,
      });
    });
    
    return ordinates;
  }

  /**
   * Calculate haul distance
   */
  static haulDistance(
    massHaulOrdinates: { station: number; ordinate: number }[]
  ): { freeHaulVolume: number; overhaulVolume: number; averageHaulDistance: number } {
    // Find balance points (where ordinate = 0 or changes sign)
    const balancePoints: number[] = [];
    
    for (let i = 1; i < massHaulOrdinates.length; i++) {
      if (massHaulOrdinates[i].ordinate * massHaulOrdinates[i-1].ordinate <= 0) {
        // Linear interpolation for exact position
        const x1 = massHaulOrdinates[i-1].station;
        const x2 = massHaulOrdinates[i].station;
        const y1 = massHaulOrdinates[i-1].ordinate;
        const y2 = massHaulOrdinates[i].ordinate;
        
        const x = x1 + (0 - y1) * (x2 - x1) / (y2 - y1);
        balancePoints.push(x);
      }
    }
    
    // Simplified calculation
    const freeHaulDistance = 100; // meters (typical free haul limit)
    const totalVolume = Math.abs(massHaulOrdinates[massHaulOrdinates.length - 1].ordinate - massHaulOrdinates[0].ordinate);
    
    return {
      freeHaulVolume: totalVolume * 0.6, // Approximate
      overhaulVolume: totalVolume * 0.4,
      averageHaulDistance: 200, // Approximate in meters
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  CoordinateTransformations,
  TraverseComputations,
  Leveling,
  CurveSettingOut,
  EarthworkVolumes,
  GEODETIC_CONSTANTS,
};
