import type { SectionProperties } from './SectionDatabase';

import { SECTIONS_HEA } from './steel-sections/sections_hea';
import { SECTIONS_HSS_RECT } from './steel-sections/sections_hss_rect';
import { SECTIONS_IPE } from './steel-sections/sections_ipe';
import { SECTIONS_ISHB } from './steel-sections/sections_ishb';
import { SECTIONS_ISLB } from './steel-sections/sections_islb';
import { SECTIONS_ISMB } from './steel-sections/sections_ismb';
import { SECTIONS_ISMC } from './steel-sections/sections_ismc';
import { SECTIONS_RECT_CONCRETE } from './steel-sections/sections_rect_concrete';
import { SECTIONS_W } from './steel-sections/sections_w';

export const STEEL_SECTIONS: SectionProperties[] = [
    SECTIONS_HEA,
    SECTIONS_HSS_RECT,
    SECTIONS_IPE,
    SECTIONS_ISHB,
    SECTIONS_ISLB,
    SECTIONS_ISMB,
    SECTIONS_ISMC,
    SECTIONS_RECT_CONCRETE,
    SECTIONS_W
].flat();
