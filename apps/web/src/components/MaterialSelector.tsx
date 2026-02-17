import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import axios from 'axios';
import { API_CONFIG } from '../config/env';

interface MaterialSelectorProps {
    onMaterialSelect: (materialId: string) => void;
    className?: string;
}

export function MaterialSelector({ onMaterialSelect, className }: MaterialSelectorProps) {
    const [materialType, setMaterialType] = useState<'steel' | 'concrete'>('steel');
    const [createdMaterials, setCreatedMaterials] = useState<Array<{ id: string, name: string }>>([]);
    const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');

    // Steel properties
    const [steelProps, setSteelProps] = useState({
        fy: 250.0,
        E: 200000.0,
        plastic_modulus: 2000.0,
        density: 7850.0
    });

    // Concrete properties
    const [concreteProps, setConcreteProps] = useState({
        fck: 30.0,
        E: 0.0, // 0 means auto-calculate
        density: 2400.0
    });


    const handleCreateMaterial = async () => {
        try {
            let payload: any = { type: materialType };

            if (materialType === 'steel') {
                payload = { ...payload, ...steelProps };
            } else {
                payload = { ...payload, ...concreteProps };
                // Remove E if it's 0 to let backend auto-calculate
                if (payload.E === 0) delete payload.E;
            }

            console.log('Creating material:', payload);
            const response = await axios.post(`${API_CONFIG.pythonUrl}/materials/create`, payload);

            if (response.data.success) {
                const newId = response.data.material_id;
                const name = materialType === 'steel'
                    ? `Steel (fy=${steelProps.fy})`
                    : `Concrete (fck=${concreteProps.fck})`;

                setCreatedMaterials(prev => [...prev, { id: newId, name }]);
                setSelectedMaterialId(newId);
                onMaterialSelect(newId);
            }
        } catch (error) {
            console.error('Failed to create material:', error);
            alert('Failed to create material. Ensure backend is running.');
        }
    };

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex justify-between items-center">
                <Label>Material</Label>
                <span className="text-xs text-gray-500">Non-linear models</span>
            </div>

            <Tabs value={materialType} onValueChange={(v) => setMaterialType(v as 'steel' | 'concrete')}>
                <TabsList className="w-full">
                    <TabsTrigger value="steel" className="flex-1">Steel (Elastic-Plastic)</TabsTrigger>
                    <TabsTrigger value="concrete" className="flex-1">Concrete (Non-linear)</TabsTrigger>
                </TabsList>

                <Card className="p-3 mt-2 space-y-3 bg-slate-50">
                    <TabsContent value="steel" className="mt-0 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Yield Strength (fy)</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        value={steelProps.fy}
                                        onChange={e => setSteelProps({ ...steelProps, fy: parseFloat(e.target.value) })}
                                        className="h-8 text-sm"
                                    />
                                    <span className="text-xs text-gray-500">MPa</span>
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Young's Modulus (E)</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        value={steelProps.E}
                                        onChange={e => setSteelProps({ ...steelProps, E: parseFloat(e.target.value) })}
                                        className="h-8 text-sm"
                                    />
                                    <span className="text-xs text-gray-500">MPa</span>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="concrete" className="mt-0 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Comp. Strength (fck)</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        value={concreteProps.fck}
                                        onChange={e => setConcreteProps({ ...concreteProps, fck: parseFloat(e.target.value) })}
                                        className="h-8 text-sm"
                                    />
                                    <span className="text-xs text-gray-500">MPa</span>
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Density</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        value={concreteProps.density}
                                        onChange={e => setConcreteProps({ ...concreteProps, density: parseFloat(e.target.value) })}
                                        className="h-8 text-sm"
                                    />
                                    <span className="text-xs text-gray-500">kg/m³</span>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <Button size="sm" onClick={handleCreateMaterial} className="w-full">
                        Create & Select Material
                    </Button>
                </Card>
            </Tabs>

            {createdMaterials.length > 0 && (
                <div className="space-y-2">
                    <Label className="text-xs">Selected Material</Label>
                    <Select value={selectedMaterialId} onValueChange={(v) => { setSelectedMaterialId(v); onMaterialSelect(v); }}>
                        <SelectTrigger className="h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {createdMaterials.map(mat => (
                                <SelectItem key={mat.id} value={mat.id}>{mat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}
