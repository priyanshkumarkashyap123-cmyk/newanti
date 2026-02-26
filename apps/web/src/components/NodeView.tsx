import { FC } from 'react';
import { Node } from '../store/model';

interface NodeViewProps {
    node: Node;
}

export const NodeView: FC<NodeViewProps> = ({ node }) => {
    return (
        <mesh position={[node.x, node.y, node.z]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#ff6b00" />
        </mesh>
    );
};
