import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/model';
import { Ruler, Scissors, Calculator } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

interface SplitMemberDialogProps {
    isOpen: boolean;
    onClose: () => void;
    memberId?: string;
}

type SplitMethod = 'distance' | 'ratio' | 'midpoint';
type ReferencePoint = 'start' | 'end';

export function SplitMemberDialog({ isOpen, onClose, memberId }: SplitMemberDialogProps) {
    const [method, setMethod] = useState<SplitMethod>('midpoint');
    const [value, setValue] = useState<string>('0.5'); // Store as string for input handling
    const [reference, setReference] = useState<ReferencePoint>('start');

    // Store Actions & State
    const member = useModelStore(state => memberId ? state.members.get(memberId) : undefined);
    const nodes = useModelStore(state => state.nodes);
    const splitMemberById = useModelStore(state => state.splitMemberById);

    // Calculate Member Length
    const length = member ? (() => {
        const start = nodes.get(member.startNodeId);
        const end = nodes.get(member.endNodeId);
        if (!start || !end) return 0;
        return Math.sqrt(
            Math.pow(end.x - start.x, 2) +
            Math.pow(end.y - start.y, 2) +
            Math.pow(end.z - start.z, 2)
        );
    })() : 0;

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setMethod('midpoint');
            setValue('0.5');
            setReference('start');
        }
    }, [isOpen, memberId]);

    const handleSplit = () => {
        if (!memberId || !member) return;

        let ratio = 0.5;
        const numValue = parseFloat(value);

        if (isNaN(numValue) || numValue < 0) return;

        if (method === 'midpoint') {
            ratio = 0.5;
        } else if (method === 'ratio') {
            ratio = Math.max(0.01, Math.min(0.99, numValue));
            if (reference === 'end') ratio = 1 - ratio;
        } else if (method === 'distance') {
            if (length === 0) return;
            let dist = Math.max(0.001, Math.min(length - 0.001, numValue));
            ratio = dist / length;
            if (reference === 'end') ratio = 1 - ratio;
        }

        splitMemberById(memberId, ratio);
        onClose();
    };

    if (!member) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[400px] bg-zinc-900 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scissors className="w-5 h-5 text-blue-500" />
                        Insert Node into Member
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Method Selection */}
                    <div className="space-y-3">
                        <Label>Split Method</Label>
                        <RadioGroup
                            value={method}
                            onValueChange={(v) => setMethod(v as SplitMethod)}
                            className="grid grid-cols-3 gap-2"
                        >
                            <div>
                                <RadioGroupItem value="midpoint" id="midpoint" className="peer sr-only" />
                                <Label
                                    htmlFor="midpoint"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-zinc-700 bg-zinc-800 p-2 hover:bg-zinc-700 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:text-blue-500 cursor-pointer text-xs gap-2 h-20"
                                >
                                    <Calculator className="h-5 w-5" />
                                    Midpoint
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="distance" id="distance" className="peer sr-only" />
                                <Label
                                    htmlFor="distance"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-zinc-700 bg-zinc-800 p-2 hover:bg-zinc-700 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:text-blue-500 cursor-pointer text-xs gap-2 h-20"
                                >
                                    <Ruler className="h-5 w-5" />
                                    Distance
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="ratio" id="ratio" className="peer sr-only" />
                                <Label
                                    htmlFor="ratio"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-zinc-700 bg-zinc-800 p-2 hover:bg-zinc-700 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:text-blue-500 cursor-pointer text-xs gap-2 h-20"
                                >
                                    <span className="text-lg font-bold">%</span>
                                    Ratio
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Inputs */}
                    {method !== 'midpoint' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="space-y-2">
                                <Label>{method === 'distance' ? 'Length (m)' : 'Ratio (0-1)'}</Label>
                                <Input
                                    type="number"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    className="bg-zinc-950 border-zinc-700"
                                    step={method === 'distance' ? "0.1" : "0.05"}
                                />
                                {method === 'distance' && (
                                    <p className="text-[10px] text-zinc-500">Max: {length.toFixed(3)}m</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>From</Label>
                                <Select value={reference} onValueChange={(v) => setReference(v as ReferencePoint)}>
                                    <SelectTrigger className="bg-zinc-950 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="start">Start Node</SelectItem>
                                        <SelectItem value="end">End Node</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Info */}
                    <div className="rounded-md bg-zinc-950 p-3 text-xs text-zinc-400 border border-zinc-800">
                        <p>Total Length: <span className="text-zinc-200 font-mono">{length.toFixed(3)} m</span></p>
                        <p>Member ID: <span className="text-zinc-200 font-mono">{memberId}</span></p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="border-zinc-700 hover:bg-zinc-800">
                        Cancel
                    </Button>
                    <Button onClick={handleSplit} className="bg-blue-600 hover:bg-blue-700 text-white">
                        Insert Node
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
