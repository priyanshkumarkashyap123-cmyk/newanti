/**
 * DemoModelsPanel.tsx - Example Models Library UI
 * STAAD.Pro-style example model loader
 */

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
    BookOpen,
    Building2,
    Cable,
    Layers,
    TowerControl,
    FileText,
    Download,
    MapPin,
    Calendar,
    Ruler,
    User
} from 'lucide-react';
import { DEMO_MODELS, type DemoModel } from '../data/DemoModelsLibrary';
import { useModelStore } from '../store/model';

interface DemoModelsPanelProps {
    onLoadDemo?: (demo: DemoModel) => void;
}

export function DemoModelsPanel({ onLoadDemo }: DemoModelsPanelProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedDemo, setSelectedDemo] = useState<DemoModel | null>(null);
    const loadStructure = useModelStore((state) => state.loadStructure);

    const handleLoadDemo = (demo: DemoModel) => {
        // Load structure into model store using the proper store method
        loadStructure(demo.structure.nodes, demo.structure.members);

        // Notify parent component
        onLoadDemo?.(demo);
    };

    const getDifficultyColor = (difficulty: DemoModel['difficulty']) => {
        switch (difficulty) {
            case 'beginner': return 'bg-green-500';
            case 'intermediate': return 'bg-blue-500';
            case 'advanced': return 'bg-orange-500';
            case 'expert': return 'bg-red-500';
            default: return 'bg-slate-500';
        }
    };

    const getCategoryIcon = (category: DemoModel['category']) => {
        switch (category) {
            case 'buildings': return <Building2 className="w-4 h-4" />;
            case 'bridges': return <Cable className="w-4 h-4" />;
            case 'towers': return <TowerControl className="w-4 h-4" />;
            case 'trusses': return <Layers className="w-4 h-4" />;
            case 'frames': return <FileText className="w-4 h-4" />;
            default: return <BookOpen className="w-4 h-4" />;
        }
    };

    const filteredModels = selectedCategory === 'all'
        ? DEMO_MODELS
        : DEMO_MODELS.filter(m => m.category === selectedCategory);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <BookOpen className="w-4 h-4" />
                    Load Example Model
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Example Models Library</DialogTitle>
                    <DialogDescription>
                        Explore pre-configured structures inspired by real projects. Load, analyze, and learn from practical examples.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="all" className="w-full">
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="all" onClick={() => setSelectedCategory('all')}>
                            All Models
                        </TabsTrigger>
                        <TabsTrigger value="frames" onClick={() => setSelectedCategory('frames')}>
                            Frames
                        </TabsTrigger>
                        <TabsTrigger value="trusses" onClick={() => setSelectedCategory('trusses')}>
                            Trusses
                        </TabsTrigger>
                        <TabsTrigger value="bridges" onClick={() => setSelectedCategory('bridges')}>
                            Bridges
                        </TabsTrigger>
                        <TabsTrigger value="towers" onClick={() => setSelectedCategory('towers')}>
                            Towers
                        </TabsTrigger>
                        <TabsTrigger value="buildings" onClick={() => setSelectedCategory('buildings')}>
                            Buildings
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value={selectedCategory} className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredModels.map((demo) => (
                                <div
                                    key={demo.id}
                                    className="border border-[#1a2333] rounded-lg cursor-pointer hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all bg-slate-100/50 dark:bg-slate-800/50"
                                    onClick={() => setSelectedDemo(demo)}
                                >
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {getCategoryIcon(demo.category)}
                                                <h3 className="text-lg font-semibold">{demo.name}</h3>
                                            </div>
                                            <Badge className={getDifficultyColor(demo.difficulty)}>
                                                {demo.difficulty}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-[#869ab8] mb-4">{demo.description}</p>

                                        <div className="space-y-2 text-sm">
                                            {demo.metadata.realWorldStructure && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Building2 className="w-4 h-4" />
                                                    <span>{demo.metadata.realWorldStructure}</span>
                                                </div>
                                            )}
                                            {demo.metadata.location && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>{demo.metadata.location}</span>
                                                </div>
                                            )}
                                            {demo.metadata.yearBuilt && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>Built: {demo.metadata.yearBuilt}</span>
                                                </div>
                                            )}
                                            {(demo.metadata.height || demo.metadata.length) && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Ruler className="w-4 h-4" />
                                                    <span>
                                                        {demo.metadata.height && `Height: ${demo.metadata.height}m`}
                                                        {demo.metadata.height && demo.metadata.length && ' | '}
                                                        {demo.metadata.length && `Span: ${demo.metadata.length}m`}
                                                    </span>
                                                </div>
                                            )}
                                            {demo.metadata.designer && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <User className="w-4 h-4" />
                                                    <span>{demo.metadata.designer}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4">
                                            <p className="text-sm font-semibold mb-2">Learning Objectives:</p>
                                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                                {demo.learningObjectives.slice(0, 3).map((obj, idx) => (
                                                    <li key={idx}>{obj}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="mt-4">
                                            <Button
                                                className="w-full"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLoadDemo(demo);
                                                }}
                                            >
                                                <Download className="w-4 h-4 mr-2" />
                                                Load Model
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Detailed view when a demo is selected */}
                {selectedDemo && (
                    <Dialog open={!!selectedDemo} onOpenChange={() => setSelectedDemo(null)}>
                        <DialogContent className="max-w-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl flex items-center gap-2">
                                    {getCategoryIcon(selectedDemo.category)}
                                    {selectedDemo.name}
                                </DialogTitle>
                                <DialogDescription>{selectedDemo.description}</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                {/* Metadata */}
                                <div className="bg-muted p-4 rounded-lg space-y-2">
                                    <h3 className="font-semibold text-lg">Structure Details</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {selectedDemo.metadata.realWorldStructure && (
                                            <div>
                                                <span className="text-muted-foreground">Structure:</span>
                                                <p className="font-medium tracking-wide tracking-wide">{selectedDemo.metadata.realWorldStructure}</p>
                                            </div>
                                        )}
                                        {selectedDemo.metadata.location && (
                                            <div>
                                                <span className="text-muted-foreground">Location:</span>
                                                <p className="font-medium tracking-wide tracking-wide">{selectedDemo.metadata.location}</p>
                                            </div>
                                        )}
                                        {selectedDemo.metadata.yearBuilt && (
                                            <div>
                                                <span className="text-muted-foreground">Year Built:</span>
                                                <p className="font-medium tracking-wide tracking-wide">{selectedDemo.metadata.yearBuilt}</p>
                                            </div>
                                        )}
                                        {selectedDemo.metadata.designer && (
                                            <div>
                                                <span className="text-muted-foreground">Designer:</span>
                                                <p className="font-medium tracking-wide tracking-wide">{selectedDemo.metadata.designer}</p>
                                            </div>
                                        )}
                                        {selectedDemo.metadata.height && (
                                            <div>
                                                <span className="text-muted-foreground">Height:</span>
                                                <p className="font-medium tracking-wide tracking-wide">{selectedDemo.metadata.height}m</p>
                                            </div>
                                        )}
                                        {selectedDemo.metadata.length && (
                                            <div>
                                                <span className="text-muted-foreground">Length/Span:</span>
                                                <p className="font-medium tracking-wide tracking-wide">{selectedDemo.metadata.length}m</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Learning Objectives */}
                                <div>
                                    <h3 className="font-semibold text-lg mb-2">Learning Objectives</h3>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        {selectedDemo.learningObjectives.map((obj, idx) => (
                                            <li key={idx}>{obj}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Model Stats */}
                                <div className="grid grid-cols-3 gap-4 bg-muted p-4 rounded-lg text-center">
                                    <div>
                                        <p className="text-2xl font-bold">{selectedDemo.structure.nodes.length}</p>
                                        <p className="text-sm text-muted-foreground">Nodes</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{selectedDemo.structure.members.length}</p>
                                        <p className="text-sm text-muted-foreground">Members</p>
                                    </div>
                                    <div>
                                        <Badge className={getDifficultyColor(selectedDemo.difficulty)}>
                                            {selectedDemo.difficulty}
                                        </Badge>
                                        <p className="text-sm text-muted-foreground mt-1">Difficulty</p>
                                    </div>
                                </div>

                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={() => {
                                        handleLoadDemo(selectedDemo);
                                        setSelectedDemo(null);
                                    }}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Load {selectedDemo.name}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </DialogContent>
        </Dialog>
    );
}
