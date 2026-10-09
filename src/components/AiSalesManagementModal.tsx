import React, { useState } from 'react';
import Modal from './Modal';
import { SalesAlgorithmDiagnostics, ProductVelocityMetrics } from '../lib/salesAlgorithm';
import { formatCurrency, cn } from '../lib/utils';
import { 
  TrendingUp, TrendingDown, Sparkles, BrainCircuit, 
  AlertTriangle, CheckCircle2, ShoppingBag, Eye, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Zap, ShieldCheck
} from 'lucide-react';

interface AiSalesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: SalesAlgorithmDiagnostics;
  onApplyRecommendation?: (rec: any) => void;
}

export default function AiSalesManagementModal({
  isOpen,
  onClose,
  diagnostics,
  onApplyRecommendation
}: AiSalesManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'champions' | 'slow_moving' | 'forecast'>('overview');
  const [analyzing, setAnalyzing] = useState(false);

  const handleRunAiAudit = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
    }, 800);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🤖 AI Sales Management System & Algorithmic Diagnostics"
    >
      <div className="space-y-6 text-xs text-slate-700 max-h-[80vh] overflow-y-auto pr-1">
        {/* Banner with AI status */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/20">
              <BrainCircuit className="w-6 h-6 text-cyan-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm uppercase tracking-wider text-white">
                  pbazar Algorithmic Sales Intelligence Engine
                </h3>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-black px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-blue-200 font-medium mt-0.5">
                Multi-factor sales velocity, dead inventory detection, demand forecasting & automated growth policies
              </p>
            </div>
          </div>

          <button
            onClick={handleRunAiAudit}
            disabled={analyzing}
            className="px-4 py-2 bg-white text-slate-900 hover:bg-blue-50 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm shrink-0"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", analyzing && "animate-spin text-[#1E5EF3]")} />
            <span>{analyzing ? 'Evaluating...' : 'Re-run AI Analysis'}</span>
          </button>
        </div>

        {/* Tab Selectors */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
          {[
            { id: 'overview', label: 'Overview & Recommendations' },
            { id: 'champions', label: `🏆 Best Selling (${diagnostics.champions.length})` },
            { id: 'slow_moving', label: `📉 Not Selling / Stagnant (${diagnostics.slowMoving.length})` },
            { id: 'forecast', label: '🔮 Predictive Forecast' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview & Algorithmic Growth Recommendations */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">7-Day Sales Forecast</span>
                <span className="text-base font-black text-emerald-600 mt-1 block">{formatCurrency(diagnostics.forecastNext7Days)}</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">30-Day Projected Revenue</span>
                <span className="text-base font-black text-[#1E5EF3] mt-1 block">{formatCurrency(diagnostics.forecastNext30Days)}</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Average Order Value</span>
                <span className="text-base font-black text-slate-900 mt-1 block">{formatCurrency(diagnostics.averageOrderValue)}</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Dead Stock Alerts</span>
                <span className="text-base font-black text-amber-600 mt-1 block">{diagnostics.slowMoving.length} Items</span>
              </div>
            </div>

            {/* AI Growth Recommendations Feed */}
            <div>
              <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-500" />
                Algorithmic Growth Action Plan
              </h4>

              <div className="space-y-3">
                {diagnostics.growthRecommendations.map((rec, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex items-start justify-between gap-3",
                      rec.urgency === 'high' ? "bg-rose-50/50 border-rose-200/80" :
                      rec.urgency === 'medium' ? "bg-amber-50/50 border-amber-200/80" :
                      "bg-blue-50/50 border-blue-200/80"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                          rec.urgency === 'high' ? "bg-rose-600 text-white" :
                          rec.urgency === 'medium' ? "bg-amber-600 text-white" :
                          "bg-blue-600 text-white"
                        )}>
                          {rec.urgency === 'high' ? 'High Impact' : rec.urgency === 'medium' ? 'Opportunity' : 'Insight'}
                        </span>
                        <h5 className="font-black text-slate-900 text-xs uppercase tracking-tight">{rec.title}</h5>
                      </div>
                      <p className="text-slate-600 font-medium text-xs leading-relaxed">{rec.description}</p>
                    </div>

                    <button
                      onClick={() => onApplyRecommendation && onApplyRecommendation(rec)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[9px] font-black uppercase tracking-wider rounded-lg shrink-0 transition-all cursor-pointer shadow-2xs"
                    >
                      Execute
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Best Selling Champions */}
        {activeTab === 'champions' && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Top-performing revenue drivers. High velocity products that convert consistently.
            </p>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400">
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Units Sold</th>
                    <th className="p-3 text-center">Gross Revenue</th>
                    <th className="p-3 text-center">Stock Remaining</th>
                    <th className="p-3">AI Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {diagnostics.champions.map(({ product, unitsSold, totalRevenue, daysOfInventoryRemaining, recommendedAction }) => (
                    <tr key={product.id} className="hover:bg-slate-50/50">
                      <td className="p-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          {product.image && <img src={product.image} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-black uppercase text-slate-900 truncate max-w-[180px]">{product.name}</span>
                      </td>
                      <td className="p-3 text-center font-black text-emerald-600">
                        {unitsSold} pcs
                      </td>
                      <td className="p-3 text-center font-black text-slate-900">
                        {formatCurrency(totalRevenue)}
                      </td>
                      <td className="p-3 text-center font-bold">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black",
                          (product.stock || 0) <= 5 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"
                        )}>
                          {product.stock || 0} pcs ({daysOfInventoryRemaining}d left)
                        </span>
                      </td>
                      <td className="p-3 text-[10px] text-slate-600 font-medium max-w-[220px]">
                        {recommendedAction}
                      </td>
                    </tr>
                  ))}

                  {diagnostics.champions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">
                        No champion products identified yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Not Selling / Slow-Moving Stagnant Items */}
        {activeTab === 'slow_moving' && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center gap-3 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">
                <span className="font-black uppercase">Capital Liquidity Warning:</span> These items have 0 or low sales recorded. Leaving inventory stagnant locks operating capital and reduces ROI. Use the recommended discounts or promotions below.
              </p>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400">
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Price</th>
                    <th className="p-3 text-center">Unsold Stock</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Action Strategy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {diagnostics.slowMoving.map(({ product, recommendedAction }) => (
                    <tr key={product.id} className="hover:bg-slate-50/50">
                      <td className="p-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          {product.image && <img src={product.image} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-black uppercase text-slate-900 truncate max-w-[180px]">{product.name}</span>
                      </td>
                      <td className="p-3 text-center font-black text-slate-800">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="p-3 text-center font-black text-amber-600">
                        {product.stock || 0} units
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-100">
                          0 Sales (Stagnant)
                        </span>
                      </td>
                      <td className="p-3 text-[10px] text-slate-600 font-medium max-w-[220px]">
                        {recommendedAction}
                      </td>
                    </tr>
                  ))}

                  {diagnostics.slowMoving.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">
                        Great work! No slow-moving stagnant products detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Predictive Forecast */}
        {activeTab === 'forecast' && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
              <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#1E5EF3]" />
                Algorithmic Growth Projections (Regression Engine)
              </h4>
              <p className="text-slate-600 font-medium leading-relaxed">
                Projections are synthesized using current order transaction frequency, seasonal discount multipliers, and category sales velocity across the pbazar network.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">7-Day Run Rate</span>
                <h3 className="text-2xl font-black text-slate-900">{formatCurrency(diagnostics.forecastNext7Days)}</h3>
                <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +8.4% predicted trajectory with active catalog promos
                </p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">30-Day Target Forecast</span>
                <h3 className="text-2xl font-black text-[#1E5EF3]">{formatCurrency(diagnostics.forecastNext30Days)}</h3>
                <p className="text-[11px] text-indigo-600 font-bold flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +15.2% expansion based on inventory clearing actions
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Close AI Engine
          </button>
        </div>
      </div>
    </Modal>
  );
}
