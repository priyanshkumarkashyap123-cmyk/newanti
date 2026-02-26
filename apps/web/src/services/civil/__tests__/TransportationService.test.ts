import { describe, it, expect } from 'vitest';
import { transportation } from '../TransportationService';

describe('TransportationService', () => {
    describe('designHorizontalCurve', () => {
        it('should calculate curve properties correctly', () => {
            const result = transportation.designHorizontalCurve(100, 45, 7);

            expect(result.designSpeed).toBe(100);
            expect(result.radius).toBeGreaterThan(0);
            expect(result.superelevation).toBeLessThanOrEqual(7);
            expect(result.transitionLength).toBeGreaterThan(0);
        });

        it('should respect minimum radius constraints', () => {
            const resultLowSpeed = transportation.designHorizontalCurve(30, 45);
            const resultHighSpeed = transportation.designHorizontalCurve(100, 45);

            expect(resultLowSpeed.radius).toBeLessThan(resultHighSpeed.radius);
        });
    });

    describe('calculateSSD', () => {
        it('should calculate SSD correctly', () => {
            const ssd = transportation.calculateSSD(80, 0); // 80 km/h, flat
            // d1 = 80 * 2.5 / 3.6 = 55.55
            // d2 = 80^2 / (254 * 0.35) = 72.0
            // SSD ≈ 127.5
            expect(ssd).toBeGreaterThan(120);
            expect(ssd).toBeLessThan(140);
        });

        it('should increase SSD for downhill gradients', () => {
            const flat = transportation.calculateSSD(80, 0);
            const downhill = transportation.calculateSSD(80, -3); // 3% downhill
            expect(downhill).toBeGreaterThan(flat);
        });
    });

    describe('designPavement', () => {
        it('should return flexible pavement design', () => {
            const traffic = {
                ADT: 2000,
                AADT: 2000,
                peakHourFactor: 0.1,
                growthRate: 5,
                truckPercentage: 15,
                designPeriod: 15
            };

            const design = transportation.designPavement(traffic, 5, 'flexible');

            expect(design.type).toBe('flexible');
            expect(design.layers.length).toBeGreaterThan(0);
            expect(design.totalThickness).toBeGreaterThan(0);
            expect(design.trafficMSA).toBeGreaterThan(0);
        });
    });
});
