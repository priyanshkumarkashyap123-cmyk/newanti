/**
 * UI Integration Examples
 * Demonstrates usage of the new BeamLab UI component library
 */

import { FC, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Folder, Settings, Bell, User, Zap,
    TrendingUp, Box, Clock, ChevronRight
} from 'lucide-react';

// Import our new UI components
import {
    // Layout & Navigation
    Tabs, TabPanel, Breadcrumbs, Pagination, Stepper,

    // Overlays
    Modal, Drawer, Sheet, useModal, useDrawer, useSheet,

    // Data Display
    StatCard, ProgressRing, ProgressBar, Sparkline, Badge, Avatar, AvatarGroup,

    // Feedback
    Tooltip, Accordion, Divider, EmptyState, Button,

    // Notifications (via hook)
} from '../components/ui';

import { useAppNotifications } from '../components/providers/AppProviders';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '../components/ui/PageTransition';

// ============================================
// UI Showcase Component
// ============================================

export const UIShowcase: FC = () => {
    // State
    const [activeTab, setActiveTab] = useState('overview');
    const [currentPage, setCurrentPage] = useState(1);
    const [currentStep, setCurrentStep] = useState(1);

    // Hooks
    const modal = useModal();
    const drawer = useDrawer();
    const sheet = useSheet();
    const confirm = useConfirm();
    const { toast } = useAppNotifications();

    // Demo data
    const sparklineData = [10, 25, 15, 30, 20, 45, 35, 50, 40, 60];

    const handleDeleteDemo = async () => {
        const confirmed = await confirm({
            title: 'Delete Project?',
            message: 'This action cannot be undone. All project data will be permanently removed.',
            variant: 'danger',
            confirmText: 'Delete',
        });

        if (confirmed) {
            toast.success('Project deleted', 'The project has been removed.');
        }
    };

    return (
        <PageTransition className="min-h-screen bg-white dark:bg-slate-950 p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto">
                <FadeIn>
                    <Breadcrumbs
                        items={[
                            { label: 'Dashboard', onClick: () => { } },
                            { label: 'Components' },
                            { label: 'Showcase' },
                        ]}
                        className="mb-6"
                    />

                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                        UI Component Library
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-8">
                        Press <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm">⌘K</kbd> for command palette,
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm ml-2">⌘/</kbd> for keyboard shortcuts
                    </p>
                </FadeIn>

                {/* Tabs */}
                <Tabs
                    tabs={[
                        { id: 'overview', label: 'Overview', icon: <Box className="w-4 h-4" /> },
                        { id: 'data', label: 'Data Viz', badge: 6 },
                        { id: 'overlays', label: 'Overlays' },
                        { id: 'navigation', label: 'Navigation' },
                    ]}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    variant="pills"
                    className="mb-8"
                />

                {/* Overview Tab */}
                <TabPanel isActive={activeTab === 'overview'}>
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <StaggerItem>
                            <StatCard
                                title="Total Projects"
                                value={42}
                                trend={{ value: 12, label: 'vs last month' }}
                                icon={<Folder className="w-5 h-5" />}
                                color="blue"
                            />
                        </StaggerItem>
                        <StaggerItem>
                            <StatCard
                                title="Analysis Runs"
                                value="1,284"
                                trend={{ value: -5, label: 'vs last month' }}
                                icon={<Zap className="w-5 h-5" />}
                                color="purple"
                            />
                        </StaggerItem>
                        <StaggerItem>
                            <StatCard
                                title="Compute Hours"
                                value="89.2"
                                subtitle="hrs"
                                icon={<Clock className="w-5 h-5" />}
                                color="green"
                            />
                        </StaggerItem>
                    </StaggerContainer>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Badges & Avatars */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Badges & Avatars</h3>

                            <div className="flex flex-wrap gap-2 mb-6">
                                <Badge variant="success" dot>Active</Badge>
                                <Badge variant="warning">Pending</Badge>
                                <Badge variant="error">Failed</Badge>
                                <Badge variant="info">Info</Badge>
                                <Badge variant="outline">Draft</Badge>
                            </div>

                            <Divider label="Team Members" className="mb-4" />

                            <div className="flex items-center gap-4">
                                <AvatarGroup
                                    avatars={[
                                        { name: 'Alice Johnson' },
                                        { name: 'Bob Smith' },
                                        { name: 'Carol White' },
                                        { name: 'David Brown' },
                                        { name: 'Eve Davis' },
                                    ]}
                                    max={4}
                                />
                                <span className="text-slate-600 dark:text-slate-400 text-sm">5 team members</span>
                            </div>
                        </div>

                        {/* Progress Indicators */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Progress</h3>

                            <div className="flex items-center gap-6 mb-6">
                                <ProgressRing progress={75} color="green" label="Tasks" />
                                <ProgressRing progress={45} color="blue" size={60} />
                                <ProgressRing progress={90} color="purple" size={60} />
                            </div>

                            <ProgressBar progress={65} label="Storage Used" color="gradient" className="mb-3" />
                            <ProgressBar progress={30} label="CPU Usage" color="blue" />
                        </div>
                    </div>
                </TabPanel>

                {/* Data Viz Tab */}
                <TabPanel isActive={activeTab === 'data'}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Sparkline Charts</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Analysis Time</span>
                                    <Sparkline data={sparklineData} width={120} color="green" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Memory Usage</span>
                                    <Sparkline data={[30, 25, 40, 35, 45, 30, 50, 45, 55, 40]} width={120} color="blue" />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Tooltips</h3>
                            <div className="flex gap-4">
                                <Tooltip content="Top tooltip" position="top">
                                    <Button variant="outline">Top</Button>
                                </Tooltip>
                                <Tooltip content="Right tooltip" position="right">
                                    <Button variant="outline">Right</Button>
                                </Tooltip>
                                <Tooltip content="Bottom tooltip" position="bottom">
                                    <Button variant="outline">Bottom</Button>
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                </TabPanel>

                {/* Overlays Tab */}
                <TabPanel isActive={activeTab === 'overlays'}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Dialogs</h3>
                            <div className="flex flex-wrap gap-3">
                                <Button onClick={modal.open}>Open Modal</Button>
                                <Button variant="outline" onClick={drawer.open}>Open Drawer</Button>
                                <Button variant="outline" onClick={sheet.open}>Open Sheet</Button>
                                <Button variant="destructive" onClick={handleDeleteDemo}>Confirm Delete</Button>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Toast Notifications</h3>
                            <div className="flex flex-wrap gap-3">
                                <Button size="sm" onClick={() => toast.success('Success!', 'Operation completed.')}>
                                    Success
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => toast.error('Error', 'Something went wrong.')}>
                                    Error
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => toast.warning('Warning', 'Please review.')}>
                                    Warning
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => toast.info('Info', 'FYI message.')}>
                                    Info
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabPanel>

                {/* Navigation Tab */}
                <TabPanel isActive={activeTab === 'navigation'}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Stepper</h3>
                            <Stepper
                                steps={[
                                    { id: 'setup', label: 'Setup', description: 'Configure project' },
                                    { id: 'model', label: 'Model', description: 'Define geometry' },
                                    { id: 'analyze', label: 'Analyze', description: 'Run analysis' },
                                    { id: 'results', label: 'Results', description: 'View outputs' },
                                ]}
                                currentStep={currentStep}
                                onStepClick={setCurrentStep}
                                variant="horizontal"
                            />
                            <div className="flex gap-2 mt-6">
                                <Button size="sm" variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>
                                    Previous
                                </Button>
                                <Button size="sm" onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}>
                                    Next
                                </Button>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Pagination</h3>
                            <Pagination
                                currentPage={currentPage}
                                totalPages={10}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </div>

                    <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Accordion</h3>
                        <Accordion
                            items={[
                                { id: '1', title: 'What is BeamLab?', content: 'BeamLab is a next-generation structural engineering platform.' },
                                { id: '2', title: 'How do I get started?', content: 'Create a new project and start defining your structural model.' },
                                { id: '3', title: 'What analysis types are supported?', content: 'We support linear, nonlinear, modal, and dynamic analysis.' },
                            ]}
                            allowMultiple
                        />
                    </div>
                </TabPanel>

                {/* Modal */}
                <Modal
                    isOpen={modal.isOpen}
                    onClose={modal.close}
                    title="Example Modal"
                    description="This is a modal with customizable content."
                    size="md"
                    footer={
                        <>
                            <Button variant="ghost" onClick={modal.close}>Cancel</Button>
                            <Button onClick={modal.close}>Save Changes</Button>
                        </>
                    }
                >
                    <p className="text-slate-600 dark:text-slate-400">
                        Modal content goes here. You can put forms, information, or any other content.
                    </p>
                </Modal>

                {/* Drawer */}
                <Drawer
                    isOpen={drawer.isOpen}
                    onClose={drawer.close}
                    title="Properties Panel"
                    side="right"
                    size="md"
                >
                    <div className="space-y-4">
                        <p className="text-slate-600 dark:text-slate-400">
                            This is a side drawer, perfect for property panels and settings.
                        </p>
                        <ProgressBar progress={60} label="Loading..." color="blue" />
                    </div>
                </Drawer>

                {/* Sheet */}
                <Sheet
                    isOpen={sheet.isOpen}
                    onClose={sheet.close}
                    title="Quick Actions"
                    height="md"
                >
                    <div className="grid grid-cols-3 gap-4">
                        {['New Project', 'Import', 'Settings', 'Help', 'Export', 'Share'].map((action) => (
                            <button
                                key={action}
                                onClick={sheet.close}
                                className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <span className="text-zinc-900 dark:text-white font-medium">{action}</span>
                            </button>
                        ))}
                    </div>
                </Sheet>
            </div>
        </PageTransition>
    );
};

export default UIShowcase;
