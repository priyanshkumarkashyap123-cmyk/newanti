import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Play, Loader2, AlertTriangle, CheckCircle2, Box, Columns3, Square } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input, Select } from '../components/ui/FormInputs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useToast } from '../components/ui/ToastSystem';
import { MasterDataGrid } from '../components/MasterDataGrid';

type MemberType = 'beam' | 'column' | 'slab';

type MemberConfig = {
  title: string;
  subtitle: string;
  pageTitle: string;
  dataSchema: unknown;
  validate: (input: Record<string, unknown>) => string | null;
  defaultInput: Record<string, unknown>;
};

export interface MemberDesignTemplateProps {
  memberType: MemberType;
  config: MemberConfig;
}

const MEMBER_LABELS: Record<MemberType, { label: string; icon: React.ReactNode }> = {
  beam: { label: 'Beam', icon: <Box className="h-4 w-4" /> },
  column: { label: 'Column', icon: <Columns3 className="h-4 w-4" /> },
  slab: { label: 'Slab', icon: <Square className="h-4 w-4" /> },
};

export function MemberDesignTemplate({ memberType, config }: MemberDesignTemplateProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [input, setInput] = useState<Record<string, unknown>>(config.defaultInput);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = config.pageTitle;
  }, [config.pageTitle]);

  useEffect(() => {
    setInput(config.defaultInput);
  }, [config.defaultInput]);

  const memberLabel = MEMBER_LABELS[memberType];

  const validationError = useMemo(() => config.validate(input), [config, input]);

  const handleAnalyze = useCallback(async () => {
    const validation = config.validate(input);
    if (validation) {
      setError(validation);
      toast.error(validation);
      return;
    }

    setError('');
    setLoading(true);
    try {
      setResult({ memberType, input, status: 'ok' });
    } finally {
      setLoading(false);
    }
  }, [config, input, memberType, toast]);

  return (
    <div className="min-h-screen bg-[#081120] text-[#dae2fd]">
      <div className="border-b border-white/10 bg-[#0b1326]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-[#8ea6d9]">
                {memberLabel.icon}
                <span>{memberLabel.label} Design</span>
              </div>
              <h1 className="text-xl font-semibold text-white">{config.title}</h1>
              <p className="text-sm text-[#8ea6d9]">{config.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void handleAnalyze()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Analyze
            </Button>
            <Button variant="secondary">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="ghost">
              <FileText className="h-4 w-4" />
              Report
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-white/10 bg-[#0b1326] p-4">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-base text-white">Member Type</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {(['beam', 'column', 'slab'] as MemberType[]).map((type) => (
                <Button key={type} variant={type === memberType ? 'default' : 'outline'} size="sm">
                  {MEMBER_LABELS[type].icon}
                  {MEMBER_LABELS[type].label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-base text-white">Design Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input label="Member Label" value={String(input.label ?? '')} onChange={() => undefined} />
              <Select
                label="Schema"
                value={memberType}
                onChange={() => undefined}
                options={[
                  { value: 'beam', label: 'Beam schema' },
                  { value: 'column', label: 'Column schema' },
                  { value: 'slab', label: 'Slab schema' },
                ]}
              />
            </CardContent>
          </Card>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertTriangle className="mr-2 inline-block h-4 w-4" />
              {error}
            </div>
          ) : validationError ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <AlertTriangle className="mr-2 inline-block h-4 w-4" />
              {validationError}
            </div>
          ) : null}
        </aside>

        <main className="space-y-6">
          <Card className="border-white/10 bg-[#0b1326]">
            <CardHeader>
              <CardTitle className="text-base text-white">Engineering Schema</CardTitle>
            </CardHeader>
            <CardContent>
              <MasterDataGrid config={config.dataSchema as any} />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0b1326]">
            <CardHeader>
              <CardTitle className="text-base text-white">Results</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-[#8ea6d9]"><Loader2 className="h-4 w-4 animate-spin" /> Running checks...</div>
              ) : result ? (
                <div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Design ready</div>
              ) : (
                <div className="text-[#8ea6d9]">Run analysis to see member checks and exports.</div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
