/**
 * StructureGallery.tsx - Iconic Civil Engineering Structures Showcase
 * 
 * Displays famous structures that users can load as templates
 * Demonstrates the capabilities of BeamLab Ultimate
 */

import { FC, useState } from 'react';
import { Building2, Grid3x3, LayoutGrid, Layers, Search, Sparkles } from 'lucide-react';
import { FAMOUS_STRUCTURES_TEMPLATES, generateFromTemplate, type TemplateInfo } from '../../services/StructureFactory';
import { useModelStore } from '../../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';

interface StructureGalleryProps {
    isOpen: boolean;
    onClose: () => void;
}

const categoryIcons: Record<TemplateInfo['category'], any> = {
    'high-rise': Building2,
    'arch': Grid3x3,
    'cable-stayed': Grid3x3,
    'suspension': Grid3x3,
    'truss': LayoutGrid,
    'viaduct': Layers,
    'interchange': Layers
};

const categoryNames: Record<TemplateInfo['category'], string> = {
    'high-rise': 'High-Rise Buildings',
    'arch': 'Arch Bridges',
    'cable-stayed': 'Cable-Stayed Bridges',
    'suspension': 'Suspension Bridges',
    'truss': 'Truss Structures',
    'viaduct': 'Viaducts & Elevated',
    'interchange': 'Interchanges'
};

export const StructureGallery: FC<StructureGalleryProps> = ({ isOpen, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState<TemplateInfo['category'] | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const loadStructure = useModelStore((state) => state.loadStructure);
    const clearModel = useModelStore((state) => state.clearModel);

    const categories: Array<TemplateInfo['category'] | 'all'> = [
        'all',
        'high-rise',
        'arch',
        'cable-stayed',
        'suspension',
        'truss',
        'viaduct',
        'interchange'
    ];

    const filteredTemplates = FAMOUS_STRUCTURES_TEMPLATES.filter(template => {
        const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
        const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleLoadTemplate = (templateId: string) => {
        const structure = generateFromTemplate(templateId);
        if (structure) {
            // Clear existing model first
            clearModel();

            // Load new structure using the proper store method
            loadStructure(structure.nodes, structure.members);

            onClose();

            // Show success notification
// console.log(`Loaded: ${structure.name}`);
// console.log(`Nodes: ${structure.metadata.totalNodes}, Members: ${structure.metadata.totalMembers}`);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl h-[85vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-zinc-100 to-white dark:from-slate-800 dark:to-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <Sparkles className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-bold">Iconic Structures Gallery</DialogTitle>
                            <DialogDescription>
                                Load famous civil engineering structures to showcase BeamLab capabilities
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Search and Filter */}
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-slate-800/50">
                    <div className="flex gap-4 items-center">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                            <Input
                                type="text"
                                placeholder="Search structures..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Category Filter */}
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as any)}
                            className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {category === 'all' ? 'All Categories' : categoryNames[category]}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Gallery Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {filteredTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
                            <Search className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg">No structures found</p>
                            <p className="text-sm">Try adjusting your search or category filter</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTemplates.map((template) => {
                                const Icon = categoryIcons[template.category];
                                return (
                                    <div
                                        key={template.id}
                                        className="group relative bg-zinc-100 dark:bg-slate-800 rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all cursor-pointer"
                                        onClick={() => handleLoadTemplate(template.id)}
                                    >
                                        {/* Thumbnail Image */}
                                        <div className="h-48 bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center relative overflow-hidden">
                                            <img
                                                src={`/structures/${template.id}.png`}
                                                alt={template.name}
                                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                onError={(e) => {
                                                    // Fallback to icon if image fails to load
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                            <div className="hidden absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors flex items-center justify-center">
                                                <Icon className="w-20 h-20 text-zinc-500 dark:text-slate-500 group-hover:text-emerald-400 transition-colors" />
                                            </div>

                                            {/* Category Badge */}
                                            <div className="absolute top-3 right-3 px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full text-xs text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/30">
                                                {categoryNames[template.category]}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-4">
                                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-emerald-400 transition-colors">
                                                {template.name}
                                            </h3>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                                {template.description}
                                            </p>

                                            {/* Load Button */}
                                            <button className="mt-4 w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg font-medium transition-colors border border-emerald-500/30 group-hover:border-emerald-500">
                                                Load Structure
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                        <span>{filteredTemplates.length} structures available</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Click any structure to load it instantly</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default StructureGallery;
