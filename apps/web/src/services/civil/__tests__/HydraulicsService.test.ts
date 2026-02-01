import { describe, it, expect } from 'vitest';
import { hydraulics } from '../HydraulicsService';

describe('HydraulicsService', () => {
    describe('calculateOpenChannelFlow', () => {
        it('should calculate flow properties for rectangular channel', () => {
            const geometry = { type: 'rectangular' as const, baseWidth: 4, depth: 2 };
            const props = { manningN: 0.025, bedSlope: 0.001 };

            const result = hydraulics.calculateOpenChannelFlow(geometry, props);

            expect(result.area).toBe(8); // 4 * 2
            expect(result.wettedPerimeter).toBe(8); // 4 + 2 + 2
            expect(result.velocity).toBeGreaterThan(0);
            expect(result.discharge).toBeGreaterThan(0);
            expect(result.flowRegime).toMatch(/subcritical|critical|supercritical/);
        });
    });

    describe('calculatePipeFlowHW', () => {
        it('should calculate head loss using Hazen-Williams', () => {
            const input = {
                diameter: 300, // mm
                length: 100, // m
                pipeType: 'PVC' as const,
                discharge: 50 // L/s
            };

            const result = hydraulics.calculatePipeFlowHW(input);

            expect(result.velocity).toBeGreaterThan(0);
            expect(result.headLoss).toBeGreaterThan(0);
            expect(result.flowType).toBe('turbulent');
        });
    });

    describe('calculateStormDrainage', () => {
        it('should return rational method discharge', () => {
            const input = {
                catchmentArea: 10, // ha
                runoffCoefficient: 0.8,
                timeOfConcentration: 15,
                returnPeriod: 5,
                region: 'Test'
            };

            const result = hydraulics.calculateStormDrainage(input);

            expect(result.peakDischarge).toBeGreaterThan(0);
            expect(result.drainSize).toBeGreaterThan(0);
        });
    });
});
