import { describe, it, expect } from 'vitest';
import { construction, Activity } from '../ConstructionManagementService';

describe('ConstructionManagementService', () => {
    describe('calculateCPM', () => {
        it('should calculate critical path correctly for simple project', () => {
            const activities: Activity[] = [
                { id: 'A', name: 'Start', duration: 3, predecessors: [] },
                { id: 'B', name: 'Task B', duration: 5, predecessors: ['A'] },
                { id: 'C', name: 'Task C', duration: 2, predecessors: ['A'] },
                { id: 'D', name: 'End', duration: 4, predecessors: ['B', 'C'] },
            ];

            const result = construction.calculateCPM(activities);

            expect(result.projectDuration).toBe(12); // 3 + 5 + 4
            expect(result.criticalPath).toContain('A');
            expect(result.criticalPath).toContain('B');
            expect(result.criticalPath).toContain('D');
            expect(result.criticalPath).not.toContain('C');
        });

        it('should calculate float correctly', () => {
            const activities: Activity[] = [
                { id: 'A', name: 'Start', duration: 3, predecessors: [] },
                { id: 'B', name: 'Critical', duration: 5, predecessors: ['A'] },
                { id: 'C', name: 'Slack', duration: 2, predecessors: ['A'] },
                { id: 'D', name: 'End', duration: 4, predecessors: ['B', 'C'] },
            ];

            const result = construction.calculateCPM(activities);

            // Path A-B-D = 12
            // Path A-C-D = 9
            // C has float of 12 - 9 = 3

            const schedC = result.activities.find(a => a.id === 'C');
            expect(schedC?.TF).toBe(3);
        });
    });

    describe('createEstimate', () => {
        it('should calculate totals correctly', () => {
            const items = [
                { id: '1', description: 'Item 1', unit: 'm3', quantity: 10, unitRate: 100, category: 'concrete' as const },
                { id: '2', description: 'Item 2', unit: 'm2', quantity: 5, unitRate: 200, category: 'finishes' as const }
            ];

            const estimate = construction.createEstimate(items);

            expect(estimate.totalDirect).toBe(2000); // 1000 + 1000
            expect(estimate.grandTotal).toBeGreaterThan(2000); // Includes overhead
        });
    });
});
