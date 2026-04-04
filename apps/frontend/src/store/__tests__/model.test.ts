/**
 * model.test.ts — Zustand model store tests
 *
 * Tests the core actions of useModelStore: node/member CRUD,
 * selection management, tool switching, load cases, and project info.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '@/store/model';

// Helper to reset the store to a clean state before every test
function resetStore() {
  useModelStore.setState({
    nodes: new Map(),
    members: new Map(),
    plates: new Map(),
    loads: [],
    memberLoads: [],
    floorLoads: [],
    loadCases: [],
    loadCombinations: [],
    activeLoadCaseId: null,
    selectedIds: new Set(),
    errorElementIds: new Set(),
    analysisResults: null,
    isAnalyzing: false,
    nextNodeNumber: 1,
    nextMemberNumber: 1,
    nextPlateNumber: 1,
    clipboard: null,
    civilData: new Map(),
    projectInfo: {
      name: 'Structure 1',
      client: '',
      engineer: '',
      jobNo: '',
      rev: '0',
      date: new Date(),
      description: '',
    },
    activeTool: null,
    showSFD: false,
    showBMD: false,
    showAFD: false,
    showBMDMy: false,
    showShearZ: false,
    showStressOverlay: false,
    showDeflectedShape: false,
    diagramScale: 0.05,
    showResults: false,
    modalResults: null,
    activeModeIndex: 0,
    modeAmplitude: 1.0,
    isAnimating: false,
  });
}

describe('useModelStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ──────────────────────────────────────────
  // Node operations
  // ──────────────────────────────────────────

  describe('addNode / removeNode', () => {
    it('adds a node to the store', () => {
      const { addNode } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });

      const nodes = useModelStore.getState().nodes;
      expect(nodes.size).toBe(1);
      expect(nodes.get('N1')).toEqual({ id: 'N1', x: 0, y: 0, z: 0 });
    });

    it('adds multiple nodes independently', () => {
      const { addNode } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      addNode({ id: 'N2', x: 5, y: 0, z: 0 });

      expect(useModelStore.getState().nodes.size).toBe(2);
    });

    it('removes a node by id', () => {
      const { addNode, removeNode } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      removeNode('N1');

      expect(useModelStore.getState().nodes.size).toBe(0);
    });

    it('cascade-deletes members connected to a removed node', () => {
      const { addNode, addMember, removeNode } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      addNode({ id: 'N2', x: 5, y: 0, z: 0 });
      addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2' });

      removeNode('N1');

      expect(useModelStore.getState().nodes.size).toBe(1);
      expect(useModelStore.getState().members.size).toBe(0);
    });

    it('removes the node from selectedIds when deleted', () => {
      const { addNode, select, removeNode } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      select('N1', false);
      expect(useModelStore.getState().selectedIds.has('N1')).toBe(true);

      removeNode('N1');
      expect(useModelStore.getState().selectedIds.has('N1')).toBe(false);
    });

    it('generates the next node ID based on existing IDs and gaps', () => {
      const { addNode, getNextNodeId } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      addNode({ id: 'N3', x: 1, y: 0, z: 0 });

      expect(getNextNodeId()).toBe('N2');
      expect(getNextNodeId()).toBe('N4');
    });

    it('adds a member with default material properties', () => {
      const { addNode, addMember } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      addNode({ id: 'N2', x: 5, y: 0, z: 0 });
      addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2' });

      const member = useModelStore.getState().members.get('M1');
      expect(member).toBeDefined();
      expect(member!.sectionId).toBe('Default');
      expect(member!.E).toBe(200e6);
      expect(member!.A).toBe(0.01);
      expect(member!.I).toBe(1e-4);
    });

    it('removes a member by id', () => {
      const { addNode, addMember, removeMember } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      addNode({ id: 'N2', x: 5, y: 0, z: 0 });
      addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2' });
      removeMember('M1');

      expect(useModelStore.getState().members.size).toBe(0);
    });

    it('preserves custom material properties on addMember', () => {
      const { addNode, addMember } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      addNode({ id: 'N2', x: 5, y: 0, z: 0 });
      addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2', E: 30e6, A: 0.05, I: 5e-4 });

      const member = useModelStore.getState().members.get('M1');
      expect(member!.E).toBe(30e6);
      expect(member!.A).toBe(0.05);
      expect(member!.I).toBe(5e-4);
    });
  });

  // ──────────────────────────────────────────
  // Selection
  // ──────────────────────────────────────────

  describe('select / clearSelection', () => {
    it('selects a single element (non-multi replaces)', () => {
      const { addNode, select } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      addNode({ id: 'N2', x: 5, y: 0, z: 0 });

      select('N1', false);
      expect(useModelStore.getState().selectedIds.size).toBe(1);
      expect(useModelStore.getState().selectedIds.has('N1')).toBe(true);

      select('N2', false);
      expect(useModelStore.getState().selectedIds.size).toBe(1);
      expect(useModelStore.getState().selectedIds.has('N2')).toBe(true);
    });

    it('multi-select adds to existing selection', () => {
      const { addNode, select } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      addNode({ id: 'N2', x: 5, y: 0, z: 0 });

      select('N1', false);
      select('N2', true);
      expect(useModelStore.getState().selectedIds.size).toBe(2);
    });

    it('multi-select toggles off if already selected', () => {
      const { addNode, select } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });

      select('N1', false);
      select('N1', true);
      expect(useModelStore.getState().selectedIds.has('N1')).toBe(false);
    });

    it('clearSelection empties the set', () => {
      const { addNode, select, clearSelection } = useModelStore.getState();
      addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      select('N1', false);
      clearSelection();

      expect(useModelStore.getState().selectedIds.size).toBe(0);
    });
  });

  // ──────────────────────────────────────────
  // Tool switching
  // ──────────────────────────────────────────

  describe('setTool', () => {
    it('sets the active tool', () => {
      useModelStore.getState().setTool('node');
      expect(useModelStore.getState().activeTool).toBe('node');
    });

    it('switches between tools', () => {
      const { setTool } = useModelStore.getState();
      setTool('node');
      setTool('member');
      expect(useModelStore.getState().activeTool).toBe('member');
    });

    it('sets tool to null', () => {
      const { setTool } = useModelStore.getState();
      setTool('node');
      setTool(null);
      expect(useModelStore.getState().activeTool).toBeNull();
    });
  });

  // ──────────────────────────────────────────
  // Load case management
  // ──────────────────────────────────────────

  describe('setActiveLoadCase', () => {
    it('sets the active load case id', () => {
      useModelStore.getState().setActiveLoadCase('lc1');
      expect(useModelStore.getState().activeLoadCaseId).toBe('lc1');
    });

    it('clears active load case with null', () => {
      useModelStore.getState().setActiveLoadCase('lc1');
      useModelStore.getState().setActiveLoadCase(null);
      expect(useModelStore.getState().activeLoadCaseId).toBeNull();
    });
  });

  // ──────────────────────────────────────────
  // Project info
  // ──────────────────────────────────────────

  describe('setProjectInfo', () => {
    it('updates partial project info fields', () => {
      useModelStore.getState().setProjectInfo({ name: 'Bridge A' });
      expect(useModelStore.getState().projectInfo.name).toBe('Bridge A');
      // Other fields remain unchanged
      expect(useModelStore.getState().projectInfo.rev).toBe('0');
    });

    it('updates multiple fields at once', () => {
      useModelStore.getState().setProjectInfo({
        name: 'Tower B',
        client: 'ACME Corp',
        engineer: 'J. Smith',
      });
      const info = useModelStore.getState().projectInfo;
      expect(info.name).toBe('Tower B');
      expect(info.client).toBe('ACME Corp');
      expect(info.engineer).toBe('J. Smith');
    });
  });

  // ──────────────────────────────────────────
  // Loads
  // ──────────────────────────────────────────

  describe('addLoad / removeLoad', () => {
    it('adds a node load', () => {
      useModelStore.getState().addLoad({
        id: 'L1',
        nodeId: 'N1',
        fy: -10,
      });
      expect(useModelStore.getState().loads).toHaveLength(1);
      expect(useModelStore.getState().loads[0].fy).toBe(-10);
    });

    it('removes a load by id', () => {
      useModelStore.getState().addLoad({ id: 'L1', nodeId: 'N1', fy: -10 });
      useModelStore.getState().removeLoad('L1');
      expect(useModelStore.getState().loads).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────
  // Analysis state
  // ──────────────────────────────────────────

  describe('setIsAnalyzing', () => {
    it('sets analyzing state', () => {
      useModelStore.getState().setIsAnalyzing(true);
      expect(useModelStore.getState().isAnalyzing).toBe(true);
      useModelStore.getState().setIsAnalyzing(false);
      expect(useModelStore.getState().isAnalyzing).toBe(false);
    });
  });

  // ──────────────────────────────────────────
  // Error element IDs
  // ──────────────────────────────────────────

  describe('setErrorElementIds / clearErrorElementIds', () => {
    it('sets and clears error element IDs', () => {
      useModelStore.getState().setErrorElementIds(['M1', 'M2']);
      expect(useModelStore.getState().errorElementIds.size).toBe(2);

      useModelStore.getState().clearErrorElementIds();
      expect(useModelStore.getState().errorElementIds.size).toBe(0);
    });
  });

  // ──────────────────────────────────────────
  // Geometry operations (repeat + auto-noding)
  // ──────────────────────────────────────────

  describe('applyCircularRepeat', () => {
    it('creates rotational copies and link members', () => {
      const store = useModelStore.getState();

      store.addNode({ id: 'N1', x: 1, y: 0, z: 0 });
      store.addNode({ id: 'N2', x: 2, y: 0, z: 0 });
      store.addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2' });

      const result = store.applyCircularRepeat({
        nodeIds: ['N1', 'N2'],
        memberIds: ['M1'],
        axis: { x: 0, y: 1, z: 0 },
        center_m: { x: 0, y: 0, z: 0 },
        angleDeg: 90,
        steps: 3,
        linkSteps: true,
        closeLoop: true,
      });

      expect(result.createdNodeIds.length).toBe(6); // 2 nodes × 3 copies
      expect(result.createdMemberIds.length).toBe(9); // 3 clones + (2 nodes × (2 links + 1 close))
      expect(useModelStore.getState().members.size).toBe(10); // original + created
    });
  });

  describe('detectAndAutoNode', () => {
    it('splits intersecting members and injects shared node', () => {
      const store = useModelStore.getState();

      store.addNode({ id: 'N1', x: 0, y: 0, z: 0 });
      store.addNode({ id: 'N2', x: 2, y: 0, z: 0 });
      store.addNode({ id: 'N3', x: 1, y: -1, z: 0 });
      store.addNode({ id: 'N4', x: 1, y: 1, z: 0 });

      store.addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2' });
      store.addMember({ id: 'M2', startNodeId: 'N3', endNodeId: 'N4' });

      const result = store.detectAndAutoNode(1e-6);

      expect(result.intersectionCount).toBe(1);
      expect(result.createdNodeIds.length).toBe(1);
      expect(result.deletedMemberIds.length).toBe(2);
      expect(result.createdMemberIds.length).toBe(4);
      expect(useModelStore.getState().members.size).toBe(4);
    });
  });
});
