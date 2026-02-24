/**
 * PatternLoadingService.ts
 * 
 * Automatic Pattern Load Generation for Code Compliance
 * 
 * Features:
 * - Checkerboard pattern generation
 * - Alternate span loading
 * - Adjacent span loading
 * - Maximum effect combinations
 * - AI-assisted pattern optimization
 */

// ============================================
// TYPES
// ============================================

export type PatternType =
    | 'checkerboard'       // Alternating spans
    | 'adjacent'           // Two adjacent spans loaded
    | 'alternate'          // Every other span
    | 'all_spans'          // All spans loaded
    | 'skip_one'           // Skip every other span
    | 'max_moment_positive' // Pattern for max positive moment
    | 'max_moment_negative' // Pattern for max negative moment
    | 'max_shear';          // Pattern for max shear at support

export interface SpanInfo {
    spanId: string;
    startNode: string;
    endNode: string;
    length: number;
    level?: string;
    bay?: string;
}

export interface PatternLoadCase {
    id: string;
    name: string;
    patternType: PatternType;
    loadedSpans: string[];
    unloadedSpans: string[];
    loadType: 'live' | 'roof_live' | 'snow';
    loadMagnitude: number;
    purpose: string;
}

export interface PatternCombination {
    id: string;
    name: string;
    description: string;
    patterns: PatternLoadCase[];
    governingEffect: 'max_positive_moment' | 'max_negative_moment' | 'max_reaction' | 'max_deflection';
}

export interface PatternAnalysisResult {
    patternCaseId: string;
    patternName: string;
    criticalLocation: string;
    maxPositiveMoment?: number;
    maxNegativeMoment?: number;
    maxShear?: number;
    maxDeflection?: number;
    isGoverning: boolean;
}

// ============================================
// PATTERN LOADING SERVICE
// ============================================

class PatternLoadingServiceClass {
    /**
     * Generate all required pattern load cases for a continuous beam/slab
     */
    generatePatternCases(
        spans: SpanInfo[],
        liveLoadMagnitude: number,
        loadType: 'live' | 'roof_live' | 'snow' = 'live'
    ): PatternLoadCase[] {
        const patterns: PatternLoadCase[] = [];
        const numSpans = spans.length;
        const spanIds = spans.map(s => s.spanId);

        // 1. All spans loaded (baseline)
        patterns.push({
            id: 'pattern_all',
            name: 'All Spans Loaded',
            patternType: 'all_spans',
            loadedSpans: [...spanIds],
            unloadedSpans: [],
            loadType,
            loadMagnitude: liveLoadMagnitude,
            purpose: 'Baseline - all spans loaded uniformly'
        });

        // 2. Checkerboard patterns (for max positive moments at midspan)
        // Pattern A: Odd spans loaded
        const oddSpans = spanIds.filter((_, i) => i % 2 === 0);
        const evenSpans = spanIds.filter((_, i) => i % 2 === 1);

        patterns.push({
            id: 'pattern_odd',
            name: 'Odd Spans Loaded',
            patternType: 'checkerboard',
            loadedSpans: oddSpans,
            unloadedSpans: evenSpans,
            loadType,
            loadMagnitude: liveLoadMagnitude,
            purpose: 'Max positive moment in odd spans'
        });

        // Pattern B: Even spans loaded
        if (evenSpans.length > 0) {
            patterns.push({
                id: 'pattern_even',
                name: 'Even Spans Loaded',
                patternType: 'checkerboard',
                loadedSpans: evenSpans,
                unloadedSpans: oddSpans,
                loadType,
                loadMagnitude: liveLoadMagnitude,
                purpose: 'Max positive moment in even spans'
            });
        }

        // 3. Adjacent span patterns (for max negative moment at supports)
        for (let i = 0; i < numSpans - 1; i++) {
            const adjacentPair = [spanIds[i], spanIds[i + 1]];
            const otherSpans = spanIds.filter(s => !adjacentPair.includes(s));

            patterns.push({
                id: `pattern_adj_${i}_${i + 1}`,
                name: `Adjacent Spans ${i + 1}-${i + 2}`,
                patternType: 'adjacent',
                loadedSpans: adjacentPair,
                unloadedSpans: otherSpans,
                loadType,
                loadMagnitude: liveLoadMagnitude,
                purpose: `Max negative moment at support between span ${i + 1} and ${i + 2}`
            });
        }

        // 4. Single span loaded (for max positive moment when other spans unloaded)
        for (let i = 0; i < numSpans; i++) {
            const singleSpan = [spanIds[i]];
            const otherSpans = spanIds.filter(s => s !== spanIds[i]);

            patterns.push({
                id: `pattern_single_${i}`,
                name: `Span ${i + 1} Only`,
                patternType: 'max_moment_positive',
                loadedSpans: singleSpan,
                unloadedSpans: otherSpans,
                loadType,
                loadMagnitude: liveLoadMagnitude,
                purpose: `Isolated loading on span ${i + 1}`
            });
        }

        // 5. Skip patterns for longer continuous systems
        if (numSpans >= 4) {
            // Every third span loaded
            const thirdSpans = spanIds.filter((_, i) => i % 3 === 0);
            const otherThird = spanIds.filter((_, i) => i % 3 !== 0);

            patterns.push({
                id: 'pattern_every_third',
                name: 'Every Third Span',
                patternType: 'skip_one',
                loadedSpans: thirdSpans,
                unloadedSpans: otherThird,
                loadType,
                loadMagnitude: liveLoadMagnitude,
                purpose: 'Pattern for long continuous systems'
            });
        }

        return patterns;
    }

    /**
     * Generate pattern load cases for 2D slab (floor plate)
     */
    generateSlabPatterns(
        bays: { xBays: string[]; yBays: string[] },
        liveLoad: number
    ): PatternLoadCase[] {
        const patterns: PatternLoadCase[] = [];
        const { xBays, yBays } = bays;

        // Create panel identifiers
        const panels: string[] = [];
        for (let i = 0; i < xBays.length; i++) {
            for (let j = 0; j < yBays.length; j++) {
                panels.push(`P_${xBays[i]}_${yBays[j]}`);
            }
        }

        // 1. All panels loaded
        patterns.push({
            id: 'slab_all',
            name: 'All Panels Loaded',
            patternType: 'all_spans',
            loadedSpans: [...panels],
            unloadedSpans: [],
            loadType: 'live',
            loadMagnitude: liveLoad,
            purpose: 'Baseline - all panels loaded'
        });

        // 2. Checkerboard pattern (true 2D)
        const checkerA: string[] = [];
        const checkerB: string[] = [];

        for (let i = 0; i < xBays.length; i++) {
            for (let j = 0; j < yBays.length; j++) {
                const panelId = `P_${xBays[i]}_${yBays[j]}`;
                if ((i + j) % 2 === 0) {
                    checkerA.push(panelId);
                } else {
                    checkerB.push(panelId);
                }
            }
        }

        patterns.push({
            id: 'slab_checker_a',
            name: 'Checkerboard A',
            patternType: 'checkerboard',
            loadedSpans: checkerA,
            unloadedSpans: checkerB,
            loadType: 'live',
            loadMagnitude: liveLoad,
            purpose: '2D checkerboard pattern A'
        });

        patterns.push({
            id: 'slab_checker_b',
            name: 'Checkerboard B',
            patternType: 'checkerboard',
            loadedSpans: checkerB,
            unloadedSpans: checkerA,
            loadType: 'live',
            loadMagnitude: liveLoad,
            purpose: '2D checkerboard pattern B'
        });

        // 3. Strip patterns (load entire X-strips or Y-strips)
        for (let i = 0; i < xBays.length; i++) {
            const strip = yBays.map(y => `P_${xBays[i]}_${y}`);
            const others = panels.filter(p => !strip.includes(p));

            patterns.push({
                id: `slab_xstrip_${i}`,
                name: `X-Strip ${i + 1}`,
                patternType: 'adjacent',
                loadedSpans: strip,
                unloadedSpans: others,
                loadType: 'live',
                loadMagnitude: liveLoad,
                purpose: `Load strip along X-direction, bay ${i + 1}`
            });
        }

        for (let j = 0; j < yBays.length; j++) {
            const strip = xBays.map(x => `P_${x}_${yBays[j]}`);
            const others = panels.filter(p => !strip.includes(p));

            patterns.push({
                id: `slab_ystrip_${j}`,
                name: `Y-Strip ${j + 1}`,
                patternType: 'adjacent',
                loadedSpans: strip,
                unloadedSpans: others,
                loadType: 'live',
                loadMagnitude: liveLoad,
                purpose: `Load strip along Y-direction, bay ${j + 1}`
            });
        }

        return patterns;
    }

    /**
     * Identify governing patterns from analysis results
     */
    identifyGoverningPatterns(
        results: PatternAnalysisResult[]
    ): {
        maxPositiveMoment: PatternAnalysisResult | null;
        maxNegativeMoment: PatternAnalysisResult | null;
        maxShear: PatternAnalysisResult | null;
        maxDeflection: PatternAnalysisResult | null;
    } {
        let maxPosM: PatternAnalysisResult | null = null;
        let maxNegM: PatternAnalysisResult | null = null;
        let maxV: PatternAnalysisResult | null = null;
        let maxD: PatternAnalysisResult | null = null;

        for (const r of results) {
            if (r.maxPositiveMoment !== undefined) {
                if (!maxPosM || r.maxPositiveMoment > maxPosM.maxPositiveMoment!) {
                    maxPosM = r;
                }
            }
            if (r.maxNegativeMoment !== undefined) {
                if (!maxNegM || Math.abs(r.maxNegativeMoment) > Math.abs(maxNegM.maxNegativeMoment!)) {
                    maxNegM = r;
                }
            }
            if (r.maxShear !== undefined) {
                if (!maxV || Math.abs(r.maxShear) > Math.abs(maxV.maxShear!)) {
                    maxV = r;
                }
            }
            if (r.maxDeflection !== undefined) {
                if (!maxD || r.maxDeflection > maxD.maxDeflection!) {
                    maxD = r;
                }
            }
        }

        return {
            maxPositiveMoment: maxPosM,
            maxNegativeMoment: maxNegM,
            maxShear: maxV,
            maxDeflection: maxD
        };
    }

    /**
     * Generate pattern combinations for envelope analysis
     */
    generateEnvelopeCombinations(
        patterns: PatternLoadCase[],
        deadLoadFactor: number = 1.2,
        liveLoadFactor: number = 1.6
    ): PatternCombination[] {
        const combinations: PatternCombination[] = [];

        // Group by pattern type
        const checkerboards = patterns.filter(p => p.patternType === 'checkerboard');
        const adjacents = patterns.filter(p => p.patternType === 'adjacent');

        // Create envelope for max positive moment
        combinations.push({
            id: 'env_pos_moment',
            name: 'Max Positive Moment Envelope',
            description: `${deadLoadFactor}D + ${liveLoadFactor}L (checkerboard patterns)`,
            patterns: [patterns.find(p => p.patternType === 'all_spans')!, ...checkerboards],
            governingEffect: 'max_positive_moment'
        });

        // Create envelope for max negative moment
        combinations.push({
            id: 'env_neg_moment',
            name: 'Max Negative Moment Envelope',
            description: `${deadLoadFactor}D + ${liveLoadFactor}L (adjacent span patterns)`,
            patterns: [patterns.find(p => p.patternType === 'all_spans')!, ...adjacents],
            governingEffect: 'max_negative_moment'
        });

        return combinations;
    }

    /**
     * AI-assisted optimal pattern identification
     */
    async suggestCriticalPatterns(
        spans: SpanInfo[],
        targetEffect: 'moment' | 'shear' | 'reaction'
    ): Promise<PatternLoadCase[]> {
        // In production, would use AI to determine most critical patterns
        // based on span ratios, support conditions, etc.

        const basePatterns = this.generatePatternCases(spans, 1.0);

        // Heuristic: For moment, suggest checkerboards
        // For shear/reaction, suggest adjacent patterns
        if (targetEffect === 'moment') {
            return basePatterns.filter(p =>
                p.patternType === 'checkerboard' || p.patternType === 'all_spans'
            );
        } else {
            return basePatterns.filter(p =>
                p.patternType === 'adjacent' || p.patternType === 'all_spans'
            );
        }
    }

    /**
     * Export patterns to load combination format
     */
    exportToLoadCases(
        patterns: PatternLoadCase[],
        deadLoad: number,
        deadLoadFactor: number = 1.2,
        liveLoadFactor: number = 1.6
    ): Array<{ name: string; loads: Array<{ spanId: string; magnitude: number }> }> {
        const loadCases: Array<{ name: string; loads: Array<{ spanId: string; magnitude: number }> }> = [];

        for (const pattern of patterns) {
            const loads: Array<{ spanId: string; magnitude: number }> = [];

            // Apply dead load to all spans
            for (const spanId of [...pattern.loadedSpans, ...pattern.unloadedSpans]) {
                loads.push({ spanId, magnitude: deadLoad * deadLoadFactor });
            }

            // Apply live load only to loaded spans
            for (const spanId of pattern.loadedSpans) {
                loads.push({ spanId, magnitude: pattern.loadMagnitude * liveLoadFactor });
            }

            loadCases.push({
                name: `LC_${pattern.id}`,
                loads
            });
        }

        return loadCases;
    }
}

// ============================================
// SINGLETON
// ============================================

export const patternLoading = new PatternLoadingServiceClass();

export default PatternLoadingServiceClass;
