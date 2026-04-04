import {
  FloorPlan,
  StructuralPlan,
  PlotDimensions,
  SetbackRequirements,
  ElevationView,
  ElevationElement,
  DimensionLine,
  TextLabel,
  SectionLine,
  ViewType
} from './types';

export function buildFrontElevation(
  floorPlans: FloorPlan[],
  structural: StructuralPlan,
  plot: PlotDimensions,
  setbacks: SetbackRequirements
): ElevationView {
  const elements: ElevationElement[] = [];
  const dimensions: DimensionLine[] = [];
  const labels: TextLabel[] = [];

  const buildableWidth = plot.width - setbacks.left - setbacks.right;
  const foundationDepth = 1.5;
  const plinthHeight = 0.6;
  let currentHeight = plinthHeight;

  // Foundation
  elements.push({
    type: 'foundation',
    points: [
      { x: 0, y: -foundationDepth },
      { x: buildableWidth, y: -foundationDepth },
      { x: buildableWidth, y: 0 },
      { x: 0, y: 0 },
    ],
    fill: '#9CA3AF', stroke: '#374151', lineWeight: 0.5, hatch: 'concrete',
  });

  // Plinth
  elements.push({
    type: 'plinth',
    points: [
      { x: 0, y: 0 }, { x: buildableWidth, y: 0 },
      { x: buildableWidth, y: plinthHeight }, { x: 0, y: plinthHeight },
    ],
    fill: '#D1D5DB', stroke: '#374151', lineWeight: 0.7,
  });

  for (const plan of floorPlans) {
    const floorTop = currentHeight + plan.floorHeight;

    // Wall outline
    elements.push({
      type: 'wall',
      points: [
        { x: 0, y: currentHeight }, { x: buildableWidth, y: currentHeight },
        { x: buildableWidth, y: floorTop }, { x: 0, y: floorTop },
      ],
      fill: '#FEF3C7', stroke: '#374151', lineWeight: 0.5,
    });

    // Front-facing rooms: y close to setbacks.front
    const frontRooms = plan.rooms.filter(r => r.y <= setbacks.front + 0.5);
    for (const room of frontRooms) {
      const roomX = room.x - setbacks.left;
      // Per-room width dimension
      dimensions.push({
        startX: roomX, startY: -foundationDepth - 0.3,
        endX: roomX + room.width, endY: -foundationDepth - 0.3,
        value: `${room.width.toFixed(2)}m`, offset: 0.3, type: 'linear',
      });
      // Windows
      for (const win of room.windows.filter(w => w.wallSide === 'S')) {
        elements.push({
          type: 'window',
          points: [
            { x: roomX + win.position, y: currentHeight + win.sillHeight },
            { x: roomX + win.position + win.width, y: currentHeight + win.sillHeight },
            { x: roomX + win.position + win.width, y: currentHeight + win.sillHeight + win.height },
            { x: roomX + win.position, y: currentHeight + win.sillHeight + win.height },
          ],
          fill: '#BFDBFE', stroke: '#1E40AF', lineWeight: 0.3,
        });
      }
      // Doors
      for (const door of room.doors.filter(d => d.wallSide === 'S')) {
        elements.push({
          type: 'door',
          points: [
            { x: roomX + door.position, y: currentHeight },
            { x: roomX + door.position + door.width, y: currentHeight },
            { x: roomX + door.position + door.width, y: currentHeight + door.height },
            { x: roomX + door.position, y: currentHeight + door.height },
          ],
          fill: '#92400E', stroke: '#78350F', lineWeight: 0.3,
        });
      }
    }

    // Slab line
    elements.push({
      type: 'slab',
      points: [
        { x: -0.15, y: floorTop }, { x: buildableWidth + 0.15, y: floorTop },
        { x: buildableWidth + 0.15, y: floorTop + plan.slabThickness },
        { x: -0.15, y: floorTop + plan.slabThickness },
      ],
      fill: '#6B7280', stroke: '#374151', lineWeight: 0.7,
    });

    // Floor-to-floor height dimension
    dimensions.push({
      startX: buildableWidth + 0.8, startY: currentHeight,
      endX: buildableWidth + 0.8, endY: floorTop,
      value: `${plan.floorHeight.toFixed(2)}m`, offset: 0.5, type: 'linear',
    });

    labels.push({
      x: buildableWidth + 1.5, y: currentHeight + plan.floorHeight / 2,
      text: plan.label, fontSize: 10, rotation: 0, anchor: 'start',
    });

    currentHeight = floorTop + plan.slabThickness;
  }

  const totalHeight = currentHeight;

  // Total width dimension
  dimensions.push({
    startX: 0, startY: -foundationDepth - 0.8,
    endX: buildableWidth, endY: -foundationDepth - 0.8,
    value: `${buildableWidth.toFixed(2)}m`, offset: 0.5, type: 'linear',
  });

  // Total height dimension
  dimensions.push({
    startX: -1.2, startY: 0,
    endX: -1.2, endY: totalHeight,
    value: `${totalHeight.toFixed(2)}m`, offset: 0.5, type: 'linear',
  });

  // North arrow (TextLabel "N" at top-right)
  labels.push({
    x: buildableWidth + 0.5, y: totalHeight + 0.5,
    text: 'N', fontSize: 14, rotation: 0, anchor: 'middle',
  });

  // Scale bar (1m DimensionLine at bottom-right)
  dimensions.push({
    startX: buildableWidth - 1, startY: -foundationDepth - 1.2,
    endX: buildableWidth, endY: -foundationDepth - 1.2,
    value: '1m', offset: 0.2, type: 'linear',
  });

  return { type: 'front_elevation', elements, dimensions, labels, scale: 100 };
}

/**
 * Builds a rear elevation (mirror of front along plot depth axis).
 */
export function buildRearElevation(
  floorPlans: FloorPlan[],
  structural: StructuralPlan,
  plot: PlotDimensions,
  setbacks: SetbackRequirements
): ElevationView {
  const front = buildFrontElevation(floorPlans, structural, plot, setbacks);
  const buildableWidth = plot.width - setbacks.left - setbacks.right;
  // Mirror all elements horizontally
  const mirror = (pts: { x: number; y: number }[]) =>
    pts.map(p => ({ x: buildableWidth - p.x, y: p.y }));
  return {
    ...front,
    type: 'rear_elevation',
    elements: front.elements.map(el => ({ ...el, points: mirror(el.points) })),
    dimensions: front.dimensions.map(d => ({
      ...d,
      startX: buildableWidth - d.startX,
      endX: buildableWidth - d.endX,
    })),
  };
}

/**
 * Builds a left-side elevation. X axis = plot depth, Y axis = building height.
 */
export function buildLeftElevation(
  floorPlans: FloorPlan[],
  structural: StructuralPlan,
  plot: PlotDimensions,
  setbacks: SetbackRequirements
): ElevationView {
  const elements: ElevationElement[] = [];
  const dimensions: DimensionLine[] = [];
  const labels: TextLabel[] = [];

  const buildableDepth = plot.depth - setbacks.front - setbacks.rear;
  const foundationDepth = 1.5;
  const plinthHeight = 0.6;
  let currentHeight = plinthHeight;

  elements.push({
    type: 'foundation',
    points: [
      { x: 0, y: -foundationDepth }, { x: buildableDepth, y: -foundationDepth },
      { x: buildableDepth, y: 0 }, { x: 0, y: 0 },
    ],
    fill: '#9CA3AF', stroke: '#374151', lineWeight: 0.5, hatch: 'concrete',
  });

  elements.push({
    type: 'plinth',
    points: [
      { x: 0, y: 0 }, { x: buildableDepth, y: 0 },
      { x: buildableDepth, y: plinthHeight }, { x: 0, y: plinthHeight },
    ],
    fill: '#D1D5DB', stroke: '#374151', lineWeight: 0.7,
  });

  for (const plan of floorPlans) {
    const floorTop = currentHeight + plan.floorHeight;
    elements.push({
      type: 'wall',
      points: [
        { x: 0, y: currentHeight }, { x: buildableDepth, y: currentHeight },
        { x: buildableDepth, y: floorTop }, { x: 0, y: floorTop },
      ],
      fill: '#FEF3C7', stroke: '#374151', lineWeight: 0.5,
    });

    const leftRooms = plan.rooms.filter(r => r.x <= setbacks.left + 0.5);
    for (const room of leftRooms) {
      const roomX = room.y - setbacks.front;
      for (const win of room.windows.filter(w => w.wallSide === 'W')) {
        elements.push({
          type: 'window',
          points: [
            { x: roomX + win.position, y: currentHeight + win.sillHeight },
            { x: roomX + win.position + win.width, y: currentHeight + win.sillHeight },
            { x: roomX + win.position + win.width, y: currentHeight + win.sillHeight + win.height },
            { x: roomX + win.position, y: currentHeight + win.sillHeight + win.height },
          ],
          fill: '#BFDBFE', stroke: '#1E40AF', lineWeight: 0.3,
        });
      }
    }

    elements.push({
      type: 'slab',
      points: [
        { x: -0.15, y: floorTop }, { x: buildableDepth + 0.15, y: floorTop },
        { x: buildableDepth + 0.15, y: floorTop + plan.slabThickness },
        { x: -0.15, y: floorTop + plan.slabThickness },
      ],
      fill: '#6B7280', stroke: '#374151', lineWeight: 0.7,
    });

    dimensions.push({
      startX: buildableDepth + 0.8, startY: currentHeight,
      endX: buildableDepth + 0.8, endY: floorTop,
      value: `${plan.floorHeight.toFixed(2)}m`, offset: 0.5, type: 'linear',
    });

    currentHeight = floorTop + plan.slabThickness;
  }

  const totalHeight = currentHeight;
  dimensions.push({
    startX: 0, startY: -foundationDepth - 0.8,
    endX: buildableDepth, endY: -foundationDepth - 0.8,
    value: `${buildableDepth.toFixed(2)}m`, offset: 0.5, type: 'linear',
  });
  dimensions.push({
    startX: -1.2, startY: 0, endX: -1.2, endY: totalHeight,
    value: `${totalHeight.toFixed(2)}m`, offset: 0.5, type: 'linear',
  });
  labels.push({
    x: buildableDepth + 0.5, y: totalHeight + 0.5,
    text: 'N', fontSize: 14, rotation: 0, anchor: 'middle',
  });
  dimensions.push({
    startX: buildableDepth - 1, startY: -foundationDepth - 1.2,
    endX: buildableDepth, endY: -foundationDepth - 1.2,
    value: '1m', offset: 0.2, type: 'linear',
  });

  return { type: 'left_elevation', elements, dimensions, labels, scale: 100 };
}

/**
 * Builds a right-side elevation (mirror of left).
 */
export function buildRightElevation(
  floorPlans: FloorPlan[],
  structural: StructuralPlan,
  plot: PlotDimensions,
  setbacks: SetbackRequirements
): ElevationView {
  const left = buildLeftElevation(floorPlans, structural, plot, setbacks);
  const buildableDepth = plot.depth - setbacks.front - setbacks.rear;
  const mirror = (pts: { x: number; y: number }[]) =>
    pts.map(p => ({ x: buildableDepth - p.x, y: p.y }));
  return {
    ...left,
    type: 'right_elevation',
    elements: left.elements.map(el => ({ ...el, points: mirror(el.points) })),
    dimensions: left.dimensions.map(d => ({
      ...d,
      startX: buildableDepth - d.startX,
      endX: buildableDepth - d.endX,
    })),
  };
}

/**
 * Builds Section A-A: vertical cut along horizontal line at y = sectionLine.startY.
 */
export function buildSectionAA(
  floorPlans: FloorPlan[],
  structural: StructuralPlan,
  sectionLine: SectionLine,
  plot: PlotDimensions
): ElevationView {
  const elements: ElevationElement[] = [];
  const dimensions: DimensionLine[] = [];
  const labels: TextLabel[] = [];

  const buildableWidth = plot.width;
  const foundationDepth = 1.5;
  const plinthHeight = 0.6;
  let currentHeight = plinthHeight;

  elements.push({
    type: 'foundation',
    points: [
      { x: 0, y: -foundationDepth }, { x: buildableWidth, y: -foundationDepth },
      { x: buildableWidth, y: 0 }, { x: 0, y: 0 },
    ],
    stroke: '#374151', lineWeight: 0.5, hatch: 'ground',
  });

  for (const plan of floorPlans) {
    const floorTop = currentHeight + plan.floorHeight;

    // Rooms cut by the section line
    const cutRooms = plan.rooms.filter(
      r => r.y <= sectionLine.startY && r.y + r.height >= sectionLine.startY
    );

    for (const room of cutRooms) {
      elements.push({
        type: 'wall',
        points: [
          { x: room.x, y: currentHeight }, { x: room.x + room.width, y: currentHeight },
          { x: room.x + room.width, y: floorTop }, { x: room.x, y: floorTop },
        ],
        fill: '#FEF3C7', stroke: '#374151', lineWeight: 0.5, hatch: 'brick',
      });
      labels.push({
        x: room.x + room.width / 2, y: currentHeight + plan.floorHeight / 2,
        text: room.spec.name, fontSize: 8, rotation: 0, anchor: 'middle',
      });
    }

    // Slab
    elements.push({
      type: 'slab',
      points: [
        { x: 0, y: floorTop }, { x: buildableWidth, y: floorTop },
        { x: buildableWidth, y: floorTop + plan.slabThickness },
        { x: 0, y: floorTop + plan.slabThickness },
      ],
      fill: '#4B5563', stroke: '#1F2937', lineWeight: 0.8, hatch: 'concrete',
    });

    // Floor-to-floor height
    dimensions.push({
      startX: buildableWidth + 0.8, startY: currentHeight,
      endX: buildableWidth + 0.8, endY: floorTop,
      value: `${plan.floorHeight.toFixed(2)}m`, offset: 0.5, type: 'linear',
    });

    // Level label
    labels.push({
      x: buildableWidth + 1.5, y: currentHeight,
      text: `+${currentHeight.toFixed(2)}`, fontSize: 8, rotation: 0, anchor: 'start',
    });

    currentHeight = floorTop + plan.slabThickness;
  }

  // North arrow label
  labels.push({
    x: buildableWidth + 0.5, y: currentHeight,
    text: 'N', fontSize: 14, rotation: 0, anchor: 'middle',
  });
  dimensions.push({
    startX: buildableWidth - 1, startY: -foundationDepth - 1.2,
    endX: buildableWidth, endY: -foundationDepth - 1.2,
    value: '1m', offset: 0.2, type: 'linear',
  });

  return { type: 'section_AA', elements, dimensions, labels, scale: 50 };
}

/**
 * Builds Section B-B: vertical cut along vertical line at x = sectionLine.startX.
 */
export function buildSectionBB(
  floorPlans: FloorPlan[],
  structural: StructuralPlan,
  sectionLine: SectionLine,
  plot: PlotDimensions
): ElevationView {
  const elements: ElevationElement[] = [];
  const dimensions: DimensionLine[] = [];
  const labels: TextLabel[] = [];

  const buildableDepth = plot.depth;
  const foundationDepth = 1.5;
  const plinthHeight = 0.6;
  let currentHeight = plinthHeight;

  elements.push({
    type: 'foundation',
    points: [
      { x: 0, y: -foundationDepth }, { x: buildableDepth, y: -foundationDepth },
      { x: buildableDepth, y: 0 }, { x: 0, y: 0 },
    ],
    stroke: '#374151', lineWeight: 0.5, hatch: 'ground',
  });

  for (const plan of floorPlans) {
    const floorTop = currentHeight + plan.floorHeight;

    const cutRooms = plan.rooms.filter(
      r => r.x <= sectionLine.startX && r.x + r.width >= sectionLine.startX
    );

    for (const room of cutRooms) {
      elements.push({
        type: 'wall',
        points: [
          { x: room.y, y: currentHeight }, { x: room.y + room.height, y: currentHeight },
          { x: room.y + room.height, y: floorTop }, { x: room.y, y: floorTop },
        ],
        fill: '#FEF3C7', stroke: '#374151', lineWeight: 0.5, hatch: 'brick',
      });
      labels.push({
        x: room.y + room.height / 2, y: currentHeight + plan.floorHeight / 2,
        text: room.spec.name, fontSize: 8, rotation: 0, anchor: 'middle',
      });
    }

    elements.push({
      type: 'slab',
      points: [
        { x: 0, y: floorTop }, { x: buildableDepth, y: floorTop },
        { x: buildableDepth, y: floorTop + plan.slabThickness },
        { x: 0, y: floorTop + plan.slabThickness },
      ],
      fill: '#4B5563', stroke: '#1F2937', lineWeight: 0.8, hatch: 'concrete',
    });

    dimensions.push({
      startX: buildableDepth + 0.8, startY: currentHeight,
      endX: buildableDepth + 0.8, endY: floorTop,
      value: `${plan.floorHeight.toFixed(2)}m`, offset: 0.5, type: 'linear',
    });

    labels.push({
      x: buildableDepth + 1.5, y: currentHeight,
      text: `+${currentHeight.toFixed(2)}`, fontSize: 8, rotation: 0, anchor: 'start',
    });

    currentHeight = floorTop + plan.slabThickness;
  }

  labels.push({
    x: buildableDepth + 0.5, y: currentHeight,
    text: 'N', fontSize: 14, rotation: 0, anchor: 'middle',
  });
  dimensions.push({
    startX: buildableDepth - 1, startY: -foundationDepth - 1.2,
    endX: buildableDepth, endY: -foundationDepth - 1.2,
    value: '1m', offset: 0.2, type: 'linear',
  });

  return { type: 'section_BB' as ViewType, elements, dimensions, labels, scale: 50 };
}
