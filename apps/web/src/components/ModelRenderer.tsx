import { FC } from 'react';
import { NodesRenderer } from './NodesRenderer';
import { MembersRenderer } from './MembersRenderer';

export const ModelRenderer: FC = () => {
    return (
        <group>
            <NodesRenderer />
            <MembersRenderer />
        </group>
    );
};
