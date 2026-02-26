/**
 * ============================================================================
 * STAMPING & GOVERNANCE WORKFLOW - PHASE 3
 * ============================================================================
 * 
 * Engineering document control and professional engineer (PE) stamping workflow:
 * - Document version control
 * - Review/approval workflow
 * - PE stamp signature (placeholder for integration)
 * - Audit trail
 * 
 * This module provides the framework for professional engineering
 * certification of calculations. Integration with digital signature
 * services (DocuSign, Adobe Sign) is left as extension points.
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export type DocumentStatus = 
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'REVISIONS_REQUESTED'
  | 'APPROVED'
  | 'STAMPED'
  | 'SUPERSEDED'
  | 'VOID';

export type ReviewAction = 
  | 'SUBMIT_FOR_REVIEW'
  | 'START_REVIEW'
  | 'REQUEST_REVISIONS'
  | 'APPROVE'
  | 'STAMP'
  | 'REVOKE'
  | 'SUPERSEDE';

export interface ProfessionalEngineer {
  id: string;
  name: string;
  licenseNumber: string;
  licenseState: string;        // State/jurisdiction of license
  licenseExpiry: string;       // ISO date
  disciplines: string[];       // e.g., ['Structural', 'Civil', 'Mechanical']
  email: string;
  signatureUrl?: string;       // URL to digital signature image
  stampUrl?: string;           // URL to PE stamp image
}

export interface DocumentMetadata {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  projectNumber?: string;
  
  // Version control
  version: number;
  revision: string;            // e.g., 'R0', 'R1', 'A', 'B'
  previousVersionId?: string;
  
  // Content
  calculationType: string;     // e.g., 'beam_flexure', 'seismic_analysis'
  designCodes: string[];
  contentHash: string;         // Hash of calculation content for integrity
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  stampedAt?: string;
  
  // Status
  status: DocumentStatus;
  
  // People
  authorId: string;
  authorName: string;
  reviewerId?: string;
  reviewerName?: string;
  approverId?: string;
  approverName?: string;
  stampingEngineerId?: string;
  stampingEngineerName?: string;
}

export interface ReviewComment {
  id: string;
  documentId: string;
  authorId: string;
  authorName: string;
  timestamp: string;
  comment: string;
  location?: {
    section?: string;
    page?: number;
    lineRange?: [number, number];
  };
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface WorkflowEvent {
  id: string;
  documentId: string;
  action: ReviewAction;
  actorId: string;
  actorName: string;
  timestamp: string;
  notes?: string;
  fromStatus: DocumentStatus;
  toStatus: DocumentStatus;
  metadata?: Record<string, unknown>;
}

export interface StampRecord {
  id: string;
  documentId: string;
  documentVersion: number;
  documentHash: string;
  
  engineer: ProfessionalEngineer;
  stampedAt: string;
  expiresAt?: string;          // If stamp has expiration
  
  // Digital signature
  signatureType: 'image' | 'digital' | 'none';
  signatureData?: string;      // Base64 or reference
  
  // Verification
  verificationCode: string;    // Unique code for verification
  verified: boolean;
  
  // Scope limitation
  scopeStatement: string;      // What the stamp covers
  limitations?: string[];      // Any limitations or exclusions
  
  // Jurisdiction
  jurisdictions: string[];     // Where stamp is valid
}

// ============================================================================
// WORKFLOW ENGINE
// ============================================================================

const VALID_TRANSITIONS: Record<DocumentStatus, ReviewAction[]> = {
  DRAFT: ['SUBMIT_FOR_REVIEW'],
  PENDING_REVIEW: ['START_REVIEW'],
  IN_REVIEW: ['REQUEST_REVISIONS', 'APPROVE'],
  REVISIONS_REQUESTED: ['SUBMIT_FOR_REVIEW'],
  APPROVED: ['STAMP', 'REVOKE'],
  STAMPED: ['SUPERSEDE', 'REVOKE'],
  SUPERSEDED: [],
  VOID: [],
};

const STATUS_AFTER_ACTION: Record<ReviewAction, DocumentStatus> = {
  SUBMIT_FOR_REVIEW: 'PENDING_REVIEW',
  START_REVIEW: 'IN_REVIEW',
  REQUEST_REVISIONS: 'REVISIONS_REQUESTED',
  APPROVE: 'APPROVED',
  STAMP: 'STAMPED',
  REVOKE: 'VOID',
  SUPERSEDE: 'SUPERSEDED',
};

export class StampingWorkflow {
  private documents: Map<string, DocumentMetadata> = new Map();
  private events: WorkflowEvent[] = [];
  private comments: ReviewComment[] = [];
  private stamps: StampRecord[] = [];
  private engineers: Map<string, ProfessionalEngineer> = new Map();

  /**
   * Register a professional engineer
   */
  registerEngineer(engineer: ProfessionalEngineer): void {
    // Validate license expiry
    if (new Date(engineer.licenseExpiry) < new Date()) {
      throw new Error(`Engineer ${engineer.name} license has expired`);
    }
    this.engineers.set(engineer.id, engineer);
  }

  /**
   * Create a new document
   */
  createDocument(
    metadata: Omit<DocumentMetadata, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'>
  ): DocumentMetadata {
    const id = `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    
    const doc: DocumentMetadata = {
      ...metadata,
      id,
      version: 1,
      revision: 'R0',
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };
    
    this.documents.set(id, doc);
    return doc;
  }

  /**
   * Execute a workflow action
   */
  executeAction(
    documentId: string,
    action: ReviewAction,
    actor: { id: string; name: string },
    notes?: string,
    metadata?: Record<string, unknown>
  ): { success: true; document: DocumentMetadata; event: WorkflowEvent } | { success: false; error: string } {
    const doc = this.documents.get(documentId);
    
    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    // Check if action is valid for current status
    const validActions = VALID_TRANSITIONS[doc.status];
    if (!validActions.includes(action)) {
      return {
        success: false,
        error: `Action '${action}' is not valid for status '${doc.status}'. Valid actions: ${validActions.join(', ')}`,
      };
    }

    // Additional validations
    if (action === 'STAMP') {
      // Verify the actor is a registered PE
      const engineer = this.engineers.get(actor.id);
      if (!engineer) {
        return { success: false, error: 'Only registered Professional Engineers can stamp documents' };
      }
      if (new Date(engineer.licenseExpiry) < new Date()) {
        return { success: false, error: 'PE license has expired' };
      }
    }

    const fromStatus = doc.status;
    const toStatus = STATUS_AFTER_ACTION[action];
    const now = new Date().toISOString();

    // Update document
    doc.status = toStatus;
    doc.updatedAt = now;

    if (action === 'SUBMIT_FOR_REVIEW') {
      doc.submittedAt = now;
    } else if (action === 'APPROVE') {
      doc.approvedAt = now;
      doc.approverId = actor.id;
      doc.approverName = actor.name;
    } else if (action === 'STAMP') {
      doc.stampedAt = now;
      doc.stampingEngineerId = actor.id;
      doc.stampingEngineerName = actor.name;
    } else if (action === 'START_REVIEW') {
      doc.reviewerId = actor.id;
      doc.reviewerName = actor.name;
    }

    // Create event
    const event: WorkflowEvent = {
      id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      documentId,
      action,
      actorId: actor.id,
      actorName: actor.name,
      timestamp: now,
      notes,
      fromStatus,
      toStatus,
      metadata,
    };
    this.events.push(event);

    return { success: true, document: doc, event };
  }

  /**
   * Add a review comment
   */
  addComment(
    documentId: string,
    author: { id: string; name: string },
    comment: string,
    location?: ReviewComment['location']
  ): ReviewComment {
    const reviewComment: ReviewComment = {
      id: `CMT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      documentId,
      authorId: author.id,
      authorName: author.name,
      timestamp: new Date().toISOString(),
      comment,
      location,
      resolved: false,
    };
    this.comments.push(reviewComment);
    return reviewComment;
  }

  /**
   * Resolve a comment
   */
  resolveComment(commentId: string, resolver: { id: string; name: string }): boolean {
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) return false;
    
    comment.resolved = true;
    comment.resolvedBy = resolver.name;
    comment.resolvedAt = new Date().toISOString();
    return true;
  }

  /**
   * Create stamp record
   */
  createStampRecord(
    documentId: string,
    engineerId: string,
    scopeStatement: string,
    jurisdictions: string[],
    limitations?: string[]
  ): StampRecord | null {
    const doc = this.documents.get(documentId);
    const engineer = this.engineers.get(engineerId);
    
    if (!doc || !engineer || doc.status !== 'STAMPED') {
      return null;
    }

    const stamp: StampRecord = {
      id: `STAMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      documentId,
      documentVersion: doc.version,
      documentHash: doc.contentHash,
      engineer,
      stampedAt: doc.stampedAt!,
      signatureType: engineer.signatureUrl ? 'image' : 'none',
      signatureData: engineer.signatureUrl,
      verificationCode: this.generateVerificationCode(),
      verified: true,
      scopeStatement,
      limitations,
      jurisdictions,
    };
    
    this.stamps.push(stamp);
    return stamp;
  }

  /**
   * Verify a stamp
   */
  verifyStamp(verificationCode: string): {
    valid: boolean;
    stamp?: StampRecord;
    document?: DocumentMetadata;
    issues?: string[];
  } {
    const stamp = this.stamps.find((s) => s.verificationCode === verificationCode);
    
    if (!stamp) {
      return { valid: false, issues: ['Verification code not found'] };
    }

    const doc = this.documents.get(stamp.documentId);
    const issues: string[] = [];

    // Check document still valid
    if (doc?.status === 'VOID') {
      issues.push('Document has been voided');
    }
    if (doc?.status === 'SUPERSEDED') {
      issues.push('Document has been superseded by a newer version');
    }

    // Check content integrity
    if (doc && doc.contentHash !== stamp.documentHash) {
      issues.push('Document content has been modified after stamping');
    }

    // Check PE license
    if (new Date(stamp.engineer.licenseExpiry) < new Date()) {
      issues.push('PE license has expired since stamping');
    }

    // Check stamp expiration
    if (stamp.expiresAt && new Date(stamp.expiresAt) < new Date()) {
      issues.push('Stamp has expired');
    }

    return {
      valid: issues.length === 0,
      stamp,
      document: doc,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Get document history
   */
  getDocumentHistory(documentId: string): WorkflowEvent[] {
    return this.events.filter((e) => e.documentId === documentId);
  }

  /**
   * Get document comments
   */
  getDocumentComments(documentId: string, includeResolved = false): ReviewComment[] {
    return this.comments.filter(
      (c) => c.documentId === documentId && (includeResolved || !c.resolved)
    );
  }

  /**
   * Get document
   */
  getDocument(documentId: string): DocumentMetadata | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Generate unique verification code
   */
  private generateVerificationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}

// ============================================================================
// SINGLETON WORKFLOW INSTANCE
// ============================================================================

export const stampingWorkflow = new StampingWorkflow();

// ============================================================================
// DISCLAIMER TEMPLATES
// ============================================================================

export const DISCLAIMER_TEMPLATES = {
  standard: `This calculation is for engineering decision support only and does not constitute 
a licensed engineering opinion. All results must be reviewed and verified by a 
Professional Engineer (PE) licensed in the applicable jurisdiction before use 
in construction documents or regulatory submissions.`,

  stamped: `These calculations have been prepared by and/or under the direct supervision 
of the undersigned Professional Engineer and are valid only for the project, 
location, and scope indicated. Use for other projects or locations requires 
additional review and approval.`,

  preliminary: `PRELIMINARY - NOT FOR CONSTRUCTION. These calculations are provided for 
preliminary design purposes only. Final design calculations must be prepared 
and stamped by a licensed Professional Engineer.`,

  informational: `FOR INFORMATIONAL PURPOSES ONLY. This document is provided as reference 
information and should not be used for design or construction without 
independent verification by a qualified professional.`,
};

// ============================================================================
// STAMP PLACEMENT GENERATOR
// ============================================================================

export interface StampPlacement {
  x: number;       // mm from left
  y: number;       // mm from top
  width: number;   // mm
  height: number;  // mm
  page: 'first' | 'last' | 'all';
}

export function getRecommendedStampPlacement(
  pageSize: 'letter' | 'A4' = 'letter'
): StampPlacement {
  const dimensions = pageSize === 'letter' 
    ? { width: 215.9, height: 279.4 }
    : { width: 210, height: 297 };

  return {
    x: dimensions.width - 75, // 75mm from right edge
    y: dimensions.height - 60, // 60mm from bottom
    width: 50,
    height: 50,
    page: 'last',
  };
}
