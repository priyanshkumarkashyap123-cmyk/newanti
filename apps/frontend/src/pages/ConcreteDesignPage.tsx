import React from 'react';
import { MemberDesignTemplate } from '../templates/MemberDesignTemplate';
import { beamSchema, columnSchema, slabSchema } from '../config/design-schemas';

const type = new URLSearchParams(window.location.search).get('type') as 'beam' | 'column' | 'slab' | null;
const schema = type === 'column' ? columnSchema : type === 'slab' ? slabSchema : beamSchema;

export const ConcreteDesignPage: React.FC = () => <MemberDesignTemplate memberType={type ?? 'beam'} config={schema as never} />;
