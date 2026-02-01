import React, { useMemo, useState, useCallback } from 'react';
import { 
  CostEstimator, 
  DEFAULT_RATES, 
  type CostBreakdown,
  type Material 
} from '@/modules/estimation/QuantitySurveyingEngine';
import { Calculator, FileSpreadsheet, TrendingUp, Plus, Trash2, Download, IndianRupee } from 'lucide-react';
import { useModelStore } from '@/store/model';

interface BOQItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export default function QuantitySurveyPage() {
  const model = useModelStore();
  const [boqItems, setBoqItems] = useState<BOQItem[]>([
    { id: '1', description: 'Concrete M25 - Beams', quantity: 12.5, unit: 'm³', rate: 6500, amount: 81250 },
    { id: '2', description: 'Steel Reinforcement Fe500', quantity: 2150, unit: 'kg', rate: 72, amount: 154800 },
    { id: '3', description: 'Formwork - Beams', quantity: 85, unit: 'm²', rate: 450, amount: 38250 },
    { id: '4', description: 'Concrete M30 - Columns', quantity: 8.2, unit: 'm³', rate: 7200, amount: 59040 },
  ]);
  const [newItem, setNewItem] = useState({ description: '', quantity: 0, unit: 'm³', rate: 0 });

  const estimator = useMemo(() => new CostEstimator(DEFAULT_RATES), []);
  
  const sampleEstimate = useMemo(() => {
    return estimator.estimateConcreteCost(12, 'M25', 1800, 48, 'beam');
  }, [estimator]);

  const totals = useMemo(() => {
    const subtotal = boqItems.reduce((sum, item) => sum + item.amount, 0);
    const overhead = subtotal * 0.15;
    const contingency = subtotal * 0.05;
    const gst = (subtotal + overhead + contingency) * 0.18;
    return { subtotal, overhead, contingency, gst, grandTotal: subtotal + overhead + contingency + gst };
  }, [boqItems]);

  const addItem = useCallback(() => {
    if (!newItem.description || newItem.quantity <= 0) return;
    const amount = newItem.quantity * newItem.rate;
    setBoqItems(prev => [...prev, { 
      id: String(Date.now()), 
      ...newItem, 
      amount 
    }]);
    setNewItem({ description: '', quantity: 0, unit: 'm³', rate: 0 });
  }, [newItem]);

  const removeItem = useCallback((id: string) => {
    setBoqItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const exportToCSV = useCallback(() => {
    const headers = 'Description,Quantity,Unit,Rate,Amount\n';
    const rows = boqItems.map(item => 
      `"${item.description}",${item.quantity},${item.unit},${item.rate},${item.amount}`
    ).join('\n');
    const totalsRow = `\n\nSubtotal,,,${totals.subtotal}\nOverhead (15%),,,,${totals.overhead}\nContingency (5%),,,,${totals.contingency}\nGST (18%),,,,${totals.gst}\nGrand Total,,,,${totals.grandTotal}`;
    
    const blob = new Blob([headers + rows + totalsRow], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boq_estimate.csv';
    a.click();
  }, [boqItems, totals]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quantity Surveying</p>
            <h1 className="text-2xl font-bold">Material Takeoff & Costing</h1>
            <p className="text-slate-400">Create BOQ, estimate costs, and track project expenditure.</p>
          </div>
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold">Quick Estimate</h2>
            </div>
            <p className="text-sm text-slate-400 mb-3">Sample beam (12m³ M25):</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Concrete</span><span>₹{Math.round(sampleEstimate.materials[0]?.amount || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Reinforcement</span><span>₹{Math.round(sampleEstimate.materials[1]?.amount || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Formwork</span><span>₹{Math.round(sampleEstimate.materials[2]?.amount || 0).toLocaleString()}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-700 pt-1"><span>Total</span><span>₹{Math.round(sampleEstimate.totalCost).toLocaleString()}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h2 className="font-semibold">Project Summary</h2>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>BOQ Items</span><span>{boqItems.length}</span></div>
              <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Overhead (15%)</span><span>₹{Math.round(totals.overhead).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Contingency (5%)</span><span>₹{Math.round(totals.contingency).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>GST (18%)</span><span>₹{Math.round(totals.gst).toLocaleString()}</span></div>
              <div className="flex justify-between font-bold text-lg border-t border-slate-700 pt-1 text-green-400">
                <span>Grand Total</span><span>₹{Math.round(totals.grandTotal).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold">Add BOQ Item</h2>
            </div>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="Description" 
                value={newItem.description}
                onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input 
                  type="number" 
                  placeholder="Qty" 
                  value={newItem.quantity || ''}
                  onChange={e => setNewItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                  className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                />
                <select 
                  value={newItem.unit}
                  onChange={e => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                  className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                >
                  <option value="m³">m³</option>
                  <option value="m²">m²</option>
                  <option value="m">m</option>
                  <option value="kg">kg</option>
                  <option value="nos">nos</option>
                </select>
                <input 
                  type="number" 
                  placeholder="Rate" 
                  value={newItem.rate || ''}
                  onChange={e => setNewItem(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                  className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                />
              </div>
              <button onClick={addItem} className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition-colors">
                Add Item
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-800">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold">Bill of Quantities</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3">Quantity</th>
                  <th className="text-center p-3">Unit</th>
                  <th className="text-right p-3">Rate (₹)</th>
                  <th className="text-right p-3">Amount (₹)</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {boqItems.map(item => (
                  <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="p-3">{item.description}</td>
                    <td className="text-right p-3">{item.quantity.toFixed(2)}</td>
                    <td className="text-center p-3">{item.unit}</td>
                    <td className="text-right p-3">{item.rate.toLocaleString()}</td>
                    <td className="text-right p-3 font-medium">{item.amount.toLocaleString()}</td>
                    <td className="p-3">
                      <button onClick={() => removeItem(item.id)} className="p-1 text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-800/50 font-medium">
                <tr>
                  <td colSpan={4} className="text-right p-3">Subtotal</td>
                  <td className="text-right p-3">₹{totals.subtotal.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
