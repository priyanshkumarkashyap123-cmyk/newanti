import { Rectangle } from './geometry';
import type {
  CardinalDirection,
  PlotDimensions,
  SetbackRequirements,
} from './types';

export function buildPlotRectangle(plot: PlotDimensions): Rectangle {
  return new Rectangle(0, 0, plot.width, plot.depth);
}

export function withinSetbacks(
  rect: Rectangle,
  env: Rectangle,
  setbacks: SetbackRequirements,
): boolean {
  const [x0, y0, x1, y1] = rect.bounds;
  const [bx0, by0, bx1, by1] = env.bounds;
  return (
    x0 >= bx0 + setbacks.left &&
    x1 <= bx1 - setbacks.right &&
    y0 >= by0 + setbacks.front &&
    y1 <= by1 - setbacks.rear
  );
}

export function insetBySetbacks(env: Rectangle, setbacks: SetbackRequirements): Rectangle {
  return new Rectangle(
    env.x + setbacks.left,
    env.y + setbacks.front,
    env.width - (setbacks.left + setbacks.right),
    env.height - (setbacks.front + setbacks.rear),
  );
}

/**
 * NBC Part 4 cl. 7.4: Corner plots get reduced setback on secondary road side.
 * Reduction used by planner: 50% of primary road setback, with 1.5m minimum.
 */
export function computeCornerPlotEffectiveSetbacks(
  setbacks: SetbackRequirements,
  roadSides: CardinalDirection[] | undefined,
  mainEntryDirection: CardinalDirection,
): SetbackRequirements {
  const effective = { ...setbacks };
  if (!roadSides || roadSides.length < 2) return effective;

  const isOrthogonal = (d: CardinalDirection): d is 'N' | 'S' | 'E' | 'W' =>
    d === 'N' || d === 'S' || d === 'E' || d === 'W';

  if (!isOrthogonal(mainEntryDirection)) return effective;

  const primaryRoad = mainEntryDirection;
  const secondaryRoad = roadSides.find((s) => s !== primaryRoad && isOrthogonal(s));
  if (!secondaryRoad) return effective;

  const primarySetback =
    primaryRoad === 'N' ? effective.rear
      : primaryRoad === 'S' ? effective.front
        : primaryRoad === 'E' ? effective.right
          : effective.left;

  const reducedSetback = Math.max(1.5, primarySetback * 0.5);
  if (secondaryRoad === 'N') effective.rear = reducedSetback;
  else if (secondaryRoad === 'S') effective.front = reducedSetback;
  else if (secondaryRoad === 'E') effective.right = reducedSetback;
  else if (secondaryRoad === 'W') effective.left = reducedSetback;

  return effective;
}