import { Skeleton } from './Skeleton';

export function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-950">
            {/* Header Skeleton */}
            <header className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-6 w-32" />
                            </div>
                            <div className="hidden md:flex items-center gap-4">
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-8 w-24" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <div className="h-6 w-px bg-slate-100 dark:bg-slate-800" />
                            <Skeleton className="h-9 w-24 rounded-lg" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <Skeleton className="h-10 w-64 mb-2" />
                    <Skeleton className="h-5 w-96" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between mb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-5" />
                            </div>
                            <Skeleton className="h-8 w-16 mb-2" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="mb-8">
                    <Skeleton className="h-7 w-32 mb-4" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-6 h-32 border border-slate-200 dark:border-slate-800">
                                <Skeleton className="h-8 w-8 mb-3" />
                                <Skeleton className="h-5 w-24 mb-2" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Projects */}
                    <div className="lg:col-span-2">
                        <div className="flex justify-between mb-4">
                            <Skeleton className="h-7 w-40" />
                            <div className="flex gap-2">
                                <Skeleton className="h-9 w-48" />
                                <Skeleton className="h-9 w-32" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-64">
                                    <Skeleton className="w-full h-32 rounded-lg mb-4" />
                                    <Skeleton className="h-6 w-3/4 mb-2" />
                                    <div className="flex gap-2 mb-4">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                    <div className="flex gap-2">
                                        <Skeleton className="h-5 w-20 rounded-full" />
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-64">
                            <Skeleton className="h-6 w-32 mb-4" />
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex gap-3">
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <div className="space-y-1 flex-1">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-3 w-20" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
