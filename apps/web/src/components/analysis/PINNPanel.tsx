import { FC, useState } from 'react';
import { Bridge } from '../../services/bridgeService';
import { Play, TrendingUp, Brain, Loader2, CheckCircle, BarChart } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

export const PINNPanel: FC = () => {
    const { showNotification } = useUIStore();
    const [training, setTraining] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [modelId, setModelId] = useState<string | null>(null);
    const [prediction, setPrediction] = useState<any>(null);

    // Config State
    const [beamLength, setBeamLength] = useState(10);
    const [loadMag, setLoadMag] = useState(10000);
    const [epochs, setEpochs] = useState(2000);

    const startTraining = async () => {
        setTraining(true);
        setProgress(0);
        setPrediction(null);
        showNotification('info', 'AI Training Started (Background)');

        const config = {
            beam_type: 'euler_bernoulli',
            length: beamLength,
            load: {
                load_type: 'uniform',
                magnitude: -loadMag // Downward
            },
            num_epochs: epochs
        };

        const res = await Bridge.trainPINN(config);

        if (res?.job_id) {
            setJobId(res.job_id);
            pollStatus(res.job_id);
        } else {
            setTraining(false);
            showNotification('error', 'Failed to start AI training');
        }
    };

    const pollStatus = async (jid: string) => {
        const interval = setInterval(async () => {
            const status = await Bridge.getPINNStatus(jid);
            if (!status) return;

            setProgress(status.progress * 100);

            if (status.status === 'completed') {
                clearInterval(interval);
                setTraining(false);
                setModelId(status.model_id);
                showNotification('success', 'AI Model Trained Successfully!');
                runPrediction(status.model_id);
            } else if (status.status === 'failed') {
                clearInterval(interval);
                setTraining(false);
                showNotification('error', `Training Failed: ${status.error}`);
            }
        }, 500);
    };

    const runPrediction = async (mid: string) => {
        const res = await Bridge.predictPINN(mid);
        if (res?.success) {
            setPrediction(res);
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 p-4 space-y-6 text-zinc-200">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg">
                    <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white">AI Physics Engine</h2>
                    <p className="text-xs text-zinc-500">Train Neural Networks to solve beams</p>
                </div>
            </div>

            {/* Config */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Configuration</h3>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500">Length (m)</label>
                        <input
                            type="number"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                            value={beamLength}
                            onChange={(e) => setBeamLength(Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500">Load (N/m)</label>
                        <input
                            type="number"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                            value={loadMag}
                            onChange={(e) => setLoadMag(Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500">Training Epochs (Complexity)</label>
                    <input
                        type="range"
                        min="500" max="5000" step="500"
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                        value={epochs}
                        onChange={(e) => setEpochs(Number(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600">
                        <span>Fast (500)</span>
                        <span className="text-purple-400">{epochs}</span>
                        <span>Accurate (5000)</span>
                    </div>
                </div>

                <button
                    onClick={startTraining}
                    disabled={training}
                    className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all ${training
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'
                        }`}
                >
                    {training ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Toaching Physics... {progress.toFixed(0)}%
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            Start AI Training
                        </>
                    )}
                </button>
            </div>

            {/* Results */}
            {modelId && !training && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <div>
                            <div className="text-xs font-bold text-green-400">Model Trained Successfully</div>
                            <div className="text-[10px] text-zinc-500">ID: {modelId}</div>
                        </div>
                    </div>

                    {prediction && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                <BarChart className="w-3 h-3" />
                                Instant Prediction
                            </h3>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 text-center">
                                    <div className="text-zinc-500 text-[10px]">Max Deflection</div>
                                    <div className="font-mono text-purple-400 text-sm">
                                        {(prediction.max_deflection * 1000).toFixed(2)} mm
                                    </div>
                                </div>
                                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 text-center">
                                    <div className="text-zinc-500 text-[10px]">Inference Time</div>
                                    <div className="font-mono text-blue-400 text-sm">
                                        {prediction.inference_time_ms.toFixed(3)} ms
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-500 italic mt-2">
                                * This result was predicted by a 3-layer neural network, not FEM.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
