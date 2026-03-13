/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadInputDialog } from '../../components/ui/LoadInputDialog';
import { useModelStore } from '../../store/model';

describe('LoadInputDialog', () => {
  beforeEach(() => {
    useModelStore.getState().clearModel();
  });

  it('applies UDL to member in kN/m (no *1000 conversion)', async () => {
    const user = userEvent.setup();

    // Prepare a member to receive the load
    const store = useModelStore.getState();
    store.addNode({ id: 'N1', x: 0, y: 0, z: 0 });
    store.addNode({ id: 'N2', x: 5, y: 0, z: 0 });
    store.addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2' });

    const onClose = () => {};

    render(<LoadInputDialog isOpen={true} onClose={onClose} targetMemberId={'M1'} />);

    // Default magnitude is 10 (kN/m) and default direction is down, so expect -10 kN/m
    await user.click(screen.getByRole('button', { name: /apply load/i }));

    const loads = useModelStore.getState().memberLoads;
    expect(loads).toHaveLength(1);
    expect(loads[0].w1).toBe(-10);
    expect(loads[0].w2).toBe(-10);
    expect(loads[0].direction).toBe('global_y');
  });
});
