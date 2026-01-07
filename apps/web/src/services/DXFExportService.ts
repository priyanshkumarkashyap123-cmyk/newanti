
interface Node {
    x: number;
    y: number;
    z: number;
}

interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
}

export const generateDXF = (nodes: Map<string, Node>, members: Map<string, Member>): string => {
    let dxf = "";

    // Header
    dxf += "0\nSECTION\n2\nHEADER\n0\nENDSEC\n";

    // Tables (Layers)
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n";
    dxf += "0\nLAYER\n2\nBEAMLAB_MEMBERS\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n";

    // Entities
    dxf += "0\nSECTION\n2\nENTITIES\n";

    members.forEach((member) => {
        const startParams = nodes.get(member.startNodeId);
        const endParams = nodes.get(member.endNodeId);

        if (startParams && endParams) {
            dxf += "0\nLINE\n";
            dxf += "8\nBEAMLAB_MEMBERS\n"; // Layer
            dxf += `10\n${startParams.x}\n`;
            dxf += `20\n${startParams.y}\n`;
            dxf += `30\n${startParams.z}\n`;
            dxf += `11\n${endParams.x}\n`;
            dxf += `21\n${endParams.y}\n`;
            dxf += `31\n${endParams.z}\n`;
        }
    });

    dxf += "0\nENDSEC\n";
    dxf += "0\nEOF\n";

    return dxf;
};

export const downloadDXF = (dxfContent: string, filename: string) => {
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
