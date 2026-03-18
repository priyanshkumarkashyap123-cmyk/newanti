import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Calculator, Shapes, Save, Download, Upload } from 'lucide-react';
import axios from 'axios';
import { API_CONFIG } from '../config/env';
import { getApiErrorMessage } from '../lib/errorHandling';
import { useAuth } from '../providers/AuthProvider';

interface Point {
    x: number;
    y: number;
}

interface SectionProperties {
    area: number;
    centroid_x: number;
    centroid_y: number;
    Ixx: number;
    Iyy: number;
    Ixy: number;
    Zxx: number;
    Zyy: number;
    Zpxx: number;
    Zpyy: number;
    rxx: number;
    ryy: number;
    I1: number;
    I2: number;
    principal_angle: number;
    weight_per_meter: number;
}

interface SectionDesignerDialogProps {
    open: boolean;
    onClose: () => void;
    onSave?: (section: any) => void;
}

export function SectionDesignerDialog({ open, onClose, onSave }: SectionDesignerDialogProps) {
    const { getToken } = useAuth();
    const [activeTab, setActiveTab] = useState<'standard' | 'custom' | 'built_up'>('standard');
    const [shapeType, setShapeType] = useState('i_beam');
    const [dimensions, setDimensions] = useState<Record<string, number>>({
        depth: 300,
        width: 150,
        web_thickness: 7.5,
        flange_thickness: 10.8,
    });
    const [sectionName, setSectionName] = useState('ISMB 300');
    const [points, setPoints] = useState<Point[]>([]);
    const [properties, setProperties] = useState<SectionProperties | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Available standard shapes
    const standardShapes = [
        { value: 'i_beam', label: 'I-Beam (W-Shape)' },
        { value: 'channel', label: 'Channel (C-Shape)' },
        { value: 'angle', label: 'Angle (L-Shape)' },
        { value: 'rectangular', label: 'Rectangle' },
        { value: 'circular', label: 'Circle' },
        { value: 'tee', label: 'T-Section' },
        { value: 'built_up_i', label: 'Built-up I-Section (Plate Girder)' },
        { value: 'composite_beam', label: 'Composite Beam (Steel+Concrete)' },
        { value: 'lipped_channel', label: 'Lipped Channel (Cold Formed)' },
    ];

    // Dimension fields for each shape type
    const dimensionFields: Record<string, Array<{ name: string, label: string, unit: string }>> = {
        i_beam: [
            { name: 'depth', label: 'Depth', unit: 'mm' },
            { name: 'width', label: 'Flange Width', unit: 'mm' },
            { name: 'web_thickness', label: 'Web Thickness', unit: 'mm' },
            { name: 'flange_thickness', label: 'Flange Thickness', unit: 'mm' },
        ],
        channel: [
            { name: 'depth', label: 'Depth', unit: 'mm' },
            { name: 'width', label: 'Flange Width', unit: 'mm' },
            { name: 'web_thickness', label: 'Web Thickness', unit: 'mm' },
            { name: 'flange_thickness', label: 'Flange Thickness', unit: 'mm' },
        ],
        angle: [
            { name: 'leg1', label: 'Leg 1', unit: 'mm' },
            { name: 'leg2', label: 'Leg 2', unit: 'mm' },
            { name: 'thickness', label: 'Thickness', unit: 'mm' },
        ],
        rectangular: [
            { name: 'width', label: 'Width', unit: 'mm' },
            { name: 'depth', label: 'Depth', unit: 'mm' },
        ],
        circular: [
            { name: 'diameter', label: 'Diameter', unit: 'mm' },
        ],
        tee: [
            { name: 'width', label: 'Flange Width', unit: 'mm' },
            { name: 'depth', label: 'Total Depth', unit: 'mm' },
            { name: 'web_thickness', label: 'Web Thickness', unit: 'mm' },
            { name: 'flange_thickness', label: 'Flange Thickness', unit: 'mm' },
        ],
        built_up_i: [
            { name: 'depth', label: 'Total Depth', unit: 'mm' },
            { name: 'top_width', label: 'Top Fl Width', unit: 'mm' },
            { name: 'bot_width', label: 'Bot Fl Width', unit: 'mm' },
            { name: 'web_thickness', label: 'Web Thick', unit: 'mm' },
            { name: 'top_thickness', label: 'Top Fl Thick', unit: 'mm' },
            { name: 'bot_thickness', label: 'Bot Fl Thick', unit: 'mm' },
        ],
        composite_beam: [
            { name: 'depth', label: 'Steel Depth', unit: 'mm' },
            { name: 'width', label: 'Steel Fl Width', unit: 'mm' },
            { name: 'web_thickness', label: 'Web Thick', unit: 'mm' },
            { name: 'flange_thickness', label: 'Flange Thick', unit: 'mm' },
            { name: 'slab_width', label: 'Slab Width', unit: 'mm' },
            { name: 'slab_thickness', label: 'Slab Thick', unit: 'mm' },
            { name: 'modular_ratio', label: 'Mod Ratio (n)', unit: '' }
        ],
        lipped_channel: [
            { name: 'depth', label: 'Depth', unit: 'mm' },
            { name: 'width', label: 'Width', unit: 'mm' },
            { name: 'thickness', label: 'Thickness', unit: 'mm' },
            { name: 'lip', label: 'Lip Length', unit: 'mm' },
        ]
    };

    // Calculate section properties
    const calculateProperties = async () => {
        setLoading(true);
        setError(null);

        try {
            // Get auth token for authenticated API requests
            const token = await getToken();
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            if (activeTab === 'standard') {
                // Use standard shape endpoint
                const response = await axios.post(`${API_CONFIG.pythonUrl}/sections/standard/create`, {
                    shape_type: shapeType,
                    dimensions: dimensions,
                    name: sectionName,
                }, { headers });

                if (response.data.success) {
                    setPoints(response.data.section.points);
                    setProperties(response.data.section.properties);
                }
            } else {
                // Use custom section endpoint
                const response = await axios.post(`${API_CONFIG.pythonUrl}/sections/custom/calculate`, {
                    points: points,
                    name: sectionName,
                    material_density: 7850,
                }, { headers });

                if (response.data.success) {
                    setProperties(response.data.section.properties);
                }
            }
        } catch (err: unknown) {
            console.error('Section calculation error:', err);
            setError(getApiErrorMessage(err, 'Failed to calculate section properties'));
        } finally {
            setLoading(false);
        }
    };

    // Draw section on canvas
    useEffect(() => {
        if (!canvasRef.current || points.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Find bounds
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = maxX - minX;
        const height = maxY - minY;

        // Calculate scale and offset
        const padding = 40;
        const scaleX = (canvas.width - 2 * padding) / width;
        const scaleY = (canvas.height - 2 * padding) / height;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (canvas.width - width * scale) / 2 - minX * scale;
        const offsetY = (canvas.height - height * scale) / 2 - minY * scale;

        // Draw axes
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();

        // X-axis
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        ctx.setLineDash([]);

        // Draw section
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        points.forEach((point, i) => {
            const x = point.x * scale + offsetX;
            const y = canvas.height - (point.y * scale + offsetY); // Flip Y

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw centroid if available
        if (properties) {
            const cx = properties.centroid_x * scale + offsetX;
            const cy = canvas.height - (properties.centroid_y * scale + offsetY);

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
            ctx.fill();

            // Label
            ctx.fillStyle = '#000';
            ctx.font = '12px sans-serif';
            ctx.fillText('CG', cx + 10, cy - 10);
        }
    }, [points, properties]);

    // Update dimensions when shape type changes
    useEffect(() => {
        // Set default dimensions for new shape
        const defaults: Record<string, Record<string, number>> = {
            i_beam: { depth: 300, width: 150, web_thickness: 7.5, flange_thickness: 10.8 },
            channel: { depth: 200, width: 75, web_thickness: 6, flange_thickness: 10 },
            angle: { leg1: 100, leg2: 100, thickness: 10 },
            rectangular: { width: 200, depth: 400 },
            circular: { diameter: 200 },
            tee: { width: 150, depth: 200, web_thickness: 8, flange_thickness: 12 },
            built_up_i: { depth: 500, top_width: 250, bot_width: 250, web_thickness: 10, top_thickness: 16, bot_thickness: 16 },
            composite_beam: { depth: 400, width: 200, web_thickness: 8, flange_thickness: 14, slab_width: 1000, slab_thickness: 120, modular_ratio: 8 },
            lipped_channel: { depth: 200, width: 75, thickness: 2, lip: 20 },
        };

        setDimensions(defaults[shapeType] || {});
    }, [shapeType]);

    // Auto-calculate when dimensions change
    useEffect(() => {
        if (activeTab === 'standard' && Object.keys(dimensions).length > 0) {
            const timeoutId = setTimeout(() => {
                calculateProperties();
            }, 500);

            return () => clearTimeout(timeoutId);
        }
        return undefined;
    }, [dimensions, activeTab, shapeType]);

    const handleSave = () => {
        if (properties && onSave) {
            onSave({
                name: sectionName,
                properties,
                points,
            });
        }
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        Custom Section Designer
                    </DialogTitle>
                    <DialogDescription>
                        Design custom sections or use standard shapes with automatic property calculation
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6">
                    {/* Left Panel - Input */}
                    <div className="space-y-4">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="standard">Standard Shapes</TabsTrigger>
                                <TabsTrigger value="custom">Custom Points</TabsTrigger>
                                <TabsTrigger value="built_up">Built-Up</TabsTrigger>
                            </TabsList>

                            <TabsContent value="standard" className="space-y-4">
                                {/* Section Name */}
                                <div>
                                    <Label>Section Name</Label>
                                    <Input
                                        value={sectionName}
                                        onChange={(e) => setSectionName(e.target.value)}
                                        placeholder="e.g., ISMB 300"
                                    />
                                </div>

                                {/* Shape Type */}
                                <div>
                                    <Label>Shape Type</Label>
                                    <Select value={shapeType} onValueChange={setShapeType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {standardShapes.map(shape => (
                                                <SelectItem key={shape.value} value={shape.value}>
                                                    {shape.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Dimensions */}
                                <div className="space-y-3">
                                    <Label>Dimensions</Label>
                                    {dimensionFields[shapeType]?.map(field => (
                                        <div key={field.name} className="grid grid-cols-3 gap-2 items-center">
                                            <Label className="col-span-1 text-sm">
                                                {field.label}:
                                            </Label>
                                            <Input
                                                type="number"
                                                className="col-span-1"
                                                value={dimensions[field.name] || ''}
                                                onChange={(e) => setDimensions({
                                                    ...dimensions,
                                                    [field.name]: parseFloat(e.target.value) || 0
                                                })}
                                            />
                                            <span className="col-span-1 text-sm text-slate-500">{field.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="custom" className="space-y-4">
                                <div className="text-sm text-slate-600">
                                    Click on the canvas to add points (counter-clockwise)
                                </div>

                                {/* Point List */}
                                <ScrollArea className="h-48 border rounded p-2">
                                    {points.map((point, i) => (
                                        <div key={i} className="flex justify-between items-center p-1 hover:bg-slate-50">
                                            <span className="text-sm">
                                                Point {i + 1}: ({point.x.toFixed(1)}, {point.y.toFixed(1)})
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setPoints(points.filter((_, idx) => idx !== i))}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    ))}
                                </ScrollArea>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPoints([])}
                                    >
                                        Clear All
                                    </Button>
                                    <Button
                                        onClick={calculateProperties}
                                        disabled={points.length < 3 || loading}
                                    >
                                        {loading ? 'Calculating...' : 'Calculate Properties'}
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="built_up" className="space-y-4">
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    <p className="font-medium mb-2">Built-Up Section</p>
                                    <p>Combine standard shapes to create composite cross-sections.</p>
                                    <p className="mt-1 text-xs">Use the Section Builder to add components and compute combined properties using the parallel axis theorem.</p>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                                    <p className="font-medium text-blue-700 dark:text-blue-300">Built-Up Section Tool</p>
                                    <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                                        Add 2+ standard shapes, specify centroid offsets (X, Y in mm), and the combined section properties will be computed automatically using the parallel axis theorem.
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Visualization & Results */}
                    <div className="space-y-4">
                        {/* Canvas */}
                        <Card className="p-2">
                            <canvas
                                ref={canvasRef}
                                width={400}
                                height={300}
                                className="border rounded bg-white cursor-crosshair"
                                onClick={(e) => {
                                    if (activeTab === 'custom') {
                                        const rect = canvasRef.current?.getBoundingClientRect();
                                        if (rect) {
                                            const x = e.clientX - rect.left - rect.width / 2;
                                            const y = rect.height / 2 - (e.clientY - rect.top);
                                            setPoints([...points, { x, y }]);
                                        }
                                    }
                                }}
                            />
                        </Card>

                        {/* Properties */}
                        {properties && (
                            <Card className="p-4">
                                <h3 className="font-semibold mb-3">Section Properties</h3>
                                <ScrollArea className="h-64">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <PropertyRow label="Area" value={properties.area} unit="mm²" />
                                        <PropertyRow label="Weight" value={properties.weight_per_meter} unit="kg/m" />
                                        <PropertyRow label="Cx" value={properties.centroid_x} unit="mm" />
                                        <PropertyRow label="Cy" value={properties.centroid_y} unit="mm" />
                                        <PropertyRow label="Ixx" value={properties.Ixx} unit="mm⁴" decimal={0} />
                                        <PropertyRow label="Iyy" value={properties.Iyy} unit="mm⁴" decimal={0} />
                                        <PropertyRow label="Zxx" value={properties.Zxx} unit="mm³" decimal={0} />
                                        <PropertyRow label="Zyy" value={properties.Zyy} unit="mm³" decimal={0} />
                                        <PropertyRow label="Zpxx" value={properties.Zpxx} unit="mm³" decimal={0} />
                                        <PropertyRow label="Zpyy" value={properties.Zpyy} unit="mm³" decimal={0} />
                                        <PropertyRow label="rxx" value={properties.rxx} unit="mm" />
                                        <PropertyRow label="ryy" value={properties.ryy} unit="mm" />
                                        <PropertyRow label="I₁" value={properties.I1} unit="mm⁴" decimal={0} />
                                        <PropertyRow label="I₂" value={properties.I2} unit="mm⁴" decimal={0} />
                                        <PropertyRow label="θ" value={properties.principal_angle} unit="°" />
                                    </div>
                                </ScrollArea>
                            </Card>
                        )}
                    </div>
                </div>

                <div className="flex justify-between w-full">
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Upload className="w-4 h-4 mr-2" /> Import DXF
                        </Button>
                        <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" /> Export
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!properties}>
                            <Save className="w-4 h-4 mr-2" />
                            Save Section
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Helper component for property display
function PropertyRow({
    label,
    value,
    unit,
    decimal = 2
}: {
    label: string;
    value: number;
    unit: string;
    decimal?: number;
}) {
    return (
        <>
            <div className="font-medium text-slate-700">{label}:</div>
            <div className="text-right">
                {value.toLocaleString(undefined, {
                    minimumFractionDigits: decimal,
                    maximumFractionDigits: decimal
                })} <span className="text-slate-500">{unit}</span>
            </div>
        </>
    );
}
