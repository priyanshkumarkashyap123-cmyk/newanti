/**
 * ============================================================================
 * CONNECTION ANALYSIS RESULTS PANEL (RADIX/TAILWIND VERSION)
 * ============================================================================
 * 
 * Comprehensive display of bolted connection analysis results
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.1
 */

import React, { useState, useMemo } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Copy,
  Shield,
  Target,
  Activity,
  BarChart2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  DesignCheck,
  BoltForces,
  CalculationStep,
} from '../types/BoltedConnectionTypes';

// ============================================================================
// INTERFACES
// ============================================================================

interface AnalysisResult {
  isAdequate: boolean;
  maxDCR: number;
  governingCheck: string;
  criticalBolt: string;
  checks: DesignCheck[];
  boltForces: Map<string, BoltForces>;
  calculations: CalculationStep[];
  blockShear?: {
    designStrength: number;
    failurePath: string;
  };
  bearing?: Array<{
    boltId: string;
    capacity: number;
  }>;
  prying?: {
    isPryingSignificant: boolean;
    pryingForce: number;
    pryingRatio: number;
  };
  analysisTime: number;
  warnings: string[];
}

interface ConnectionAnalysisResultsPanelProps {
  result: AnalysisResult;
  onExportReport?: () => void;
  onCopyCalculations?: () => void;
  showDetailedCalcs?: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getStatusColor(dcr: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (dcr <= 0.75) return 'default';
  if (dcr <= 0.9) return 'secondary';
  if (dcr <= 1.0) return 'outline';
  return 'destructive';
}

function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

// ============================================================================
// COMPONENTS
// ============================================================================

const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  status?: 'success' | 'warning' | 'error' | 'info';
}> = ({ title, value, subtitle, icon, status = 'info' }) => {
  const borderColor = {
    success: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    error: 'border-l-red-500',
    info: 'border-l-blue-500',
  }[status];

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            {icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DesignCheckRow: React.FC<{
  check: DesignCheck;
  expanded: boolean;
  onToggle: () => void;
}> = ({ check, expanded, onToggle }) => {
  return (
    <div
      className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
        check.passed ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {check.passed ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 text-red-600" />
          )}
          <div>
            <p className="text-sm font-semibold">{check.name}</p>
            <p className="text-xs text-muted-foreground">{check.codeReference}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Demand / Capacity</p>
            <p className="text-sm font-medium">
              {formatNumber(check.demand)} / {formatNumber(check.capacity)} kN
            </p>
          </div>
          <Badge variant={getStatusColor(check.dcr)}>
            {(check.dcr * 100).toFixed(0)}%
          </Badge>
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                check.dcr > 1 ? 'bg-red-500' : check.dcr > 0.9 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(check.dcr * 100, 100)}%` }}
            />
          </div>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {expanded && check.calculationSteps && check.calculationSteps.length > 0 && (
        <div className="mt-3 p-3 bg-background rounded-md">
          <p className="text-xs font-semibold mb-2">Calculation Steps:</p>
          {check.calculationSteps.map((step, idx) => (
            <div key={idx} className="mb-2 pl-3 border-l-2 border-blue-300">
              <p className="text-xs font-medium">
                {step.stepNumber}. {step.description}
              </p>
              <code className="text-xs block p-1 my-1 bg-muted rounded">
                {step.formula}
              </code>
              <p className="text-xs text-muted-foreground">
                = {formatNumber(step.result)} {step.unit}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ConnectionAnalysisResultsPanel: React.FC<ConnectionAnalysisResultsPanelProps> = ({
  result,
  onExportReport,
  onCopyCalculations,
  showDetailedCalcs = true,
}) => {
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  const stats = useMemo(() => {
    const passedChecks = result.checks.filter(c => c.passed).length;
    const totalChecks = result.checks.length;
    const avgUtilization = result.checks.reduce((sum, c) => sum + c.dcr, 0) / totalChecks;
    
    return {
      passedChecks,
      totalChecks,
      avgUtilization,
    };
  }, [result]);

  const boltForcesArray = Array.from(result.boltForces.entries());

  return (
    <Card>
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            result.isAdequate ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {result.isAdequate ? (
              <CheckCircle className="w-5 h-5 text-slate-900 dark:text-white" />
            ) : (
              <XCircle className="w-5 h-5 text-slate-900 dark:text-white" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Analysis Results</CardTitle>
              <Badge variant={result.isAdequate ? 'default' : 'destructive'}>
                {result.isAdequate ? 'ADEQUATE' : 'INADEQUATE'}
              </Badge>
            </div>
            <CardDescription>
              Analysis completed in {result.analysisTime.toFixed(0)}ms
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCopyCalculations}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={onExportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border-b flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Warnings</p>
              <ul className="text-xs text-yellow-700 dark:text-yellow-300">
                {result.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 p-4">
          <SummaryCard
            title="Overall Status"
            value={result.isAdequate ? 'PASS' : 'FAIL'}
            subtitle={result.governingCheck}
            icon={<Shield className="w-5 h-5" style={{ color: result.isAdequate ? '#22C55E' : '#EF4444' }} />}
            status={result.isAdequate ? 'success' : 'error'}
          />
          <SummaryCard
            title="Max Utilization"
            value={`${(result.maxDCR * 100).toFixed(0)}%`}
            subtitle={`Critical: ${result.criticalBolt}`}
            icon={<Target className="w-5 h-5 text-blue-500" />}
            status={result.maxDCR > 1 ? 'error' : result.maxDCR > 0.9 ? 'warning' : 'success'}
          />
          <SummaryCard
            title="Checks Passed"
            value={`${stats.passedChecks}/${stats.totalChecks}`}
            subtitle={`${((stats.passedChecks / stats.totalChecks) * 100).toFixed(0)}% pass rate`}
            icon={<Activity className="w-5 h-5 text-purple-500" />}
            status={stats.passedChecks === stats.totalChecks ? 'success' : 'warning'}
          />
          <SummaryCard
            title="Avg. Utilization"
            value={`${(stats.avgUtilization * 100).toFixed(0)}%`}
            subtitle="Across all checks"
            icon={<BarChart2 className="w-5 h-5 text-amber-500" />}
            status={stats.avgUtilization > 0.85 ? 'warning' : 'info'}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="checks" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mx-4" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="checks" className="text-xs">Design Checks</TabsTrigger>
            <TabsTrigger value="forces" className="text-xs">Bolt Forces</TabsTrigger>
            {showDetailedCalcs && <TabsTrigger value="calcs" className="text-xs">Calculations</TabsTrigger>}
            <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="checks" className="p-4 m-0">
            {result.checks.map((check) => (
              <DesignCheckRow
                key={check.id}
                check={check}
                expanded={expandedCheck === check.id}
                onToggle={() => setExpandedCheck(expandedCheck === check.id ? null : check.id)}
              />
            ))}
          </TabsContent>

          <TabsContent value="forces" className="p-4 m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bolt</TableHead>
                  <TableHead className="text-right">Direct Shear (kN)</TableHead>
                  <TableHead className="text-right">Torsional Shear (kN)</TableHead>
                  <TableHead className="text-right">Resultant Shear (kN)</TableHead>
                  <TableHead className="text-right">Tension (kN)</TableHead>
                  <TableHead className="text-right">Combined Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boltForcesArray.map(([id, force]) => (
                  <TableRow
                    key={id}
                    className={force.combinedRatio > 1 ? 'bg-red-50 dark:bg-red-950' : ''}
                  >
                    <TableCell className="font-medium">{id}</TableCell>
                    <TableCell className="text-right">{formatNumber(force.directShear)}</TableCell>
                    <TableCell className="text-right">{formatNumber(force.torsionalShear)}</TableCell>
                    <TableCell className="text-right">{formatNumber(force.resultantShear)}</TableCell>
                    <TableCell className="text-right">
                      {force.totalTension > 0 ? formatNumber(force.totalTension) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getStatusColor(force.combinedRatio)}>
                        {(force.combinedRatio * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {showDetailedCalcs && (
            <TabsContent value="calcs" className="p-4 m-0 space-y-3">
              {result.calculations.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-muted/50 rounded-lg border-l-4 border-blue-400"
                >
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="secondary">Step {step.stepNumber}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Result: <strong>{formatNumber(step.result)} {step.unit}</strong>
                    </span>
                  </div>
                  <p className="text-sm font-semibold mb-2">{step.description}</p>
                  <code className="block p-2 bg-background rounded text-sm">
                    {step.formula}
                  </code>
                  {Object.keys(step.variables).length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {Object.entries(step.variables).map(([key, info]) => (
                        <div key={key} className="p-2 bg-background rounded text-xs">
                          <span className="text-muted-foreground">{info.description}</span>
                          <br />
                          <span className="font-medium">{key} = {formatNumber(info.value)} {info.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>
          )}

          <TabsContent value="summary" className="p-4 m-0">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold mb-3">Design Check Summary</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Limit State</TableHead>
                      <TableHead className="text-right">DCR</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.checks.map((check) => (
                      <TableRow key={check.id}>
                        <TableCell className="text-xs">{check.name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={getStatusColor(check.dcr)}>
                            {(check.dcr * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {check.passed ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Key Results</h4>
                <div className="space-y-3">
                  {result.blockShear && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Block Shear
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-medium">{formatNumber(result.blockShear.designStrength)} kN</span>
                        <span className="text-muted-foreground">Failure Path:</span>
                        <span className="font-medium">{result.blockShear.failurePath}</span>
                      </div>
                    </div>
                  )}

                  {result.prying?.isPryingSignificant && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <p className="text-xs font-semibold">Prying Action Significant</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Prying force: {formatNumber(result.prying.pryingForce)} kN
                        ({(result.prying.pryingRatio * 100).toFixed(0)}% of applied tension)
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                      Recommendations
                    </p>
                    <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                      {result.maxDCR > 1 && (
                        <li>• Increase number of bolts or use larger diameter</li>
                      )}
                      {result.maxDCR > 0.95 && result.maxDCR <= 1 && (
                        <li>• Connection is near capacity - consider adding reserve</li>
                      )}
                      {result.maxDCR <= 0.5 && (
                        <li>• Connection may be over-designed - consider optimization</li>
                      )}
                      {result.prying?.isPryingSignificant && (
                        <li>• Increase flange thickness to reduce prying effects</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ConnectionAnalysisResultsPanel;
