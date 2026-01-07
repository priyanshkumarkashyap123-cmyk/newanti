
interface Node {
    x: number;
    y: number;
    z: number;
}

interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    section?: { name: string, depth?: number, width?: number };
}

// Simple GUID generator for IFC
const createGUID = () => {
    // A simplified IFC-valid GUID generator (22 chars, base64-like)
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
    let guid = "";
    for (let i = 0; i < 22; i++) {
        guid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return guid;
};

export const generateIFC = (
    projectParams: { name: string, author: string },
    nodes: Map<string, Node>,
    members: Map<string, Member>
): string => {
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
    let content = "";
    let stepId = 1;

    // Header
    content += "ISO-10303-21;\nHEADER;\n";
    content += `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n`;
    content += `FILE_NAME('${projectParams.name}.ifc','${timestamp}',('${projectParams.author}'),('BeamLab Ultimate'),'Preprocessor v1','BeamLab','');\n`;
    content += "FILE_SCHEMA(('IFC4'));\n";
    content += "ENDSEC;\n";

    // Data
    content += "DATA;\n";

    // Project Hierarchy
    const orgId = stepId++;
    content += `#${orgId}= IFCORGANIZATION($,'BeamLab Inc.',$,$,$);\n`;

    const appId = stepId++;
    content += `#${appId}= IFCAPPLICATION(#${orgId},'1.0','BeamLab Ultimate','BeamLab');\n`;

    const ownerId = stepId++;
    content += `#${ownerId}= IFCOWNERHISTORY(#${orgId},#${appId},$,.ADDED.,$,$,$,1234567890);\n`;

    const projectId = stepId++;
    content += `#${projectId}= IFCPROJECT('${createGUID()}',#${ownerId},'${projectParams.name}',$,$,$,$,(#${stepId + 1}),#${stepId + 2});\n`;

    // Units
    const unitAssignmentId = stepId + 2;
    // ... Simplified unit setup ...
    // For brevity, skipping full unit definitions, assuming SI (m)

    // Site & Building
    const siteId = stepId + 10;
    const buildingId = stepId + 11;

    content += `#${siteId}= IFCSITE('${createGUID()}',#${ownerId},'Default Site',$,$,#${stepId + 20},$,$,.ELEMENT.,(0,0,0),$,$,$,$);\n`;
    content += `#${buildingId}= IFCBUILDING('${createGUID()}',#${ownerId},'Default Building',$,$,#${stepId + 20},$,$,.ELEMENT.,$,$,$);\n`;

    // Geometry Context (Placeholder)
    // Needs proper direction and placement entities
    // ...

    // Members
    members.forEach((member) => {
        const start = nodes.get(member.startNodeId);
        const end = nodes.get(member.endNodeId);
        if (!start || !end) return;

        const length = Math.sqrt(
            Math.pow(end.x - start.x, 2) +
            Math.pow(end.y - start.y, 2) +
            Math.pow(end.z - start.z, 2)
        );

        // Beam entity
        const beamId = stepId++;
        // Very simplified IFCBEAM
        // Proper IFC requires extensive geometry definition (Extrusion, Profile, Placement)
        // We will output a minimal proxy or strictly semantic definition if possible.
        // For actual valid IFC, we need LocalPlacement, Axis2Placement3D, etc.

        // This is a placeholder for the logic:
        // 1. Define detailed geometry or
        // 2. Use a mapped representation

        // Given complexity, we will comment: "Full geometric export requires detailed STEP definition"
        // But we will write the Entity so it registers.
        content += `#${beamId}= IFCBEAM('${createGUID()}',#${ownerId},'Member ${member.id}',$,$,$,$,$);\n`;
    });

    content += "ENDSEC;\nEND-ISO-10303-21;\n";
    return content;
};

export const downloadIFC = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/ifc' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
