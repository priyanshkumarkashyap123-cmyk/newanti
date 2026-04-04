/**
 * BCFRoundTripEngine — BIM Collaboration Format (BCF) 3.0 Engine
 *
 * Why this exists:
 *   "Importing an IFC is easy. Exporting the changes back to the
 *    architect's Revit model using BCF is what makes software sticky."
 *
 * BCF (ISO 16739-1) is the open standard for communicating issues,
 * comments, and design changes between BIM tools (Revit, Tekla,
 * ArchiCAD, etc.) without transferring the full model.
 *
 * This engine:
 *   1. Creates BCF topics from structural analysis results
 *   2. Flags members that fail design checks
 *   3. Maps structural model changes to architect's IFC entities
 *   4. Generates BCF 3.0 ZIP archive (XML + viewpoints)
 *   5. Parses incoming BCF from architects to update structural model
 *   6. Maintains bidirectional traceability via GUIDs
 *
 * Architecture:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  Architect's Revit Model (.rvt)                              │
 *   │       ↕  IFC Export                                          │
 *   │  IFC File (.ifc)                                             │
 *   │       ↓  Import                                              │
 *   │  ┌─────────────────────────────┐                             │
 *   │  │ Structural Analysis Engine  │                             │
 *   │  │  (Our Platform)             │                             │
 *   │  └────────────┬────────────────┘                             │
 *   │       ↓  Analysis & Design Checks                            │
 *   │  ┌─────────────────────────────┐                             │
 *   │  │ BCFRoundTripEngine          │  ← THIS MODULE              │
 *   │  │  • Create Topics            │                             │
 *   │  │  • Flag Failures            │                             │
 *   │  │  • Map Changes              │                             │
 *   │  │  • Generate BCF ZIP         │                             │
 *   │  └────────────┬────────────────┘                             │
 *   │       ↓  BCF 3.0 ZIP                                        │
 *   │  Architect's Revit / BIM Coordination Tool                   │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * BCF 3.0 ZIP Structure:
 *   bcf.zip
 *   ├── bcf.version                    ← XML version file
 *   ├── extensions.xml                 ← Custom extensions
 *   ├── project.bcfp                   ← Project metadata
 *   ├── {topic-guid}/
 *   │   ├── markup.bcf                 ← Topic + comments XML
 *   │   ├── viewpoint.bcfv             ← Camera/viewpoint XML
 *   │   └── snapshot.png               ← Optional screenshot
 *   └── ...
 *
 * @module modules/bim/BCFRoundTripEngine
 */

// ─── Types ──────────────────────────────────────────────────────────

/** BCF Topic — one issue, clash, or design change */
export interface BCFTopic {
  guid: string;
  topicType: TopicType;
  topicStatus: TopicStatus;
  title: string;
  description: string;
  priority: Priority;
  creationDate: string;
  creationAuthor: string;
  modifiedDate?: string;
  modifiedAuthor?: string;
  assignedTo?: string;
  dueDate?: string;
  /** IFC entity GUIDs this topic references */
  referenceLinks: string[];
  /** Labels / tags */
  labels: string[];
  /** Related BIM viewpoint */
  viewpoint?: BCFViewpoint;
  /** Comments thread */
  comments: BCFComment[];
  /** Related document references */
  documentReferences: DocumentReference[];
  /** Structural analysis data (our extension) */
  structuralData?: StructuralTopicData;
}

export type TopicType =
  | 'DesignCheckFailure'
  | 'DesignCheckWarning'
  | 'SectionChange'
  | 'LoadPathIssue'
  | 'DeflectionExceedance'
  | 'ConnectionDesign'
  | 'StiffnessChange'
  | 'FoundationReaction'
  | 'Clash'
  | 'Comment'
  | 'Request'
  | 'Issue'
  | 'Solution';

export type TopicStatus = 'Active' | 'InProgress' | 'Resolved' | 'Closed';
export type Priority = 'Critical' | 'Major' | 'Normal' | 'Minor';

export interface BCFComment {
  guid: string;
  date: string;
  author: string;
  comment: string;
  modifiedDate?: string;
  viewpointGuid?: string;
}

export interface BCFViewpoint {
  guid: string;
  /** Camera position [x, y, z] */
  cameraPosition: [number, number, number];
  /** Camera direction [x, y, z] */
  cameraDirection: [number, number, number];
  /** Camera up vector */
  cameraUpVector: [number, number, number];
  /** Field of view (degrees) */
  fieldOfView: number;
  /** Aspect ratio */
  aspectRatio: number;
  /** IFC GUIDs to select/highlight */
  selectedComponents: string[];
  /** IFC GUIDs to color */
  coloredComponents: ColoredComponent[];
  /** IFC GUIDs of visible components */
  visibleComponents?: string[];
  /** Clipping planes */
  clippingPlanes?: ClippingPlane[];
}

export interface ColoredComponent {
  ifcGuid: string;
  color: string; // hex AARRGGBB
}

export interface ClippingPlane {
  location: [number, number, number];
  direction: [number, number, number];
}

export interface DocumentReference {
  guid: string;
  url?: string;
  description: string;
  isExternal: boolean;
}

/** Structural analysis data embedded in BCF topic (our extension) */
export interface StructuralTopicData {
  memberId: string;
  sectionCurrent: string;
  sectionProposed?: string;
  designCode: string;
  checkType: string;
  clause: string;
  demand: number;
  capacity: number;
  utilization: number;
  verdict: string;
  loadCase?: string;
}

/** BCF Project metadata */
export interface BCFProject {
  projectId: string;
  projectName: string;
  extensionSchema?: string;
}

/** Result of importing an incoming BCF file */
export interface BCFImportResult {
  project: BCFProject;
  topics: BCFTopic[];
  totalTopics: number;
  designChanges: DesignChangeRequest[];
  comments: number;
}

/** A design change requested by the architect via BCF */
export interface DesignChangeRequest {
  topicGuid: string;
  ifcGuid: string;
  memberType: string;
  changeType: 'Relocate' | 'Resize' | 'Remove' | 'Add' | 'Modify';
  description: string;
  priority: Priority;
  /** If the architect proposes a new position */
  newPosition?: { x: number; y: number; z: number };
  /** If the architect proposes a new section */
  newSection?: string;
  /** The structural engineer's response (filled after review) */
  response?: 'Accepted' | 'Rejected' | 'NeedsReAnalysis';
  responseNote?: string;
}

// ─── GUID generator ─────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoNow(): string {
  return new Date().toISOString();
}

// ═════════════════════════════════════════════════════════════════════
// BCF Round-Trip Engine
// ═════════════════════════════════════════════════════════════════════

export class BCFRoundTripEngine {
  private project: BCFProject;
  private topics: Map<string, BCFTopic> = new Map();
  private entityMap: Map<string, string> = new Map(); // memberId → IFC GUID
  private author: string;

  constructor(projectName: string, author: string) {
    this.project = {
      projectId: uuid(),
      projectName,
    };
    this.author = author;
  }

  // ─── Entity Mapping ────────────────────────────────────────────

  /**
   * Register a mapping from internal member ID to IFC GUID.
   * This enables BCF topics to reference the architect's model entities.
   */
  mapMemberToIFC(memberId: string, ifcGuid: string): void {
    this.entityMap.set(memberId, ifcGuid);
  }

  /**
   * Bulk register member → IFC GUID mappings.
   */
  mapMembersToIFC(mappings: Array<{ memberId: string; ifcGuid: string }>): void {
    for (const m of mappings) {
      this.entityMap.set(m.memberId, m.ifcGuid);
    }
  }

  /** Get the IFC GUID for a member (or generate a placeholder) */
  private getIfcGuid(memberId: string): string {
    return this.entityMap.get(memberId) ?? `structural-${memberId}`;
  }

  // ─── Topic Creation ────────────────────────────────────────────

  /**
   * Create a BCF topic from a design check failure or warning.
   */
  createDesignCheckTopic(data: {
    memberId: string;
    sectionName: string;
    checkTitle: string;
    clause: string;
    designCode: string;
    demand: number;
    capacity: number;
    utilization: number;
    verdict: 'PASS' | 'FAIL' | 'WARNING';
    loadCase?: string;
    proposedSection?: string;
  }): BCFTopic {
    const isFailure = data.verdict === 'FAIL';
    const ifcGuid = this.getIfcGuid(data.memberId);

    const topic: BCFTopic = {
      guid: uuid(),
      topicType: isFailure ? 'DesignCheckFailure' : 'DesignCheckWarning',
      topicStatus: 'Active',
      title: `${data.verdict}: ${data.checkTitle} — Member ${data.memberId}`,
      description: this.buildDesignCheckDescription(data),
      priority: isFailure ? 'Critical' : data.utilization > 0.9 ? 'Major' : 'Normal',
      creationDate: isoNow(),
      creationAuthor: this.author,
      referenceLinks: [ifcGuid],
      labels: [
        'Structural',
        data.designCode,
        data.verdict,
        `Util-${(data.utilization * 100).toFixed(0)}pct`,
      ],
      comments: [
        {
          guid: uuid(),
          date: isoNow(),
          author: this.author,
          comment: `Structural analysis shows ${data.checkTitle} for member ${data.memberId} (${data.sectionName}) has utilization of ${(data.utilization * 100).toFixed(1)}% per ${data.clause}. ${isFailure ? 'Member does NOT satisfy code requirements.' : 'Member is within acceptable limits but warrants review.'} ${data.proposedSection ? `Proposed section change: ${data.sectionName} → ${data.proposedSection}` : ''}`,
        },
      ],
      documentReferences: [],
      viewpoint: {
        guid: uuid(),
        cameraPosition: [0, 0, 10],
        cameraDirection: [0, 0, -1],
        cameraUpVector: [0, 1, 0],
        fieldOfView: 60,
        aspectRatio: 16 / 9,
        selectedComponents: [ifcGuid],
        coloredComponents: [
          {
            ifcGuid,
            color: isFailure ? 'FFFF0000' : 'FFFFAA00', // Red / Orange
          },
        ],
      },
      structuralData: {
        memberId: data.memberId,
        sectionCurrent: data.sectionName,
        sectionProposed: data.proposedSection,
        designCode: data.designCode,
        checkType: data.checkTitle,
        clause: data.clause,
        demand: data.demand,
        capacity: data.capacity,
        utilization: data.utilization,
        verdict: data.verdict,
        loadCase: data.loadCase,
      },
    };

    this.topics.set(topic.guid, topic);
    return topic;
  }

  /**
   * Create a section-change topic (when the structural engineer is
   * requesting the architect to update a member size).
   */
  createSectionChangeTopic(data: {
    memberId: string;
    currentSection: string;
    proposedSection: string;
    reason: string;
    clause: string;
  }): BCFTopic {
    const ifcGuid = this.getIfcGuid(data.memberId);

    const topic: BCFTopic = {
      guid: uuid(),
      topicType: 'SectionChange',
      topicStatus: 'Active',
      title: `Section Change Required: ${data.memberId} — ${data.currentSection} → ${data.proposedSection}`,
      description: `Member ${data.memberId} requires a section change from ${data.currentSection} to ${data.proposedSection}.\n\nReason: ${data.reason}\nGoverning Clause: ${data.clause}`,
      priority: 'Major',
      creationDate: isoNow(),
      creationAuthor: this.author,
      referenceLinks: [ifcGuid],
      labels: ['Structural', 'SectionChange', data.currentSection, data.proposedSection],
      comments: [
        {
          guid: uuid(),
          date: isoNow(),
          author: this.author,
          comment: `The structural analysis per ${data.clause} requires changing member ${data.memberId} from ${data.currentSection} to ${data.proposedSection}. ${data.reason}. Please update the BIM model accordingly and re-export IFC for verification.`,
        },
      ],
      documentReferences: [],
      viewpoint: {
        guid: uuid(),
        cameraPosition: [0, 0, 10],
        cameraDirection: [0, 0, -1],
        cameraUpVector: [0, 1, 0],
        fieldOfView: 60,
        aspectRatio: 16 / 9,
        selectedComponents: [ifcGuid],
        coloredComponents: [
          {
            ifcGuid,
            color: 'FF0088FF', // Blue for changes
          },
        ],
      },
      structuralData: {
        memberId: data.memberId,
        sectionCurrent: data.currentSection,
        sectionProposed: data.proposedSection,
        designCode: '',
        checkType: 'SectionChange',
        clause: data.clause,
        demand: 0,
        capacity: 0,
        utilization: 0,
        verdict: 'CHANGE_REQUESTED',
      },
    };

    this.topics.set(topic.guid, topic);
    return topic;
  }

  /**
   * Create a deflection-exceedance topic.
   */
  createDeflectionTopic(data: {
    memberId: string;
    sectionName: string;
    actualDeflection: number;
    allowableDeflection: number;
    span: number;
    limit: string;
  }): BCFTopic {
    const ifcGuid = this.getIfcGuid(data.memberId);
    const ratio = data.actualDeflection / data.allowableDeflection;

    const topic: BCFTopic = {
      guid: uuid(),
      topicType: 'DeflectionExceedance',
      topicStatus: 'Active',
      title: `Deflection Exceeded: Member ${data.memberId} (${(ratio * 100).toFixed(0)}%)`,
      description: `Member ${data.memberId} (${data.sectionName}) exceeds deflection limit.\nActual: ${data.actualDeflection.toFixed(2)} mm\nAllowable: ${data.allowableDeflection.toFixed(2)} mm (${data.limit})\nSpan: ${data.span.toFixed(0)} mm`,
      priority: ratio > 1.2 ? 'Critical' : 'Major',
      creationDate: isoNow(),
      creationAuthor: this.author,
      referenceLinks: [ifcGuid],
      labels: ['Structural', 'Deflection', `${data.limit}`],
      comments: [{
        guid: uuid(),
        date: isoNow(),
        author: this.author,
        comment: `Deflection check: Actual ${data.actualDeflection.toFixed(2)} mm > Allowable ${data.allowableDeflection.toFixed(2)} mm (${data.limit}). Consider increasing section depth or adding intermediate supports.`,
      }],
      documentReferences: [],
      viewpoint: {
        guid: uuid(),
        cameraPosition: [0, 0, 10],
        cameraDirection: [0, 0, -1],
        cameraUpVector: [0, 1, 0],
        fieldOfView: 60,
        aspectRatio: 16 / 9,
        selectedComponents: [ifcGuid],
        coloredComponents: [{
          ifcGuid,
          color: 'FFFF6600', // Orange
        }],
      },
    };

    this.topics.set(topic.guid, topic);
    return topic;
  }

  /**
   * Add a comment to an existing topic.
   */
  addComment(topicGuid: string, author: string, comment: string): BCFComment | null {
    const topic = this.topics.get(topicGuid);
    if (!topic) return null;

    const c: BCFComment = {
      guid: uuid(),
      date: isoNow(),
      author,
      comment,
    };

    topic.comments.push(c);
    topic.modifiedDate = isoNow();
    topic.modifiedAuthor = author;
    return c;
  }

  /**
   * Resolve a topic.
   */
  resolveTopic(topicGuid: string, author: string, resolution: string): boolean {
    const topic = this.topics.get(topicGuid);
    if (!topic) return false;

    topic.topicStatus = 'Resolved';
    topic.modifiedDate = isoNow();
    topic.modifiedAuthor = author;
    topic.comments.push({
      guid: uuid(),
      date: isoNow(),
      author,
      comment: `RESOLVED: ${resolution}`,
    });
    return true;
  }

  // ─── BCF 3.0 XML Generation ────────────────────────────────────

  /**
   * Generate the complete BCF 3.0 archive content as a map of
   * filename → XML content. The caller can use JSZip or similar
   * to create the final .bcfzip file.
   */
  generateBCFArchive(): Map<string, string> {
    const files = new Map<string, string>();

    // bcf.version
    files.set('bcf.version', this.generateVersionXml());

    // project.bcfp
    files.set('project.bcfp', this.generateProjectXml());

    // extensions.xml
    files.set('extensions.xml', this.generateExtensionsXml());

    // Per-topic
    for (const [guid, topic] of this.topics) {
      files.set(`${guid}/markup.bcf`, this.generateMarkupXml(topic));
      if (topic.viewpoint) {
        files.set(`${guid}/viewpoint.bcfv`, this.generateViewpointXml(topic.viewpoint));
      }
    }

    return files;
  }

  private generateVersionXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Version VersionId="3.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/buildingSMART/BCF-XML/release_3_0/Schemas/version.xsd">
  <DetailedVersion>3.0</DetailedVersion>
</Version>`;
  }

  private generateProjectXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ProjectExtension xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/buildingSMART/BCF-XML/release_3_0/Schemas/project.xsd">
  <Project ProjectId="${xmlEsc(this.project.projectId)}">
    <Name>${xmlEsc(this.project.projectName)}</Name>
  </Project>
  <ExtensionSchema>extensions.xml</ExtensionSchema>
</ProjectExtension>`;
  }

  private generateExtensionsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Extensions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/buildingSMART/BCF-XML/release_3_0/Schemas/extensions.xsd">
  <TopicTypes>
    <TopicType>DesignCheckFailure</TopicType>
    <TopicType>DesignCheckWarning</TopicType>
    <TopicType>SectionChange</TopicType>
    <TopicType>LoadPathIssue</TopicType>
    <TopicType>DeflectionExceedance</TopicType>
    <TopicType>ConnectionDesign</TopicType>
    <TopicType>StiffnessChange</TopicType>
    <TopicType>FoundationReaction</TopicType>
    <TopicType>Clash</TopicType>
    <TopicType>Comment</TopicType>
    <TopicType>Request</TopicType>
    <TopicType>Issue</TopicType>
    <TopicType>Solution</TopicType>
  </TopicTypes>
  <TopicStatuses>
    <TopicStatus>Active</TopicStatus>
    <TopicStatus>InProgress</TopicStatus>
    <TopicStatus>Resolved</TopicStatus>
    <TopicStatus>Closed</TopicStatus>
  </TopicStatuses>
  <Priorities>
    <Priority>Critical</Priority>
    <Priority>Major</Priority>
    <Priority>Normal</Priority>
    <Priority>Minor</Priority>
  </Priorities>
  <TopicLabels>
    <TopicLabel>Structural</TopicLabel>
    <TopicLabel>Architectural</TopicLabel>
    <TopicLabel>MEP</TopicLabel>
    <TopicLabel>SectionChange</TopicLabel>
    <TopicLabel>Deflection</TopicLabel>
    <TopicLabel>Seismic</TopicLabel>
  </TopicLabels>
</Extensions>`;
  }

  private generateMarkupXml(topic: BCFTopic): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/buildingSMART/BCF-XML/release_3_0/Schemas/markup.xsd">
  <Header>
    <Files />
  </Header>
  <Topic Guid="${xmlEsc(topic.guid)}" TopicType="${xmlEsc(topic.topicType)}" TopicStatus="${xmlEsc(topic.topicStatus)}">
    <ReferenceLinks>
${topic.referenceLinks.map(r => `      <ReferenceLink>${xmlEsc(r)}</ReferenceLink>`).join('\n')}
    </ReferenceLinks>
    <Title>${xmlEsc(topic.title)}</Title>
    <Priority>${xmlEsc(topic.priority)}</Priority>
    <CreationDate>${xmlEsc(topic.creationDate)}</CreationDate>
    <CreationAuthor>${xmlEsc(topic.creationAuthor)}</CreationAuthor>`;

    if (topic.modifiedDate) {
      xml += `\n    <ModifiedDate>${xmlEsc(topic.modifiedDate)}</ModifiedDate>`;
    }
    if (topic.modifiedAuthor) {
      xml += `\n    <ModifiedAuthor>${xmlEsc(topic.modifiedAuthor)}</ModifiedAuthor>`;
    }
    if (topic.assignedTo) {
      xml += `\n    <AssignedTo>${xmlEsc(topic.assignedTo)}</AssignedTo>`;
    }
    if (topic.dueDate) {
      xml += `\n    <DueDate>${xmlEsc(topic.dueDate)}</DueDate>`;
    }

    xml += `\n    <Description>${xmlEsc(topic.description)}</Description>`;

    // Labels
    if (topic.labels.length > 0) {
      xml += `\n    <Labels>`;
      for (const label of topic.labels) {
        xml += `\n      <Label>${xmlEsc(label)}</Label>`;
      }
      xml += `\n    </Labels>`;
    }

    xml += `\n  </Topic>`;

    // Comments
    for (const c of topic.comments) {
      xml += `\n  <Comment Guid="${xmlEsc(c.guid)}">
    <Date>${xmlEsc(c.date)}</Date>
    <Author>${xmlEsc(c.author)}</Author>
    <Comment>${xmlEsc(c.comment)}</Comment>`;
      if (c.viewpointGuid) {
        xml += `\n    <Viewpoint Guid="${xmlEsc(c.viewpointGuid)}" />`;
      }
      xml += `\n  </Comment>`;
    }

    // Viewpoints reference
    if (topic.viewpoint) {
      xml += `\n  <Viewpoints>
    <ViewPoint Guid="${xmlEsc(topic.viewpoint.guid)}">
      <Viewpoint>viewpoint.bcfv</Viewpoint>
    </ViewPoint>
  </Viewpoints>`;
    }

    // Document references
    for (const doc of topic.documentReferences) {
      xml += `\n  <DocumentReference Guid="${xmlEsc(doc.guid)}"${doc.isExternal ? ' isExternal="true"' : ''}>
    <Description>${xmlEsc(doc.description)}</Description>`;
      if (doc.url) {
        xml += `\n    <ReferencedDocument>${xmlEsc(doc.url)}</ReferencedDocument>`;
      }
      xml += `\n  </DocumentReference>`;
    }

    xml += `\n</Markup>`;
    return xml;
  }

  private generateViewpointXml(vp: BCFViewpoint): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<VisualizationInfo Guid="${xmlEsc(vp.guid)}"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/buildingSMART/BCF-XML/release_3_0/Schemas/visinfo.xsd">
  <PerspectiveCamera>
    <CameraViewPoint>
      <X>${vp.cameraPosition[0]}</X>
      <Y>${vp.cameraPosition[1]}</Y>
      <Z>${vp.cameraPosition[2]}</Z>
    </CameraViewPoint>
    <CameraDirection>
      <X>${vp.cameraDirection[0]}</X>
      <Y>${vp.cameraDirection[1]}</Y>
      <Z>${vp.cameraDirection[2]}</Z>
    </CameraDirection>
    <CameraUpVector>
      <X>${vp.cameraUpVector[0]}</X>
      <Y>${vp.cameraUpVector[1]}</Y>
      <Z>${vp.cameraUpVector[2]}</Z>
    </CameraUpVector>
    <FieldOfView>${vp.fieldOfView}</FieldOfView>
    <AspectRatio>${vp.aspectRatio}</AspectRatio>
  </PerspectiveCamera>`;

    // Components
    xml += `\n  <Components>`;

    // Selected
    if (vp.selectedComponents.length > 0) {
      xml += `\n    <Selection>`;
      for (const guid of vp.selectedComponents) {
        xml += `\n      <Component IfcGuid="${xmlEsc(guid)}" />`;
      }
      xml += `\n    </Selection>`;
    }

    // Coloring
    if (vp.coloredComponents.length > 0) {
      xml += `\n    <Coloring>`;
      for (const cc of vp.coloredComponents) {
        xml += `\n      <Color Color="${xmlEsc(cc.color)}">
        <Components>
          <Component IfcGuid="${xmlEsc(cc.ifcGuid)}" />
        </Components>
      </Color>`;
      }
      xml += `\n    </Coloring>`;
    }

    xml += `\n  </Components>`;

    // Clipping planes
    if (vp.clippingPlanes && vp.clippingPlanes.length > 0) {
      xml += `\n  <ClippingPlanes>`;
      for (const cp of vp.clippingPlanes) {
        xml += `\n    <ClippingPlane>
      <Location><X>${cp.location[0]}</X><Y>${cp.location[1]}</Y><Z>${cp.location[2]}</Z></Location>
      <Direction><X>${cp.direction[0]}</X><Y>${cp.direction[1]}</Y><Z>${cp.direction[2]}</Z></Direction>
    </ClippingPlane>`;
      }
      xml += `\n  </ClippingPlanes>`;
    }

    xml += `\n</VisualizationInfo>`;
    return xml;
  }

  // ─── BCF Import / Parser ───────────────────────────────────────

  /**
   * Parse an incoming BCF ZIP archive (as a map of filename → content).
   * In production, the caller decompresses the ZIP first.
   */
  parseBCFArchive(files: Map<string, string>): BCFImportResult {
    const topics: BCFTopic[] = [];
    const designChanges: DesignChangeRequest[] = [];
    let totalComments = 0;

    // Parse project
    const projectXml = files.get('project.bcfp') ?? '';
    const project = this.parseProjectXml(projectXml);

    // Find all markup files
    for (const [path, content] of files) {
      if (path.endsWith('/markup.bcf')) {
        const topic = this.parseMarkupXml(content);
        if (topic) {
          topics.push(topic);
          totalComments += topic.comments.length;

          // Check for design change requests
          const change = this.extractDesignChange(topic);
          if (change) designChanges.push(change);
        }
      }
    }

    // Parse viewpoints and attach to topics
    for (const [path, content] of files) {
      if (path.endsWith('/viewpoint.bcfv')) {
        const topicGuid = path.split('/')[0];
        const topic = topics.find(t => t.guid === topicGuid);
        if (topic) {
          const parsedViewpoint = this.parseViewpointXml(content);
          if (parsedViewpoint) {
            topic.viewpoint = parsedViewpoint;
          }
        }
      }
    }

    return {
      project,
      topics,
      totalTopics: topics.length,
      designChanges,
      comments: totalComments,
    };
  }

  private parseProjectXml(xml: string): BCFProject {
    const idMatch = xml.match(/ProjectId="([^"]+)"/);
    const nameMatch = xml.match(/<Name>([^<]+)<\/Name>/);
    return {
      projectId: idMatch?.[1] ?? uuid(),
      projectName: nameMatch?.[1] ?? 'Unknown Project',
    };
  }

  private parseMarkupXml(xml: string): BCFTopic | null {
    const guidMatch = xml.match(/Topic\s+Guid="([^"]+)"/);
    if (!guidMatch) return null;

    const typeMatch = xml.match(/TopicType="([^"]+)"/);
    const statusMatch = xml.match(/TopicStatus="([^"]+)"/);
    const titleMatch = xml.match(/<Title>([^<]*)<\/Title>/);
    const descMatch = xml.match(/<Description>([\s\S]*?)<\/Description>/);
    const priorityMatch = xml.match(/<Priority>([^<]*)<\/Priority>/);
    const dateMatch = xml.match(/<CreationDate>([^<]*)<\/CreationDate>/);
    const authorMatch = xml.match(/<CreationAuthor>([^<]*)<\/CreationAuthor>/);
    const assignedMatch = xml.match(/<AssignedTo>([^<]*)<\/AssignedTo>/);

    // Parse reference links
    const refLinkRegex = /<ReferenceLink>([^<]*)<\/ReferenceLink>/g;
    const refs: string[] = [];
    let refMatch;
    while ((refMatch = refLinkRegex.exec(xml)) !== null) {
      refs.push(refMatch[1]);
    }

    // Parse labels
    const labelRegex = /<Label>([^<]*)<\/Label>/g;
    const labels: string[] = [];
    let labelMatch;
    while ((labelMatch = labelRegex.exec(xml)) !== null) {
      labels.push(labelMatch[1]);
    }

    // Parse comments
    const comments: BCFComment[] = [];
    const commentRegex = /<Comment\s+Guid="([^"]+)">([\s\S]*?)<\/Comment>/g;
    let cMatch;
    while ((cMatch = commentRegex.exec(xml)) !== null) {
      const cBody = cMatch[2];
      const cDate = cBody.match(/<Date>([^<]*)<\/Date>/)?.[1] ?? '';
      const cAuthor = cBody.match(/<Author>([^<]*)<\/Author>/)?.[1] ?? '';
      const cText = cBody.match(/<Comment>([^<]*)<\/Comment>/)?.[1] ?? '';
      comments.push({
        guid: cMatch[1],
        date: cDate,
        author: cAuthor,
        comment: cText,
      });
    }

    // Parse document references
    const docRefs: DocumentReference[] = [];
    const docRegex = /<DocumentReference\s+Guid="([^"]+)"([^>]*)>([\s\S]*?)<\/DocumentReference>/g;
    let docMatch;
    while ((docMatch = docRegex.exec(xml)) !== null) {
      const isExt = docMatch[2].includes('isExternal="true"');
      const desc = docMatch[3].match(/<Description>([^<]*)<\/Description>/)?.[1] ?? '';
      const url = docMatch[3].match(/<ReferencedDocument>([^<]*)<\/ReferencedDocument>/)?.[1];
      docRefs.push({ guid: docMatch[1], description: desc, isExternal: isExt, url });
    }

    return {
      guid: guidMatch[1],
      topicType: (typeMatch?.[1] ?? 'Issue') as TopicType,
      topicStatus: (statusMatch?.[1] ?? 'Active') as TopicStatus,
      title: titleMatch?.[1] ?? '',
      description: descMatch?.[1] ?? '',
      priority: (priorityMatch?.[1] ?? 'Normal') as Priority,
      creationDate: dateMatch?.[1] ?? '',
      creationAuthor: authorMatch?.[1] ?? '',
      assignedTo: assignedMatch?.[1],
      referenceLinks: refs,
      labels,
      comments,
      documentReferences: docRefs,
    };
  }

  private parseViewpointXml(xml: string): BCFViewpoint | null {
    const guidMatch = xml.match(/VisualizationInfo\s+Guid="([^"]+)"/);
    if (!guidMatch) return null;

    const getXYZ = (tag: string): [number, number, number] => {
      const regex = new RegExp(`<${tag}>\\s*<X>([^<]*)</X>\\s*<Y>([^<]*)</Y>\\s*<Z>([^<]*)</Z>\\s*</${tag}>`);
      const m = xml.match(regex);
      return m
        ? [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
        : [0, 0, 0];
    };

    const fovMatch = xml.match(/<FieldOfView>([^<]*)<\/FieldOfView>/);
    const arMatch = xml.match(/<AspectRatio>([^<]*)<\/AspectRatio>/);

    // Selected components
    const selRegex = /<Selection>[\s\S]*?<\/Selection>/;
    const selBlock = xml.match(selRegex)?.[0] ?? '';
    const compRegex = /IfcGuid="([^"]+)"/g;
    const selected: string[] = [];
    let compMatch;
    while ((compMatch = compRegex.exec(selBlock)) !== null) {
      selected.push(compMatch[1]);
    }

    // Colored components
    const colorRegex = /<Color\s+Color="([^"]+)">([\s\S]*?)<\/Color>/g;
    const colored: ColoredComponent[] = [];
    let colMatch;
    while ((colMatch = colorRegex.exec(xml)) !== null) {
      const colorGuids = colMatch[2].match(/IfcGuid="([^"]+)"/g);
      if (colorGuids) {
        for (const cg of colorGuids) {
          const g = cg.match(/"([^"]+)"/)?.[1];
          if (g) colored.push({ ifcGuid: g, color: colMatch[1] });
        }
      }
    }

    return {
      guid: guidMatch[1],
      cameraPosition: getXYZ('CameraViewPoint'),
      cameraDirection: getXYZ('CameraDirection'),
      cameraUpVector: getXYZ('CameraUpVector'),
      fieldOfView: parseFloat(fovMatch?.[1] ?? '60'),
      aspectRatio: parseFloat(arMatch?.[1] ?? '1.777'),
      selectedComponents: selected,
      coloredComponents: colored,
    };
  }

  /**
   * Extract a design change request from a BCF topic.
   * Looks for section change, relocation, or modification hints.
   */
  private extractDesignChange(topic: BCFTopic): DesignChangeRequest | null {
    if (
      topic.topicType !== 'SectionChange' &&
      topic.topicType !== 'Request' &&
      topic.topicType !== 'Issue'
    ) {
      return null;
    }

    const ifcGuid = topic.referenceLinks[0] ?? '';
    let changeType: DesignChangeRequest['changeType'] = 'Modify';
    if (topic.title.toLowerCase().includes('remove')) changeType = 'Remove';
    else if (topic.title.toLowerCase().includes('relocat')) changeType = 'Relocate';
    else if (topic.title.toLowerCase().includes('resize') || topic.title.toLowerCase().includes('section change')) changeType = 'Resize';
    else if (topic.title.toLowerCase().includes('add')) changeType = 'Add';

    // Extract proposed section from structural data
    const newSection = topic.structuralData?.sectionProposed;

    return {
      topicGuid: topic.guid,
      ifcGuid,
      memberType: topic.labels.find(l => l.startsWith('Ifc')) ?? 'IfcBeam',
      changeType,
      description: topic.description,
      priority: topic.priority,
      newSection,
    };
  }

  // ─── Round-Trip Integration ────────────────────────────────────

  /**
   * Process analysis results and automatically create BCF topics
   * for all failures and warnings.
   *
   * This is the main entry point for the round-trip workflow:
   *   IFC Import → Analysis → Design Checks → BCF Export → Architect
   */
  processAnalysisResults(results: AnalysisResultForBCF[]): BCFTopic[] {
    const createdTopics: BCFTopic[] = [];

    for (const r of results) {
      // Create topics only for failures and warnings
      if (r.verdict === 'FAIL' || r.verdict === 'WARNING') {
        const topic = this.createDesignCheckTopic({
          memberId: r.memberId,
          sectionName: r.sectionName,
          checkTitle: r.checkTitle,
          clause: r.clause,
          designCode: r.designCode,
          demand: r.demand,
          capacity: r.capacity,
          utilization: r.utilization,
          verdict: r.verdict,
          loadCase: r.loadCase,
          proposedSection: r.proposedSection,
        });
        createdTopics.push(topic);
      }
    }

    return createdTopics;
  }

  /**
   * Generate a summary of all BCF topics for display in the UI.
   */
  getTopicsSummary(): BCFTopicsSummary {
    const topics = Array.from(this.topics.values());
    return {
      totalTopics: topics.length,
      byType: countBy(topics, t => t.topicType),
      byStatus: countBy(topics, t => t.topicStatus),
      byPriority: countBy(topics, t => t.priority),
      criticalFailures: topics.filter(t => t.priority === 'Critical' && t.topicStatus === 'Active').length,
      unresolvedCount: topics.filter(t => t.topicStatus !== 'Resolved' && t.topicStatus !== 'Closed').length,
    };
  }

  /** Get all topics */
  getTopics(): BCFTopic[] {
    return Array.from(this.topics.values());
  }

  /** Get a single topic by GUID */
  getTopic(guid: string): BCFTopic | undefined {
    return this.topics.get(guid);
  }

  /** Clear all topics */
  clearTopics(): void {
    this.topics.clear();
  }

  // ─── Description Builder ───────────────────────────────────────

  private buildDesignCheckDescription(data: {
    memberId: string;
    sectionName: string;
    checkTitle: string;
    clause: string;
    designCode: string;
    demand: number;
    capacity: number;
    utilization: number;
    verdict: string;
    loadCase?: string;
    proposedSection?: string;
  }): string {
    const lines: string[] = [];
    lines.push(`STRUCTURAL DESIGN CHECK — ${data.verdict}`);
    lines.push('');
    lines.push(`Member:        ${data.memberId}`);
    lines.push(`Section:       ${data.sectionName}`);
    lines.push(`Check:         ${data.checkTitle}`);
    lines.push(`Design Code:   ${data.designCode}`);
    lines.push(`Clause:        ${data.clause}`);
    lines.push('');
    lines.push(`Demand:        ${data.demand.toFixed(2)}`);
    lines.push(`Capacity:      ${data.capacity.toFixed(2)}`);
    lines.push(`Utilization:   ${(data.utilization * 100).toFixed(1)}%`);
    if (data.loadCase) lines.push(`Load Case:     ${data.loadCase}`);
    lines.push('');
    if (data.verdict === 'FAIL') {
      lines.push('ACTION REQUIRED: Member does not satisfy code requirements.');
      if (data.proposedSection) {
        lines.push(`PROPOSED CHANGE: ${data.sectionName} → ${data.proposedSection}`);
      }
    }
    return lines.join('\n');
  }
}

// ─── Supporting Types ───────────────────────────────────────────────

export interface AnalysisResultForBCF {
  memberId: string;
  sectionName: string;
  checkTitle: string;
  clause: string;
  designCode: string;
  demand: number;
  capacity: number;
  utilization: number;
  verdict: 'PASS' | 'FAIL' | 'WARNING';
  loadCase?: string;
  proposedSection?: string;
}

export interface BCFTopicsSummary {
  totalTopics: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  criticalFailures: number;
  unresolvedCount: number;
}

// ─── Utilities ──────────────────────────────────────────────────────

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function countBy<T>(arr: T[], fn: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const key = fn(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

// ─── Export ─────────────────────────────────────────────────────────

export default BCFRoundTripEngine;
