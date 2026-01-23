/**
 * AdvancedNLPInterpreter.ts
 * 
 * Advanced Natural Language Processing for Civil Engineering Context
 * 
 * Features:
 * - Deep semantic understanding of engineering terminology
 * - Context-aware interpretation of user requests
 * - Fuzzy matching for variations in terminology
 * - Multi-intent extraction
 * - Entity linking and disambiguation
 * - Conversational context tracking
 */

import { 
  CIVIL_ENGINEERING_KNOWLEDGE, 
  NLP_PATTERNS,
  STRUCTURAL_ENGINEERING,
  GEOTECHNICAL_ENGINEERING 
} from './CivilEngineeringKnowledgeBase';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ParsedIntent {
  primary: IntentType;
  secondary?: IntentType;
  confidence: number;
  domain: EngineeringDomain;
  subDomain?: string;
}

export interface ExtractedEntity {
  type: EntityType;
  value: any;
  originalText: string;
  confidence: number;
  normalized?: any;
  unit?: string;
  metadata?: Record<string, any>;
}

export interface InterpretationResult {
  intent: ParsedIntent;
  entities: ExtractedEntity[];
  context: ConversationalContext;
  suggestions: string[];
  clarifications?: ClarificationRequest[];
  confidence: number;
  rawText: string;
  processedText: string;
}

export interface ConversationalContext {
  currentStructure?: string;
  currentMaterial?: string;
  currentCode?: string;
  lastTopic?: string;
  sessionGoal?: string;
  history: ContextHistoryEntry[];
  preferences: UserPreferences;
}

export interface ContextHistoryEntry {
  timestamp: Date;
  userInput: string;
  intent: IntentType;
  entities: string[];
  response: string;
}

export interface UserPreferences {
  preferredUnits: 'SI' | 'Imperial';
  preferredCode: string;
  preferredMaterial: string;
  experienceLevel: 'student' | 'professional' | 'expert';
  verbosityLevel: 'brief' | 'detailed' | 'comprehensive';
}

export interface ClarificationRequest {
  question: string;
  options?: string[];
  entityType: EntityType;
  required: boolean;
}

export type IntentType = 
  | 'create' | 'analyze' | 'design' | 'optimize' | 'explain' | 'question'
  | 'modify' | 'delete' | 'compare' | 'calculate' | 'check' | 'recommend'
  | 'troubleshoot' | 'learn' | 'export' | 'import' | 'greeting' | 'help'
  | 'confirm' | 'cancel' | 'unknown';

export type EngineeringDomain = 
  | 'structural' | 'geotechnical' | 'transportation' | 'hydraulic' 
  | 'environmental' | 'construction' | 'general';

export type EntityType =
  | 'structure' | 'material' | 'section' | 'dimension' | 'load' | 'support'
  | 'analysis_type' | 'design_code' | 'location' | 'constraint' | 'objective'
  | 'time' | 'cost' | 'quantity' | 'property' | 'action';

// ============================================
// ENGINEERING SYNONYMS & ALIASES
// ============================================

const ENGINEERING_SYNONYMS: Record<string, string[]> = {
  // Structure types
  building: ['structure', 'edifice', 'construction', 'tower', 'complex'],
  bridge: ['overpass', 'viaduct', 'flyover', 'span', 'crossing'],
  beam: ['girder', 'joist', 'rafter', 'lintel', 'purlin'],
  column: ['pillar', 'post', 'pier', 'stanchion', 'support'],
  slab: ['floor', 'deck', 'plate', 'panel'],
  foundation: ['footing', 'base', 'substructure', 'pile'],
  truss: ['lattice', 'framework', 'triangulated'],
  frame: ['skeleton', 'framework', 'structural system'],
  wall: ['shear wall', 'partition', 'curtain', 'load bearing'],
  
  // Materials
  steel: ['iron', 'metal', 'structural steel', 'mild steel', 'HYSD'],
  concrete: ['cement', 'RCC', 'reinforced', 'prestressed', 'PCC'],
  timber: ['wood', 'lumber', 'wooden'],
  masonry: ['brick', 'block', 'stone', 'CMU'],
  
  // Loads
  deadLoad: ['self weight', 'permanent load', 'DL', 'gravity'],
  liveLoad: ['imposed load', 'occupancy', 'LL', 'variable'],
  windLoad: ['lateral wind', 'WL', 'wind pressure'],
  seismicLoad: ['earthquake', 'EQ', 'seismic', 'lateral seismic'],
  
  // Analysis
  static: ['linear', 'first order', 'elastic'],
  dynamic: ['time history', 'transient', 'vibration'],
  modal: ['eigenvalue', 'natural frequency', 'mode shape'],
  buckling: ['stability', 'critical load', 'euler'],
  
  // Properties
  strength: ['capacity', 'resistance', 'load carrying'],
  stiffness: ['rigidity', 'EI', 'flexural rigidity'],
  deflection: ['displacement', 'deformation', 'sag', 'movement'],
  stress: ['tension', 'compression', 'bending stress', 'shear stress'],
  
  // Actions
  create: ['make', 'build', 'design', 'generate', 'model', 'construct', 'draw'],
  analyze: ['check', 'verify', 'compute', 'calculate', 'solve', 'evaluate'],
  optimize: ['improve', 'minimize', 'maximize', 'reduce', 'enhance'],
  explain: ['describe', 'tell', 'what is', 'how does', 'why'],
};

// ============================================
// INTENT CLASSIFIER
// ============================================

class IntentClassifier {
  private intentPatterns: Map<IntentType, RegExp[]>;
  private domainPatterns: Map<EngineeringDomain, RegExp[]>;

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    this.intentPatterns = new Map([
      ['create', [
        /(?:create|generate|make|build|design|model|draw|construct|setup|set up|new)\s/i,
        /i\s+(?:want|need|would like)\s+(?:a|an|to)/i,
        /(?:can|could)\s+you\s+(?:create|make|build|design|help\s+me\s+(?:create|make))/i,
        /let'?s?\s+(?:create|build|design|make)/i,
        /add\s+(?:a|an|the)?\s*(?:new\s+)?(?:node|member|beam|column|load|support)/i,
      ]],
      ['analyze', [
        /(?:analyze|analyse|check|verify|calculate|compute|run|solve|perform|execute)\s/i,
        /(?:what|how\s+much)\s+(?:is|are|will\s+be)\s+(?:the)?\s*(?:stress|deflection|force|moment|reaction|displacement|deformation)/i,
        /find\s+(?:the|all)?\s*(?:forces|moments|reactions|stresses|deflections)/i,
        /(?:static|dynamic|modal|seismic|buckling)\s*analysis/i,
      ]],
      ['design', [
        /design\s+(?:check|verification|code)/i,
        /check\s+(?:against|per|according\s+to|as\s+per)\s+(?:code|standard|is\s*\d+|aisc|aci|eurocode)/i,
        /(?:is|does)\s+(?:it|this|the\s+\w+)\s+(?:safe|adequate|sufficient|pass|ok|okay|comply)/i,
        /code\s+(?:check|compliance|verification)/i,
        /member\s+(?:design|sizing|selection)/i,
      ]],
      ['optimize', [
        /(?:optimize|optimise|improve|minimize|minimise|maximize|maximise|reduce|increase)\s/i,
        /(?:make|get)\s+(?:it|this|the\s+\w+)\s+(?:better|lighter|cheaper|stronger|stiffer|more\s+efficient)/i,
        /(?:most|more)\s+(?:efficient|economical|optimal)/i,
        /(?:weight|cost|material)\s+(?:reduction|optimization|saving)/i,
      ]],
      ['explain', [
        /(?:explain|describe|elaborate|clarify)\s/i,
        /(?:what|how|why)\s+(?:is|are|does|do|did|would|should|can)/i,
        /(?:tell|teach)\s+(?:me|us)\s+(?:about|how|what|why)/i,
        /i\s+(?:don'?t|do\s+not)\s+understand/i,
        /(?:can|could)\s+you\s+explain/i,
        /difference\s+between/i,
      ]],
      ['question', [
        /\?$/,
        /^(?:what|how|why|when|where|which|can|is|are|do|does|will|would|should|could|may|might)\s/i,
      ]],
      ['modify', [
        /(?:change|modify|update|edit|adjust|alter|revise)\s/i,
        /(?:increase|decrease|raise|lower|extend|shorten|widen|narrow)\s/i,
        /make\s+(?:it|the\s+\w+)\s+(?:larger|smaller|bigger|taller|shorter|wider|narrower|longer)/i,
        /(?:move|relocate|reposition|shift)\s+(?:the)?\s*(?:node|member|load|support)/i,
      ]],
      ['delete', [
        /(?:delete|remove|erase|clear|discard|get\s+rid\s+of)\s/i,
        /(?:undo|revert|cancel)\s+(?:the\s+)?(?:last|previous)/i,
      ]],
      ['compare', [
        /(?:compare|comparison|versus|vs\.?|difference\s+between)/i,
        /which\s+(?:is|one\s+is)\s+(?:better|stronger|stiffer|cheaper|more)/i,
      ]],
      ['calculate', [
        /(?:calculate|compute|find|determine|evaluate|get)\s+(?:the)?\s*(?:value|result|answer)/i,
        /(?:what|how\s+much)\s+(?:is|will\s+be)\s+(?:the)?\s*\w+/i,
      ]],
      ['check', [
        /(?:check|verify|validate|confirm|ensure)\s/i,
        /is\s+(?:it|this|my|the)\s+(?:correct|right|ok|okay|valid|safe)/i,
      ]],
      ['recommend', [
        /(?:recommend|suggest|advise|propose)\s/i,
        /what\s+(?:should|would|do\s+you)\s+(?:i|you)\s+(?:use|recommend|suggest)/i,
        /(?:best|suitable|appropriate|optimal)\s+(?:section|size|member|material)/i,
      ]],
      ['troubleshoot', [
        /(?:troubleshoot|debug|fix|solve|resolve)\s/i,
        /(?:why|what)\s+(?:is|are)\s+(?:wrong|not\s+working|failing|the\s+error|the\s+problem)/i,
        /(?:error|problem|issue|bug|failure|crash)/i,
        /(?:doesn'?t|does\s+not|isn'?t|is\s+not|won'?t|will\s+not)\s+(?:work|run|compile|analyze)/i,
      ]],
      ['learn', [
        /(?:teach|learn|study|understand)\s/i,
        /(?:tutorial|guide|introduction|basics|fundamentals)\s/i,
        /how\s+(?:do|does|to|can\s+i)/i,
      ]],
      ['export', [
        /(?:export|save|download|output)\s/i,
        /(?:generate|create)\s+(?:a\s+)?(?:report|pdf|excel|dwg|dxf)/i,
      ]],
      ['import', [
        /(?:import|load|open|read|upload)\s/i,
        /(?:from\s+)?(?:staad|etabs|sap|revit|autocad|dxf|ifc)/i,
      ]],
      ['greeting', [
        /^(?:hi|hello|hey|good\s*(?:morning|afternoon|evening)|greetings|howdy)/i,
        /^(?:what'?s\s+up|how\s+are\s+you|how'?s\s+it\s+going)/i,
      ]],
      ['help', [
        /^(?:help|assist|support)/i,
        /(?:i\s+need|can\s+you)\s+help/i,
        /what\s+can\s+you\s+do/i,
        /^(?:commands|options|features)/i,
      ]],
      ['confirm', [
        /^(?:yes|yeah|yep|yup|sure|ok|okay|alright|correct|right|confirm|proceed|go\s+ahead)/i,
        /^(?:that'?s\s+right|sounds\s+good|perfect|great)/i,
      ]],
      ['cancel', [
        /^(?:no|nope|nah|cancel|stop|abort|quit|exit|never\s*mind|forget\s+it)/i,
      ]],
    ]);

    this.domainPatterns = new Map([
      ['structural', [
        /(?:beam|column|slab|frame|truss|arch|dome|shell|wall|brace|connection|weld|bolt)/i,
        /(?:bending|shear|axial|torsion|buckling|deflection|moment|stress|strain)/i,
        /(?:steel|concrete|rcc|prestressed|composite|timber)\s+(?:structure|design|section)/i,
        /(?:is\s*800|is\s*456|aisc|aci|eurocode\s*[23])/i,
        /(?:portal|moment|braced)\s+frame/i,
      ]],
      ['geotechnical', [
        /(?:soil|foundation|pile|footing|retaining\s+wall|slope|earth\s+pressure)/i,
        /(?:bearing\s+capacity|settlement|consolidation|compaction|permeability)/i,
        /(?:SPT|CPT|CBR|triaxial|shear\s+strength|cohesion|friction\s+angle)/i,
        /(?:clay|sand|silt|gravel|rock)/i,
      ]],
      ['transportation', [
        /(?:highway|road|pavement|traffic|intersection|roundabout|signal)/i,
        /(?:curve|gradient|sight\s+distance|superelevation|camber)/i,
        /(?:flexible|rigid)\s+pavement/i,
        /(?:asphalt|bituminous|concrete)\s+(?:road|pavement)/i,
      ]],
      ['hydraulic', [
        /(?:flow|pipe|channel|weir|spillway|dam|reservoir|pump)/i,
        /(?:manning|bernoulli|darcy|friction\s+loss|head\s+loss)/i,
        /(?:open\s+channel|pressure|laminar|turbulent)\s+flow/i,
        /(?:hydrology|runoff|flood|drainage)/i,
      ]],
      ['environmental', [
        /(?:water\s+treatment|wastewater|sewage|sludge|effluent)/i,
        /(?:BOD|COD|TSS|pH|chlorination|filtration|sedimentation)/i,
        /(?:air\s+pollution|solid\s+waste|landfill|incinerator)/i,
        /(?:environmental\s+impact|EIA|pollution\s+control)/i,
      ]],
      ['construction', [
        /(?:schedule|CPM|PERT|gantt|critical\s+path|float)/i,
        /(?:cost|estimate|budget|BOQ|tender|contract)/i,
        /(?:quality|QA|QC|inspection|testing)/i,
        /(?:safety|PPE|OSHA|hazard)/i,
        /(?:concrete\s+)?(?:batching|curing|formwork|shuttering)/i,
      ]],
    ]);
  }

  classify(text: string): ParsedIntent {
    const normalizedText = this.normalizeText(text);
    let maxScore = 0;
    let primaryIntent: IntentType = 'unknown';
    let secondaryIntent: IntentType | undefined;
    let secondScore = 0;

    // Check each intent pattern
    for (const [intent, patterns] of this.intentPatterns) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(normalizedText)) {
          score += 1;
        }
      }
      
      if (score > maxScore) {
        secondScore = maxScore;
        secondaryIntent = primaryIntent !== 'unknown' ? primaryIntent : undefined;
        maxScore = score;
        primaryIntent = intent;
      } else if (score > secondScore && score > 0) {
        secondScore = score;
        secondaryIntent = intent;
      }
    }

    // Determine domain
    const domain = this.classifyDomain(normalizedText);

    const confidence = this.calculateConfidence(maxScore, normalizedText);

    return {
      primary: primaryIntent,
      secondary: secondaryIntent,
      confidence,
      domain,
    };
  }

  private classifyDomain(text: string): EngineeringDomain {
    let maxScore = 0;
    let domain: EngineeringDomain = 'general';

    for (const [d, patterns] of this.domainPatterns) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          score += 1;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        domain = d as EngineeringDomain;
      }
    }

    return domain;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateConfidence(matchCount: number, text: string): number {
    const wordCount = text.split(/\s+/).length;
    const baseConfidence = Math.min(matchCount / 3, 1.0);
    // Longer, more specific inputs get higher confidence
    const lengthFactor = Math.min(wordCount / 5, 1.0);
    return baseConfidence * 0.7 + lengthFactor * 0.3;
  }
}

// ============================================
// ENTITY EXTRACTOR
// ============================================

class EntityExtractor {
  extract(text: string, domain: EngineeringDomain): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const normalizedText = text.toLowerCase();

    // Extract different entity types
    entities.push(...this.extractStructureTypes(normalizedText));
    entities.push(...this.extractDimensions(normalizedText));
    entities.push(...this.extractMaterials(normalizedText));
    entities.push(...this.extractLoads(normalizedText));
    entities.push(...this.extractSupports(normalizedText));
    entities.push(...this.extractSections(normalizedText));
    entities.push(...this.extractDesignCodes(normalizedText));
    entities.push(...this.extractAnalysisTypes(normalizedText));
    entities.push(...this.extractProperties(normalizedText));
    entities.push(...this.extractConstraints(normalizedText));
    
    // Domain-specific extraction
    if (domain === 'geotechnical') {
      entities.push(...this.extractGeotechnicalEntities(normalizedText));
    } else if (domain === 'hydraulic') {
      entities.push(...this.extractHydraulicEntities(normalizedText));
    }

    // Remove duplicates and sort by confidence
    return this.deduplicateEntities(entities).sort((a, b) => b.confidence - a.confidence);
  }

  private extractStructureTypes(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    const structurePatterns: [RegExp, string, string][] = [
      [/(?:multi[- ]?stor(?:y|ey)|high[- ]?rise)\s*(?:building|frame|structure)?/i, 'multi_story_building', 'building'],
      [/(\d+)[- ]?stor(?:y|ey|ies)\s*(?:building|frame|structure)?/i, 'multi_story_building', 'building'],
      [/(?:single[- ]?stor(?:y|ey)|low[- ]?rise)\s*(?:building|frame|structure)?/i, 'single_story_building', 'building'],
      [/portal\s*frame/i, 'portal_frame', 'frame'],
      [/moment\s*(?:resisting\s*)?frame/i, 'moment_frame', 'frame'],
      [/braced\s*frame/i, 'braced_frame', 'frame'],
      [/warren\s*truss/i, 'warren_truss', 'truss'],
      [/pratt\s*truss/i, 'pratt_truss', 'truss'],
      [/howe\s*truss/i, 'howe_truss', 'truss'],
      [/k[- ]?truss/i, 'k_truss', 'truss'],
      [/(?:truss|lattice)\s*(?:bridge|girder)?/i, 'truss', 'truss'],
      [/(?:cable[- ]?stayed|suspension|arch|girder|box[- ]?girder)\s*bridge/i, 'bridge', 'bridge'],
      [/(?:pedestrian|foot)\s*bridge/i, 'pedestrian_bridge', 'bridge'],
      [/(?:road|highway|railway)\s*bridge/i, 'road_bridge', 'bridge'],
      [/bridge/i, 'bridge', 'bridge'],
      [/industrial\s*(?:shed|building|warehouse)/i, 'industrial_shed', 'industrial'],
      [/(?:factory|warehouse|godown|storage)/i, 'warehouse', 'industrial'],
      [/pre[- ]?engineered\s*(?:building|structure)/i, 'peb', 'industrial'],
      [/(?:water|overhead|elevated|ground|underground)\s*tank/i, 'tank', 'tank'],
      [/intze\s*tank/i, 'intze_tank', 'tank'],
      [/dome/i, 'dome', 'shell'],
      [/arch/i, 'arch', 'arch'],
      [/shell/i, 'shell', 'shell'],
      [/space\s*frame/i, 'space_frame', 'space_frame'],
      [/cantilever/i, 'cantilever', 'beam'],
      [/continuous\s*beam/i, 'continuous_beam', 'beam'],
      [/simply\s*supported/i, 'simply_supported', 'beam'],
      [/fixed\s*(?:beam|end)/i, 'fixed_beam', 'beam'],
      [/(?:isolated|pad|spread)\s*(?:footing|foundation)/i, 'isolated_footing', 'foundation'],
      [/(?:combined|strap)\s*(?:footing|foundation)/i, 'combined_footing', 'foundation'],
      [/(?:strip|wall)\s*(?:footing|foundation)/i, 'strip_footing', 'foundation'],
      [/(?:raft|mat)\s*(?:foundation)?/i, 'raft_foundation', 'foundation'],
      [/pile\s*(?:foundation|cap)?/i, 'pile_foundation', 'foundation'],
      [/retaining\s*wall/i, 'retaining_wall', 'wall'],
      [/shear\s*wall/i, 'shear_wall', 'wall'],
    ];

    for (const [pattern, value, category] of structurePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.push({
          type: 'structure',
          value,
          originalText: match[0],
          confidence: 0.9,
          metadata: { category },
        });
        break; // Take first match for structure type
      }
    }

    return entities;
  }

  private extractDimensions(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Span/Length patterns
    const spanPatterns: RegExp[] = [
      /(\d+(?:\.\d+)?)\s*(?:m|meter|metre|meters|metres)?\s*(?:span|long|length|wide|width)/i,
      /(?:span|length|width)\s*(?:of|:|\s)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|metre)?/i,
    ];
    
    for (const pattern of spanPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1] || match[2]);
        if (!isNaN(value)) {
          entities.push({
            type: 'dimension',
            value,
            originalText: match[0],
            confidence: 0.85,
            unit: 'm',
            metadata: { dimensionType: 'span' },
          });
          break;
        }
      }
    }

    // Height patterns
    const heightPatterns: RegExp[] = [
      /(\d+(?:\.\d+)?)\s*(?:m|meter|metre|meters|metres)?\s*(?:height|tall|high)/i,
      /(?:height|tall|high)\s*(?:of|:|\s)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|metre)?/i,
    ];

    for (const pattern of heightPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1] || match[2]);
        if (!isNaN(value)) {
          entities.push({
            type: 'dimension',
            value,
            originalText: match[0],
            confidence: 0.85,
            unit: 'm',
            metadata: { dimensionType: 'height' },
          });
          break;
        }
      }
    }

    // Story/Floor count
    const storyMatch = text.match(/(\d+)\s*(?:stor(?:y|ies|ey)|floor|level)s?/i);
    if (storyMatch) {
      entities.push({
        type: 'dimension',
        value: parseInt(storyMatch[1]),
        originalText: storyMatch[0],
        confidence: 0.9,
        unit: 'count',
        metadata: { dimensionType: 'stories' },
      });
    }

    // Bay count
    const bayMatch = text.match(/(\d+)\s*(?:bay|span|panel)s?/i);
    if (bayMatch) {
      entities.push({
        type: 'dimension',
        value: parseInt(bayMatch[1]),
        originalText: bayMatch[0],
        confidence: 0.9,
        unit: 'count',
        metadata: { dimensionType: 'bays' },
      });
    }

    // Generic dimensions with units
    const dimensionMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|mm|cm|ft|in|inch|inches)\b/gi);
    if (dimensionMatch) {
      for (const dim of dimensionMatch) {
        const numMatch = dim.match(/(\d+(?:\.\d+)?)/);
        const unitMatch = dim.match(/(m|mm|cm|ft|in)/i);
        if (numMatch && unitMatch) {
          entities.push({
            type: 'dimension',
            value: parseFloat(numMatch[1]),
            originalText: dim,
            confidence: 0.7,
            unit: unitMatch[1].toLowerCase(),
            metadata: { dimensionType: 'generic' },
          });
        }
      }
    }

    return entities;
  }

  private extractMaterials(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const materialPatterns: [RegExp, string, Record<string, any>][] = [
      [/(?:structural\s+)?steel|mild\s+steel|MS/i, 'structural_steel', { E: 200e9, fy: 250e6 }],
      [/high\s+(?:strength\s+)?(?:steel|tensile)/i, 'high_strength_steel', { E: 200e9, fy: 350e6 }],
      [/stainless\s+steel/i, 'stainless_steel', { E: 193e9, fy: 205e6 }],
      [/(?:grade\s*)?e\s*250/i, 'E250', { E: 200e9, fy: 250e6 }],
      [/(?:grade\s*)?e\s*350/i, 'E350', { E: 200e9, fy: 350e6 }],
      [/(?:grade\s*)?e\s*450/i, 'E450', { E: 200e9, fy: 450e6 }],
      [/(?:rcc|reinforced\s+concrete|rc)/i, 'reinforced_concrete', { fck: 25e6 }],
      [/(?:concrete\s+)?m\s*(\d+)/i, 'concrete', {}],
      [/pcc|plain\s+concrete/i, 'plain_concrete', { fck: 20e6 }],
      [/prestressed/i, 'prestressed_concrete', { fck: 40e6 }],
      [/timber|wood(?:en)?|lumber/i, 'timber', { E: 12e9 }],
      [/(?:brick|block)\s+masonry/i, 'masonry', { fm: 5e6 }],
      [/aluminum|aluminium/i, 'aluminum', { E: 70e9, fy: 250e6 }],
      [/composite/i, 'composite', {}],
    ];

    for (const [pattern, material, properties] of materialPatterns) {
      const match = text.match(pattern);
      if (match) {
        const entity: ExtractedEntity = {
          type: 'material',
          value: material,
          originalText: match[0],
          confidence: 0.9,
          metadata: { properties },
        };
        
        // Special handling for concrete grades
        if (material === 'concrete' && match[1]) {
          entity.value = `M${match[1]}`;
          entity.metadata = { fck: parseInt(match[1]) * 1e6 };
        }
        
        entities.push(entity);
      }
    }

    return entities;
  }

  private extractLoads(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Load types
    const loadTypePatterns: [RegExp, string][] = [
      [/dead\s*load|self[- ]?weight|permanent\s*load|DL\b/i, 'dead'],
      [/live\s*load|imposed\s*load|occupancy|LL\b/i, 'live'],
      [/wind\s*load|WL\b|lateral\s*wind/i, 'wind'],
      [/seismic|earthquake|EQ\b|EL\b/i, 'seismic'],
      [/snow\s*load|SL\b/i, 'snow'],
      [/crane\s*load|eot|gantry/i, 'crane'],
      [/thermal|temperature/i, 'temperature'],
      [/settlement/i, 'settlement'],
      [/impact/i, 'impact'],
    ];

    for (const [pattern, loadType] of loadTypePatterns) {
      if (pattern.test(text)) {
        entities.push({
          type: 'load',
          value: loadType,
          originalText: text.match(pattern)![0],
          confidence: 0.9,
          metadata: { category: 'load_type' },
        });
      }
    }

    // Load values with units
    const loadValuePatterns: [RegExp, string, number][] = [
      [/(\d+(?:\.\d+)?)\s*kN(?:\/m²|\/m2|\/sqm)?/i, 'kN/m²', 1],
      [/(\d+(?:\.\d+)?)\s*kN\/m\b/i, 'kN/m', 1],
      [/(\d+(?:\.\d+)?)\s*kN\b/i, 'kN', 1],
      [/(\d+(?:\.\d+)?)\s*kg(?:\/m²|\/m2)?/i, 'kg/m²', 0.00981],
      [/(\d+(?:\.\d+)?)\s*(?:ton(?:ne)?|t)s?/i, 'kN', 9.81],
      [/(\d+(?:\.\d+)?)\s*N\/m²/i, 'kN/m²', 0.001],
      [/(\d+(?:\.\d+)?)\s*psf/i, 'kN/m²', 0.0479],
      [/(\d+(?:\.\d+)?)\s*kip/i, 'kN', 4.448],
    ];

    for (const [pattern, unit, factor] of loadValuePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.push({
          type: 'load',
          value: parseFloat(match[1]) * factor,
          originalText: match[0],
          confidence: 0.85,
          unit: unit,
          normalized: parseFloat(match[1]) * factor,
          metadata: { category: 'load_value' },
        });
      }
    }

    return entities;
  }

  private extractSupports(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const supportPatterns: [RegExp, string, boolean[]][] = [
      [/fixed\s*(?:support|base|end|connection)?|encastre|built[- ]?in|rigid\s*support/i, 'fixed', [true, true, true, true, true, true]],
      [/pinned|hinged?|pin(?:ned)?\s*(?:support|connection)?/i, 'pinned', [true, true, true, false, false, false]],
      [/roller\s*(?:support)?|sliding/i, 'roller', [false, true, false, false, false, false]],
      [/spring\s*support/i, 'spring', []],
      [/free\s*(?:end)?/i, 'free', [false, false, false, false, false, false]],
    ];

    for (const [pattern, supportType, restraints] of supportPatterns) {
      if (pattern.test(text)) {
        entities.push({
          type: 'support',
          value: supportType,
          originalText: text.match(pattern)![0],
          confidence: 0.9,
          metadata: { restraints },
        });
      }
    }

    return entities;
  }

  private extractSections(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const sectionPatterns: [RegExp, string][] = [
      [/ismb\s*(\d+)/i, 'ISMB'],
      [/ishb\s*(\d+)/i, 'ISHB'],
      [/ismc\s*(\d+)/i, 'ISMC'],
      [/isa\s*(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/i, 'ISA'],
      [/w\s*(\d+)\s*[x×]\s*(\d+)/i, 'W'],
      [/hss\s*(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*([\d./]+)/i, 'HSS'],
      [/(?:pipe|tube)\s*(\d+)\s*(?:nb|mm|dia)/i, 'Pipe'],
      [/(\d+)\s*[x×]\s*(\d+)\s*(?:mm|cm)?(?:\s*(?:rect(?:angular)?|section))?/i, 'Rectangular'],
      [/(?:circular|round)\s*(\d+)\s*(?:mm|cm)?/i, 'Circular'],
    ];

    for (const [pattern, sectionType] of sectionPatterns) {
      const match = text.match(pattern);
      if (match) {
        let sectionName = sectionType;
        if (match[1]) {
          sectionName += ` ${match.slice(1).filter(Boolean).join('x')}`;
        }
        entities.push({
          type: 'section',
          value: sectionName.trim(),
          originalText: match[0],
          confidence: 0.85,
          metadata: { type: sectionType },
        });
      }
    }

    return entities;
  }

  private extractDesignCodes(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const codePatterns: [RegExp, string, string][] = [
      [/is\s*800(?:[:-]?\s*2007)?/i, 'IS800:2007', 'steel'],
      [/is\s*456(?:[:-]?\s*2000)?/i, 'IS456:2000', 'concrete'],
      [/is\s*1893(?:[:-]?\s*2016)?/i, 'IS1893:2016', 'seismic'],
      [/is\s*875(?:\s*(?:part\s*)?(\d))?/i, 'IS875', 'loads'],
      [/is\s*13920/i, 'IS13920', 'ductile_detailing'],
      [/aisc\s*360/i, 'AISC360', 'steel'],
      [/aisc\s*341/i, 'AISC341', 'seismic'],
      [/aci\s*318/i, 'ACI318', 'concrete'],
      [/asce\s*7/i, 'ASCE7', 'loads'],
      [/eurocode\s*3|ec\s*3|en\s*1993/i, 'Eurocode3', 'steel'],
      [/eurocode\s*2|ec\s*2|en\s*1992/i, 'Eurocode2', 'concrete'],
      [/eurocode\s*8|ec\s*8|en\s*1998/i, 'Eurocode8', 'seismic'],
      [/bs\s*5950/i, 'BS5950', 'steel'],
      [/as\s*4100/i, 'AS4100', 'steel'],
      [/irc\s*(\d+)/i, 'IRC', 'road'],
    ];

    for (const [pattern, code, type] of codePatterns) {
      const match = text.match(pattern);
      if (match) {
        let codeName = code;
        if (code === 'IS875' && match[1]) {
          codeName = `IS875:Part${match[1]}`;
        }
        entities.push({
          type: 'design_code',
          value: codeName,
          originalText: match[0],
          confidence: 0.95,
          metadata: { codeType: type },
        });
      }
    }

    return entities;
  }

  private extractAnalysisTypes(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const analysisPatterns: [RegExp, string][] = [
      [/(?:linear\s+)?static\s*(?:analysis)?/i, 'linear_static'],
      [/(?:first[- ]?order)\s*(?:analysis)?/i, 'linear_static'],
      [/p[- ]?delta|second[- ]?order|geometric\s*(?:nonlinear)?/i, 'p_delta'],
      [/modal\s*(?:analysis)?|eigen(?:value)?|natural\s*frequenc/i, 'modal'],
      [/response\s*spectrum/i, 'response_spectrum'],
      [/time[- ]?history|transient/i, 'time_history'],
      [/buckling|stability|critical\s*load/i, 'buckling'],
      [/pushover/i, 'pushover'],
      [/nonlinear|inelastic/i, 'nonlinear'],
      [/dynamic/i, 'dynamic'],
    ];

    for (const [pattern, analysisType] of analysisPatterns) {
      if (pattern.test(text)) {
        entities.push({
          type: 'analysis_type',
          value: analysisType,
          originalText: text.match(pattern)![0],
          confidence: 0.9,
        });
      }
    }

    return entities;
  }

  private extractProperties(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const propertyPatterns: [RegExp, string, string][] = [
      [/(?:max(?:imum)?|min(?:imum)?)\s*(?:deflection|displacement)/i, 'deflection', 'serviceability'],
      [/(?:max(?:imum)?|min(?:imum)?)\s*(?:stress|bending\s*stress)/i, 'stress', 'strength'],
      [/(?:max(?:imum)?|min(?:imum)?)\s*(?:moment|bending\s*moment)/i, 'moment', 'force'],
      [/(?:max(?:imum)?|min(?:imum)?)\s*(?:shear|shear\s*force)/i, 'shear', 'force'],
      [/(?:max(?:imum)?|min(?:imum)?)\s*(?:axial|axial\s*force)/i, 'axial', 'force'],
      [/reaction|support\s*(?:force|reaction)/i, 'reaction', 'force'],
      [/natural\s*(?:frequency|period)|mode\s*shape/i, 'frequency', 'dynamic'],
      [/utilization|stress\s*ratio|demand[/-]capacity/i, 'utilization', 'design'],
      [/weight|mass|tonnage/i, 'weight', 'quantity'],
      [/drift|story\s*drift|inter[- ]?story/i, 'drift', 'serviceability'],
    ];

    for (const [pattern, property, category] of propertyPatterns) {
      if (pattern.test(text)) {
        entities.push({
          type: 'property',
          value: property,
          originalText: text.match(pattern)![0],
          confidence: 0.85,
          metadata: { category },
        });
      }
    }

    return entities;
  }

  private extractConstraints(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Deflection limits
    const deflectionMatch = text.match(/(?:deflection|displacement)\s*(?:limit)?\s*(?:of|:)?\s*(?:L\s*\/\s*)?(\d+)/i);
    if (deflectionMatch) {
      entities.push({
        type: 'constraint',
        value: `L/${deflectionMatch[1]}`,
        originalText: deflectionMatch[0],
        confidence: 0.85,
        metadata: { constraintType: 'deflection_limit' },
      });
    }

    // Stress limits
    const stressMatch = text.match(/(?:allowable|permissible)\s*(?:stress)\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:MPa|N\/mm²)/i);
    if (stressMatch) {
      entities.push({
        type: 'constraint',
        value: parseFloat(stressMatch[1]),
        originalText: stressMatch[0],
        confidence: 0.85,
        unit: 'MPa',
        metadata: { constraintType: 'stress_limit' },
      });
    }

    // Budget/cost constraints
    const costMatch = text.match(/(?:budget|cost|limit)\s*(?:of|:)?\s*(?:Rs\.?|₹|INR)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakhs?|crores?|millions?)?/i);
    if (costMatch) {
      let value = parseFloat(costMatch[1].replace(/,/g, ''));
      if (/lakhs?/i.test(costMatch[0])) value *= 100000;
      if (/crores?/i.test(costMatch[0])) value *= 10000000;
      if (/millions?/i.test(costMatch[0])) value *= 1000000;
      
      entities.push({
        type: 'constraint',
        value,
        originalText: costMatch[0],
        confidence: 0.8,
        unit: 'INR',
        metadata: { constraintType: 'cost' },
      });
    }

    return entities;
  }

  private extractGeotechnicalEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Soil types
    const soilPatterns: [RegExp, string][] = [
      [/(?:soft|stiff|very\s+stiff)\s*clay/i, 'clay'],
      [/(?:loose|medium|dense)\s*sand/i, 'sand'],
      [/(?:silty|clayey)\s*(?:sand|soil)/i, 'silty_sand'],
      [/(?:sandy|gravelly)\s*(?:clay|silt)/i, 'sandy_clay'],
      [/rock|hard\s*stratum/i, 'rock'],
      [/fill|made\s*(?:up)?\s*ground/i, 'fill'],
    ];

    for (const [pattern, soilType] of soilPatterns) {
      if (pattern.test(text)) {
        entities.push({
          type: 'material',
          value: soilType,
          originalText: text.match(pattern)![0],
          confidence: 0.85,
          metadata: { category: 'soil' },
        });
      }
    }

    // Soil properties
    const sptMatch = text.match(/(?:N|SPT)[\s-]*(?:value)?\s*(?:of|=|:)?\s*(\d+)/i);
    if (sptMatch) {
      entities.push({
        type: 'property',
        value: parseInt(sptMatch[1]),
        originalText: sptMatch[0],
        confidence: 0.9,
        metadata: { propertyType: 'SPT_N' },
      });
    }

    const bcMatch = text.match(/(?:bearing\s*capacity|SBC)\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)\s*(?:kN\/m²|kPa|t\/m²)?/i);
    if (bcMatch) {
      entities.push({
        type: 'property',
        value: parseFloat(bcMatch[1]),
        originalText: bcMatch[0],
        confidence: 0.9,
        unit: 'kN/m²',
        metadata: { propertyType: 'bearing_capacity' },
      });
    }

    return entities;
  }

  private extractHydraulicEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Flow rate
    const flowMatch = text.match(/(?:flow|discharge|Q)\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)\s*(?:m³\/s|cumecs?|l\/s|lps|MLD)/i);
    if (flowMatch) {
      let value = parseFloat(flowMatch[1]);
      if (/l\/s|lps/i.test(flowMatch[0])) value *= 0.001;
      if (/MLD/i.test(flowMatch[0])) value *= 1000 / 86400;
      
      entities.push({
        type: 'property',
        value,
        originalText: flowMatch[0],
        confidence: 0.9,
        unit: 'm³/s',
        metadata: { propertyType: 'flow_rate' },
      });
    }

    // Pipe diameter
    const diamMatch = text.match(/(?:diameter|dia|pipe)\s*(?:of|=|:)?\s*(\d+)\s*(?:mm|cm|m|inch|in)?/i);
    if (diamMatch) {
      entities.push({
        type: 'dimension',
        value: parseInt(diamMatch[1]),
        originalText: diamMatch[0],
        confidence: 0.85,
        unit: 'mm',
        metadata: { dimensionType: 'diameter' },
      });
    }

    return entities;
  }

  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Map<string, ExtractedEntity>();
    
    for (const entity of entities) {
      const key = `${entity.type}:${entity.value}`;
      const existing = seen.get(key);
      
      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }
    
    return Array.from(seen.values());
  }
}

// ============================================
// CONTEXT MANAGER
// ============================================

class ContextManager {
  private context: ConversationalContext;
  private maxHistoryLength = 20;

  constructor() {
    this.context = {
      history: [],
      preferences: {
        preferredUnits: 'SI',
        preferredCode: 'IS800',
        preferredMaterial: 'structural_steel',
        experienceLevel: 'professional',
        verbosityLevel: 'detailed',
      },
    };
  }

  updateContext(
    userInput: string,
    intent: ParsedIntent,
    entities: ExtractedEntity[],
    response: string
  ): void {
    // Update history
    this.context.history.push({
      timestamp: new Date(),
      userInput,
      intent: intent.primary,
      entities: entities.map(e => `${e.type}:${e.value}`),
      response,
    });

    // Trim history if too long
    if (this.context.history.length > this.maxHistoryLength) {
      this.context.history = this.context.history.slice(-this.maxHistoryLength);
    }

    // Update current context from entities
    for (const entity of entities) {
      if (entity.type === 'structure' && entity.confidence > 0.8) {
        this.context.currentStructure = entity.value as string;
      }
      if (entity.type === 'material' && entity.confidence > 0.8) {
        this.context.currentMaterial = entity.value as string;
      }
      if (entity.type === 'design_code' && entity.confidence > 0.8) {
        this.context.currentCode = entity.value as string;
      }
    }

    // Update last topic
    this.context.lastTopic = intent.domain;
  }

  getContext(): ConversationalContext {
    return { ...this.context };
  }

  setPreferences(prefs: Partial<UserPreferences>): void {
    this.context.preferences = { ...this.context.preferences, ...prefs };
  }

  getRecentContext(n: number = 5): ContextHistoryEntry[] {
    return this.context.history.slice(-n);
  }

  inferFromContext(entities: ExtractedEntity[]): ExtractedEntity[] {
    // If no structure specified, use current context
    if (!entities.some(e => e.type === 'structure') && this.context.currentStructure) {
      entities.push({
        type: 'structure',
        value: this.context.currentStructure,
        originalText: '[inferred from context]',
        confidence: 0.7,
        metadata: { inferred: true },
      });
    }

    // If no material specified, use current or default
    if (!entities.some(e => e.type === 'material')) {
      entities.push({
        type: 'material',
        value: this.context.currentMaterial || this.context.preferences.preferredMaterial,
        originalText: '[inferred from context]',
        confidence: 0.6,
        metadata: { inferred: true },
      });
    }

    // If no code specified, use current or default
    if (!entities.some(e => e.type === 'design_code')) {
      entities.push({
        type: 'design_code',
        value: this.context.currentCode || this.context.preferences.preferredCode,
        originalText: '[inferred from context]',
        confidence: 0.5,
        metadata: { inferred: true },
      });
    }

    return entities;
  }

  clearContext(): void {
    this.context = {
      history: [],
      preferences: this.context.preferences,
    };
  }
}

// ============================================
// SUGGESTION GENERATOR
// ============================================

class SuggestionGenerator {
  generateSuggestions(intent: ParsedIntent, entities: ExtractedEntity[]): string[] {
    const suggestions: string[] = [];

    switch (intent.primary) {
      case 'create':
        suggestions.push(
          'Would you like me to add loads to the structure?',
          'Should I run a structural analysis after creation?',
          'Do you want me to optimize the member sizes?',
        );
        break;
        
      case 'analyze':
        suggestions.push(
          'Should I generate a detailed report?',
          'Would you like me to check the design against code?',
          'Do you want to see the deflected shape?',
        );
        break;
        
      case 'design':
        suggestions.push(
          'Should I recommend alternative sections?',
          'Would you like to optimize for weight?',
          'Do you want me to check all load combinations?',
        );
        break;
        
      case 'explain':
        suggestions.push(
          'Would you like a worked example?',
          'Should I show the relevant code clauses?',
          'Do you want me to explain the calculation steps?',
        );
        break;
        
      case 'optimize':
        suggestions.push(
          'What is your primary optimization goal?',
          'Are there any constraints I should consider?',
          'Would you like to see multiple alternatives?',
        );
        break;
        
      default:
        suggestions.push(
          'Would you like me to create a structural model?',
          'Can I help you analyze an existing structure?',
          'Do you have any questions about structural design?',
        );
    }

    // Add domain-specific suggestions
    if (intent.domain === 'geotechnical') {
      suggestions.push('Should I check bearing capacity?');
    } else if (intent.domain === 'hydraulic') {
      suggestions.push('Would you like me to calculate head loss?');
    }

    return suggestions.slice(0, 3);
  }

  generateClarifications(
    intent: ParsedIntent,
    entities: ExtractedEntity[]
  ): ClarificationRequest[] {
    const clarifications: ClarificationRequest[] = [];

    // Check for missing critical entities based on intent
    if (intent.primary === 'create') {
      if (!entities.some(e => e.type === 'structure')) {
        clarifications.push({
          question: 'What type of structure would you like to create?',
          options: ['Building frame', 'Truss bridge', 'Portal frame', 'Industrial shed', 'Foundation'],
          entityType: 'structure',
          required: true,
        });
      }
      
      if (!entities.some(e => e.type === 'dimension' && e.metadata?.dimensionType === 'span')) {
        clarifications.push({
          question: 'What is the span (length) of the structure?',
          entityType: 'dimension',
          required: true,
        });
      }
    }

    if (intent.primary === 'design' || intent.primary === 'analyze') {
      if (!entities.some(e => e.type === 'design_code')) {
        clarifications.push({
          question: 'Which design code should I use?',
          options: ['IS 800:2007 (Steel)', 'IS 456:2000 (Concrete)', 'AISC 360 (US Steel)', 'Eurocode 3'],
          entityType: 'design_code',
          required: false,
        });
      }
    }

    return clarifications;
  }
}

// ============================================
// MAIN INTERPRETER CLASS
// ============================================

export class AdvancedNLPInterpreter {
  private intentClassifier: IntentClassifier;
  private entityExtractor: EntityExtractor;
  private contextManager: ContextManager;
  private suggestionGenerator: SuggestionGenerator;

  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.entityExtractor = new EntityExtractor();
    this.contextManager = new ContextManager();
    this.suggestionGenerator = new SuggestionGenerator();
  }

  /**
   * Main interpretation method - understands user input comprehensively
   */
  interpret(userInput: string): InterpretationResult {
    const processedText = this.preprocessText(userInput);
    
    // Classify intent
    const intent = this.intentClassifier.classify(processedText);
    
    // Extract entities
    let entities = this.entityExtractor.extract(processedText, intent.domain);
    
    // Infer missing entities from context
    entities = this.contextManager.inferFromContext(entities);
    
    // Generate suggestions
    const suggestions = this.suggestionGenerator.generateSuggestions(intent, entities);
    
    // Generate clarifications if needed
    const clarifications = this.suggestionGenerator.generateClarifications(intent, entities);
    
    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(intent, entities, clarifications);
    
    // Get current context
    const context = this.contextManager.getContext();

    return {
      intent,
      entities,
      context,
      suggestions,
      clarifications: clarifications.length > 0 ? clarifications : undefined,
      confidence,
      rawText: userInput,
      processedText,
    };
  }

  /**
   * Update context after processing a request
   */
  updateContext(
    userInput: string,
    intent: ParsedIntent,
    entities: ExtractedEntity[],
    response: string
  ): void {
    this.contextManager.updateContext(userInput, intent, entities, response);
  }

  /**
   * Set user preferences
   */
  setPreferences(prefs: Partial<UserPreferences>): void {
    this.contextManager.setPreferences(prefs);
  }

  /**
   * Get conversation context
   */
  getContext(): ConversationalContext {
    return this.contextManager.getContext();
  }

  /**
   * Clear conversation context
   */
  clearContext(): void {
    this.contextManager.clearContext();
  }

  /**
   * Preprocess text for better interpretation
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/(\d+)\s*x\s*(\d+)/gi, '$1×$2')
      .replace(/is\s*-\s*(\d+)/gi, 'IS $1')
      .replace(/m\s*(\d+)/gi, 'M$1')
      .trim();
  }

  /**
   * Calculate overall confidence in interpretation
   */
  private calculateOverallConfidence(
    intent: ParsedIntent,
    entities: ExtractedEntity[],
    clarifications: ClarificationRequest[]
  ): number {
    let confidence = intent.confidence * 0.4;
    
    // Entity confidence contribution
    if (entities.length > 0) {
      const avgEntityConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
      confidence += avgEntityConfidence * 0.4;
    }
    
    // Reduce confidence if clarifications are needed
    const requiredClarifications = clarifications.filter(c => c.required).length;
    confidence -= requiredClarifications * 0.1;
    
    // Boost if entities are diverse (multiple types)
    const entityTypes = new Set(entities.map(e => e.type));
    if (entityTypes.size >= 3) {
      confidence += 0.1;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Get explanation of interpretation for debugging
   */
  explainInterpretation(result: InterpretationResult): string {
    const lines: string[] = [
      `## Interpretation Analysis`,
      ``,
      `**Input:** "${result.rawText}"`,
      `**Processed:** "${result.processedText}"`,
      ``,
      `### Intent`,
      `- Primary: ${result.intent.primary} (${(result.intent.confidence * 100).toFixed(0)}% confidence)`,
      result.intent.secondary ? `- Secondary: ${result.intent.secondary}` : '',
      `- Domain: ${result.intent.domain}`,
      ``,
      `### Extracted Entities (${result.entities.length})`,
    ];

    for (const entity of result.entities) {
      lines.push(`- **${entity.type}**: ${entity.value}${entity.unit ? ` ${entity.unit}` : ''} (${(entity.confidence * 100).toFixed(0)}%)`);
      if (entity.metadata?.inferred) {
        lines.push(`  ↳ *Inferred from context*`);
      }
    }

    if (result.clarifications && result.clarifications.length > 0) {
      lines.push(``, `### Clarifications Needed`);
      for (const clarification of result.clarifications) {
        lines.push(`- ${clarification.question}${clarification.required ? ' **(required)**' : ''}`);
        if (clarification.options) {
          lines.push(`  Options: ${clarification.options.join(', ')}`);
        }
      }
    }

    lines.push(``, `### Suggestions`);
    for (const suggestion of result.suggestions) {
      lines.push(`- ${suggestion}`);
    }

    lines.push(``, `**Overall Confidence:** ${(result.confidence * 100).toFixed(0)}%`);

    return lines.filter(Boolean).join('\n');
  }
}

// Export singleton instance
export const nlpInterpreter = new AdvancedNLPInterpreter();

export default AdvancedNLPInterpreter;
