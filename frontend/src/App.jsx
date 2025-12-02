import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  ComposedChart, Line, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Cell
} from 'recharts';
import {
  Activity, TrendingUp, TrendingDown, AlertTriangle, Trophy,
  History, BarChart2, FileText, Layers,
  Calendar, Gauge, Lock, Briefcase, UserCheck, CheckCircle2, ArrowRightCircle, Crosshair,
  Calculator
} from 'lucide-react';
import './App.css';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// --- THEME CONSTANTS ---
const COLORS = {
  delta: "#001489", // Navy
  gamma: "#6e2b62", // Purple
  vega: "#CC8A00",  // Gold/Amber
  theta: "#008675", // Teal
  rho: "#7b6469"    // Brown/Violet
};

// --- HELPER: CUSTOM TOOLTIP ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isProfit = data.pnl >= 0;

    let tags = [];
    // Safety check for data.action
    if (data.action?.includes("Accumulate") || data.action?.includes("Decumulate")) {
      tags.push({ text: "Accumulating", color: "var(--success)" });
    }
    if (data.action?.includes("x)")) {
      tags.push({ text: "⚠ Geared", color: "var(--danger)" });
    }
    if (data.action === "Knock Out") {
      tags.push({ text: "💀 Knock Out", color: "var(--text-main)" });
    }

    const showPnl = data.chart_pnl !== null && data.chart_pnl !== undefined;

    // Calculate formula components for display
    let formulaDisplay = null;
    if (showPnl && data.strike && data.spot && data.units) {
      const priceDiff = (data.spot - data.strike).toFixed(4);
      const returnPct = ((data.spot - data.strike) / data.spot * 100).toFixed(3);
      const amount = Math.abs(data.units).toLocaleString();
      formulaDisplay = {
        amount,
        priceDiff,
        spot: data.spot.toFixed(4),
        returnPct,
        isPositive: data.pnl >= 0
      };
    }

    return (
      <div className="custom-tooltip">
        <div className="tooltip-date">{label}</div>
        <div className="tooltip-row">
          <span style={{ color: 'var(--primary)' }}>Spot Price:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{data.spot?.toFixed(4)}</span>
        </div>
        {showPnl && (
          <>
            <div className="tooltip-row">
              <span style={{ color: isProfit ? 'var(--success)' : 'var(--danger)' }}>Daily P&L:</span>
              <span style={{ fontWeight: '700' }}>${data.pnl?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {formulaDisplay && (
              <div style={{
                marginTop: '8px',
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.03)',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                lineHeight: '1.4'
              }}>
                <div style={{ color: '#666', marginBottom: '2px' }}>Formula:</div>
                <div>{formulaDisplay.amount} × ({formulaDisplay.priceDiff} / {formulaDisplay.spot})</div>
                <div style={{ color: '#666' }}>= {formulaDisplay.amount} × {formulaDisplay.returnPct}%</div>
              </div>
            )}
          </>
        )}
        {tags.length > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {tags.map((tag, i) => (
              <span key={i} style={{
                fontSize: '0.7rem', fontWeight: '700',
                backgroundColor: 'white', border: `1px solid ${tag.color}`, color: tag.color,
                padding: '2px 6px', borderRadius: '4px'
              }}>
                {tag.text}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

// --- HELPER: GREEK CARD ---
const GreekCard = ({ title, symbol, value, description, color }) => (
  <div className="stat-card greek-card" style={{ borderTop: `4px solid ${color}` }}>
    <div className="greek-header">
      <span className="greek-title" style={{ color: color }}>{title} ({symbol})</span>
      <span className="greek-value">{value}</span>
    </div>
    <div className="greek-desc">{description}</div>
  </div>
);

// --- PAGE 1: STRUCTURE VIEW ---
const StructureView = ({ formData }) => {
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use stringified dependency to avoid object reference loops
  const dependency = JSON.stringify(formData);

  useEffect(() => {
    let isMounted = true;
    const fetchStructure = async () => {
      setLoading(true); setError(null);
      try {
        const res = await axios.post(`${API_URL}/structure`, formData);
        if (isMounted) setStructure(res.data);
      } catch (err) {
        console.error("Failed to fetch structure", err);
        if (isMounted) setError("Failed to load Option Strip. Check Backend.");
      }
      finally { if (isMounted) setLoading(false); }
    };
    fetchStructure();
    return () => { isMounted = false; };
  }, [dependency]);

  if (loading) return <div className="content-area"><div className="empty-state"><Activity className="spin" style={{ marginRight: '10px' }} /> Generating Schedule...</div></div>;
  if (error) return <div className="content-area"><div className="error-box">{error}</div></div>;

  const isAcc = formData.product_type === 'Accumulator';
  const baseCcy = formData.ticker.substring(0, 3);
  const action = isAcc ? "Buy" : "Sell";
  const targetAccumulation = structure ? structure.length * formData.notional : 0;
  const maxExposure = structure ? structure.reduce((sum, fix) => sum + fix.leg_2.notional, 0) : 0;

  return (
    <div className="view-container" style={{ flexDirection: 'column', background: 'var(--bg-app)', padding: '20px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '5px', color: '#001489' }}>Structure Analysis</h2>
          <p style={{ color: '#64748b' }}>Detailed breakdown of rights and obligations per fixing date.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px', borderLeft: '4px solid #008675' }}>
            <div style={{ background: '#e5f3f1', padding: '10px', borderRadius: '50%' }}><CheckCircle2 size={24} color="#008675" /></div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Target Accumulation</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                {targetAccumulation.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: '500' }}>{baseCcy}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#008675' }}>If Spot remains in profit zone</div>
            </div>
          </div>

          <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px', borderLeft: '4px solid #CC8A00' }}>
            <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '50%' }}><AlertTriangle size={24} color="#CC8A00" /></div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Max Exposure ({formData.leverage}x)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                {maxExposure.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: '500' }}>{baseCcy}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#CC8A00' }}>Maximum obligation if market falls</div>
            </div>
          </div>
        </div>

        <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="term-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', fontSize: '0.75rem', color: '#64748b' }}>
                  <th style={{ padding: '15px' }}>#</th>
                  <th style={{ padding: '15px' }}>Date</th>
                  <th style={{ padding: '15px', textAlign: 'center', background: '#f0fdf4', borderLeft: '1px solid #e2e8f0', color: '#166534' }}>Client Right ({action} {baseCcy})</th>
                  <th style={{ padding: '15px', textAlign: 'right', background: '#f0fdf4' }}>Strike / Barrier</th>
                  <th style={{ padding: '15px', textAlign: 'right', background: '#f0fdf4' }}>Volume</th>
                  <th style={{ padding: '15px', textAlign: 'center', background: '#fff7ed', borderLeft: '1px solid #e2e8f0', color: '#c2410c' }}>Client Obligation ({action} {baseCcy})</th>
                  <th style={{ padding: '15px', textAlign: 'right', background: '#fff7ed' }}>Strike / Barrier</th>
                  <th style={{ padding: '15px', textAlign: 'right', background: '#fff7ed' }}>Exposure</th>
                </tr>
              </thead>
              <tbody>
                {structure && structure.map((fix) => (
                  <tr key={fix.fixing_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 15px', color: '#94a3b8' }}>{fix.fixing_id}</td>
                    <td style={{ padding: '12px 15px', fontWeight: '600', color: '#334155' }}>{fix.date}</td>
                    <td style={{ padding: '12px 15px', textAlign: 'center', borderLeft: '1px solid #f1f5f9', background: '#fafffc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#166534', fontWeight: '600' }}><CheckCircle2 size={16} /> {action}</div>
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'monospace', background: '#fafffc' }}>@{fix.leg_1.strike.toFixed(4)}</td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: '600', color: '#166534', background: '#fafffc' }}>{fix.leg_1.notional.toLocaleString()}</td>
                    <td style={{ padding: '12px 15px', textAlign: 'center', borderLeft: '1px solid #f1f5f9', background: '#fffcfc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: fix.geared ? '#c2410c' : '#94a3b8', fontWeight: '600' }}>
                        {fix.geared ? <AlertTriangle size={16} /> : <ArrowRightCircle size={16} />}
                        {fix.geared ? 'Obligation (Geared)' : 'Obligation'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'monospace', background: '#fffcfc' }}>@{fix.leg_2.strike.toFixed(4)}</td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: '600', color: fix.geared ? '#c2410c' : '#64748b', background: '#fffcfc' }}>{fix.leg_2.notional.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- PAGE 2: TERMSHEET ---
const TermsheetView = ({ data, simulationResult }) => {
  const today = new Date().toISOString().split('T')[0];
  const isAcc = data.product_type === 'Accumulator';
  const tickerClean = data.ticker.replace('=X', '');
  const baseCcy = tickerClean.length === 6 ? tickerClean.substring(0, 3) : 'Base';
  const quoteCcy = tickerClean.length === 6 ? tickerClean.substring(3, 6) : 'Quote';

  const profitCond = isAcc ? `Strike < Spot < Barrier` : `Barrier < Spot < Strike`;
  const lossCond = isAcc ? `Spot < Strike` : `Spot > Strike`;
  const koCond = isAcc ? `Spot ≥ Barrier` : `Spot ≤ Barrier`;
  const zoneY1 = isAcc ? data.strike_price : data.ko_price;
  const zoneY2 = isAcc ? data.ko_price : data.strike_price;

  const productDesc = isAcc
    ? `The Accumulator is a zero-cost structured product that allows the Client to buy ${baseCcy} against ${quoteCcy} at a fixed Strike Price which is more favorable than the current market Forward Rate. In exchange for this discounted rate, the Client accepts two conditions: (1) The transaction may terminate early ("Knock-Out") if the Spot Rate rises above the Barrier, and (2) The Client is obligated to buy a higher notional amount (${data.leverage}x) if the Spot Rate falls below the Strike Price ("Gearing").`
    : `The Decumulator is a zero-cost structured product that allows the Client to sell ${baseCcy} against ${quoteCcy} at a fixed Strike Price which is more favorable than the current market Forward Rate. In exchange for this premium rate, the Client accepts two conditions: (1) The transaction may terminate early ("Knock-Out") if the Spot Rate falls below the Barrier, and (2) The Client is obligated to sell a higher notional amount (${data.leverage}x) if the Spot Rate rises above the Strike Price ("Gearing").`;

  return (
    <div className="view-container" style={{ justifyContent: 'center', background: 'var(--bg-app)', padding: '20px', overflowY: 'auto' }}>
      <div className="paper-sheet">
        <div className="sheet-header">
          <h1>Indicative Termsheet</h1>
          <p className="subtitle">Structured Foreign Exchange Product</p>
        </div>

        <div className="sheet-section">
          <h3>1. General Terms</h3>
          <table className="term-table">
            <tbody>
              <tr><td>Reference ID</td><td><strong>TS-{Math.floor(Math.random() * 1000000)}</strong></td></tr>
              <tr><td>Trade Date</td><td>{today}</td></tr>
              <tr><td>Term</td><td>{data.start_date} to {data.end_date}</td></tr>
              <tr><td>Underlying Pair</td><td>{tickerClean}</td></tr>
              <tr><td>Fixing Frequency</td><td><strong>{data.frequency}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <div className="sheet-section">
          <h3>2. Product Description</h3>
          <div className="legal-text" style={{ background: '#f9fafb', padding: '15px', borderRadius: '6px', border: '1px solid #eee', color: '#444' }}>
            {productDesc}
          </div>
        </div>

        <div className="sheet-section">
          <h3>3. Product Economics</h3>
          <table className="term-table">
            <tbody>
              <tr><td>Structure Type</td><td><strong>{data.product_type}</strong> ({isAcc ? `Buy ${baseCcy}` : `Sell ${baseCcy}`})</td></tr>
              <tr><td>Notional Amount</td><td>{data.notional.toLocaleString()} {baseCcy} per Fixing</td></tr>
              <tr><td>Leverage (Gearing)</td><td><strong>{data.leverage.toFixed(2)}x</strong></td></tr>
              <tr><td>Gearing Condition</td><td>Applies only to the first <strong>{data.gearing_limit}</strong> fixings. Subsequent fixings are 1x.</td></tr>
              <tr><td>Strike Price (K)</td><td><strong>{data.strike_price.toFixed(4)}</strong> {quoteCcy}</td></tr>
              <tr><td>Knock-Out Barrier (B)</td><td><strong>{data.ko_price.toFixed(4)}</strong> {quoteCcy}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="sheet-section">
          <h3>4. Payoff Mechanics</h3>
          <div style={{ marginBottom: '20px', marginTop: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '1px solid #ddd' }}>
              <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #333' }}>
                <tr><th style={{ padding: '10px', textAlign: 'left' }}>Scenario</th><th style={{ padding: '10px', textAlign: 'left' }}>Market Condition</th><th style={{ padding: '10px', textAlign: 'left' }}>Outcome</th></tr>
              </thead>
              <tbody>
                <tr style={{ background: '#fff1f2' }}><td style={{ padding: '10px', fontWeight: 'bold', color: '#991b1b' }}>Scenario A (KO)</td><td style={{ padding: '10px' }}>{koCond}</td><td style={{ padding: '10px' }}>Product Terminates.</td></tr>
                <tr style={{ background: '#f0fdf4' }}><td style={{ padding: '10px', fontWeight: 'bold', color: '#166534' }}>Scenario B (Profit)</td><td style={{ padding: '10px' }}>{profitCond}</td><td style={{ padding: '10px' }}>Client {isAcc ? 'Buys' : 'Sells'} <strong>{data.notional}</strong> @ Strike.</td></tr>
                <tr style={{ background: '#fff7ed' }}><td style={{ padding: '10px', fontWeight: 'bold', color: '#c2410c' }}>Scenario C (Loss)</td><td style={{ padding: '10px' }}>{lossCond}</td><td style={{ padding: '10px' }}>Client {isAcc ? 'Buys' : 'Sells'} <strong>{data.notional * data.leverage}</strong> @ Strike.</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '30px', border: '1px solid #eee', padding: '10px', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#444', fontSize: '0.9rem', textTransform: 'uppercase' }}>Performance Illustration (Backtest)</h4>
            {!simulationResult ? (
              <div style={{ height: '150px', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>Run Backtest to generate chart</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={simulationResult.chart_data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="date" hide />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={40} />
                  <ReferenceArea yAxisId="0" y1={zoneY1} y2={zoneY2} fill="#10b981" fillOpacity={0.08} />
                  <ReferenceLine y={data.strike_price} stroke="#007fa3" strokeDasharray="3 3" />
                  <ReferenceLine y={data.ko_price} stroke="#971B2F" strokeDasharray="3 3" />
                  <Bar dataKey="chart_pnl" fill="#8884d8" barSize={2}>
                    {simulationResult.chart_data.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#008675' : '#971B2F'} opacity={0.8} />)}
                  </Bar>
                  <Line type="monotone" dataKey="spot" stroke="#001489" dot={false} strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- PAGE 3: SIMULATOR ---
const SimulatorView = ({ formData, setFormData, result, setResult, supportedPairs, initLoading }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [solveTarget, setSolveTarget] = useState(null);

  const handleProductChange = (e) => {
    const newType = e.target.value;
    setFormData(prev => ({ ...prev, product_type: newType }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (solveTarget) {
        const solverPayload = { ...formData, spot_price: 1.08, volatility: 0.1, risk_free_rate: 0.05, days_to_expiry: 252, target_param: solveTarget };
        const res = await axios.post(`${API_URL}/solve`, solverPayload);
        setFormData(prev => ({ ...prev, [solveTarget]: parseFloat(res.data.solved_value.toFixed(4)) }));
        setSolveTarget(null);
      } else {
        setResult(null);
        const res = await axios.post(`${API_URL}/simulate`, formData);
        setResult(res.data);
      }
    } catch (err) { setError('Request failed. Check backend.'); }
    finally { setLoading(false); }
  };

  let performanceMetric = null;
  let gearingEndDate = null;

  if (result) {
    const activeDays = result.chart_data.filter(d => d.action !== 'Terminated' && d.action !== 'Hold');
    if (activeDays.length > 0) {
      const avgSpot = activeDays.reduce((sum, d) => sum + d.spot, 0) / activeDays.length;
      const totalPnL = result.summary.final_pnl;
      const totalUnits = result.summary.total_accumulated_value;
      let effectiveRate = 0;
      let beatPercentage = 0;
      if (Math.abs(totalUnits) > 0) {
        if (formData.product_type === 'Accumulator') {
          effectiveRate = formData.strike_price - (totalPnL / totalUnits);
          beatPercentage = ((avgSpot - effectiveRate) / avgSpot) * 100;
        } else {
          effectiveRate = formData.strike_price + (totalPnL / Math.abs(totalUnits));
          beatPercentage = ((effectiveRate - avgSpot) / avgSpot) * 100;
        }
      }
      performanceMetric = { avgSpot, effectiveRate, beatPercentage, isPositive: beatPercentage > 0 };
      const fixingDays = result.chart_data.filter(d => d.chart_pnl !== null);

      // Safety check for array bounds
      if (fixingDays.length >= formData.gearing_limit && formData.gearing_limit > 0) {
        gearingEndDate = fixingDays[formData.gearing_limit - 1].date;
      } else if (fixingDays.length > 0) {
        gearingEndDate = fixingDays[fixingDays.length - 1].date;
      }
    }
  }

  const zoneY1 = formData.product_type === 'Accumulator' ? formData.strike_price : formData.ko_price;
  const zoneY2 = formData.product_type === 'Accumulator' ? formData.ko_price : formData.strike_price;

  const TargetButton = ({ target }) => (
    <button type="button" className={`target-btn ${solveTarget === target ? 'active' : ''}`} onClick={() => setSolveTarget(solveTarget === target ? null : target)} title={`Solve for ${target}`}><Crosshair size={14} /></button>
  );

  return (
    <div className="view-container">
      <aside className="sidebar">
        <div className="sidebar-header"><h2><History size={20} /> Backtest Config</h2></div>
        <div className="sidebar-content">
          {initLoading ? <div className="loading-spinner">Initializing...</div> : (
            <form onSubmit={handleSubmit}>
              <div className="form-section-title">Structure</div>
              <div className="form-group">
                <label>Type</label>
                <select className="form-control" name="product_type" value={formData.product_type} onChange={handleProductChange}>
                  <option value="Accumulator">Accumulator (Buy)</option>
                  <option value="Decumulator">Decumulator (Sell)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Ticker</label>
                <select className="form-control" value={formData.ticker} onChange={(e) => handleInputChange('ticker', e.target.value)}>
                  {supportedPairs && supportedPairs.map(pair => <option key={pair} value={pair}>{pair.replace('=X', '')}</option>)}
                </select>
              </div>
              <div className="form-section-title">Schedule</div>
              <div className="input-row">
                <div className="form-group"><label>Start</label><input className="form-control" type="date" value={formData.start_date} onChange={(e) => handleInputChange('start_date', e.target.value)} /></div>
                <div className="form-group"><label>End</label><input className="form-control" type="date" value={formData.end_date} onChange={(e) => handleInputChange('end_date', e.target.value)} /></div>
              </div>
              <div className="form-group"><label><Calendar size={14} /> Frequency</label><select className="form-control" value={formData.frequency} onChange={(e) => handleInputChange('frequency', e.target.value)}><option value="Daily">Daily</option><option value="Weekly">Weekly (Fri)</option><option value="Monthly">Monthly (End)</option></select></div>
              <div className="form-section-title">Economics</div>
              <div className="form-group"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><label>Strike</label> <TargetButton target="strike_price" /></div><input className="form-control" type="number" step="0.0001" value={formData.strike_price} onChange={(e) => handleInputChange('strike_price', parseFloat(e.target.value))} disabled={solveTarget === 'strike_price'} /></div>
              <div className="form-group"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><label>Barrier</label> <TargetButton target="ko_price" /></div><input className="form-control" type="number" step="0.0001" value={formData.ko_price} onChange={(e) => handleInputChange('ko_price', parseFloat(e.target.value))} disabled={solveTarget === 'ko_price'} /></div>
              <div className="form-group"><label>Notional</label><input className="form-control" type="number" value={formData.notional} onChange={(e) => handleInputChange('notional', parseFloat(e.target.value))} /></div>

              <div className="gearing-panel" style={{ marginTop: '10px' }}>
                <div className="gearing-header"><Gauge size={16} /> Gearing Setup</div>
                <div className="input-row">
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><label>Leverage</label> <TargetButton target="leverage" /></div>
                    <input className="form-control" type="number" step="0.1" value={formData.leverage} onChange={(e) => handleInputChange('leverage', parseFloat(e.target.value))} disabled={solveTarget === 'leverage'} />
                  </div>
                  <div className="form-group">
                    <label># Fixings</label>
                    <input className="form-control" type="number" value={formData.gearing_limit} onChange={(e) => handleInputChange('gearing_limit', parseInt(e.target.value))} />
                  </div>
                </div>
              </div>

              <button type="submit" className="primary-btn" disabled={loading} style={{ backgroundColor: solveTarget ? 'var(--warning)' : 'var(--primary)' }}>{loading ? 'Processing...' : (solveTarget ? `Solve for ${solveTarget}` : 'Run Simulation')}</button>
            </form>
          )}
        </div>
      </aside>

      <div className="content-area">
        {!result && !loading && <div className="empty-state">Run a simulation to see historical performance.</div>}
        {result && (
          <div className="dashboard-animate">
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-header">Total P&L</div><div className={`stat-value ${result.summary.final_pnl >= 0 ? 'text-green' : 'text-red'}`}>${result.summary.final_pnl.toLocaleString()}</div></div>
              {performanceMetric && (<div className="stat-card" style={{ background: performanceMetric.isPositive ? '#f0fdf4' : '#fef2f2', borderColor: performanceMetric.isPositive ? '#bbf7d0' : '#fecaca' }}><div className="stat-header" style={{ color: performanceMetric.isPositive ? 'var(--success)' : 'var(--danger)' }}>{performanceMetric.isPositive ? <Trophy size={16} /> : <TrendingDown size={16} />} Market Perf</div><div className="stat-value" style={{ color: performanceMetric.isPositive ? 'var(--success)' : 'var(--danger)' }}>{performanceMetric.isPositive ? '+' : ''}{performanceMetric.beatPercentage.toFixed(2)}%</div></div>)}
              <div className="stat-card"><div className="stat-header">Status</div><div className="stat-value" style={{ color: result.summary.status.includes("Knock") ? 'var(--warning)' : 'var(--success)' }}>{result.summary.status}</div><div className="stat-sub">{result.summary.ko_date || "Full Term"}</div></div>
            </div>
            <div className="chart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Structure Performance</h3>
                <div style={{ fontSize: '0.8rem', display: 'flex', gap: '15px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: 'var(--success)' }}></div> Profit</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: 'var(--danger)' }}></div> Loss</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#000', opacity: 0.1 }}></div> Gearing</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={result.chart_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} minTickGap={40} />
                  <YAxis yAxisId="left" domain={['auto', 'auto']} tickFormatter={(val) => val.toFixed(4)} tick={{ fill: 'var(--primary)' }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `$${val}`} tick={{ fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  {gearingEndDate && <ReferenceArea yAxisId="left" x1={result.chart_data[0].date} x2={gearingEndDate} fill="#000" fillOpacity={0.05} label={{ value: "Fast Start", position: 'insideTopLeft', fill: '#9ca3af', fontSize: 10 }} />}
                  <ReferenceArea yAxisId="left" y1={zoneY1} y2={zoneY2} fill="var(--success)" fillOpacity={0.05} />
                  <ReferenceLine yAxisId="left" y={formData.strike_price} stroke="var(--secondary)" strokeDasharray="3 3" label={{ value: "Strike", position: 'insideLeft', fill: 'var(--secondary)', fontSize: 12 }} />
                  <ReferenceLine yAxisId="left" y={formData.ko_price} stroke="var(--danger)" strokeDasharray="3 3" label={{ value: "KO", position: 'insideLeft', fill: 'var(--danger)', fontSize: 12 }} />
                  {result.summary.ko_date && <ReferenceLine x={result.summary.ko_date} stroke="var(--danger)" strokeWidth={2} label={{ value: "💀 KNOCK OUT", position: 'insideTopRight', fill: 'var(--danger)', fontWeight: 'bold', fontSize: 13, dy: -10 }} />}
                  <Bar yAxisId="right" dataKey="chart_pnl" barSize={formData.frequency === 'Daily' ? 4 : 15}>
                    {result.chart_data.map((e, i) => (<Cell key={i} fill={e.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} opacity={0.9} />))}
                  </Bar>
                  <Line yAxisId="left" type="monotone" dataKey="spot" stroke="var(--primary)" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card"><h3>Cumulative P&L</h3><ResponsiveContainer width="100%" height={200}><ComposedChart data={result.chart_data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="date" hide /><YAxis tickFormatter={(val) => `$${val}`} tick={{ fill: 'var(--text-muted)' }} /><Tooltip formatter={(val) => `$${val.toLocaleString()}`} contentStyle={{ borderColor: 'var(--border)' }} /><ReferenceLine y={0} stroke="#000" strokeOpacity={0.1} /><Line type="monotone" dataKey="cumulative_pnl" stroke="var(--warning)" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- PAGE 4: VALUATION ---
const ValuationView = ({ sharedData }) => {
  const [marketInputs, setMarketInputs] = useState({
    spot_price: 1.0800, volatility: 0.10, risk_free_rate: 0.05, days_to_expiry: 252
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSalesView, setIsSalesView] = useState(false);

  useEffect(() => {
    if (sharedData.start_date && sharedData.end_date) {
      const start = new Date(sharedData.start_date);
      const end = new Date(sharedData.end_date);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Use functional update to avoid unnecessary overwrites
      setMarketInputs(prev => ({ ...prev, days_to_expiry: diffDays || 252 }));
    }
  }, [sharedData.start_date, sharedData.end_date]);

  const calculate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...marketInputs, ...sharedData };
    try {
      const res = await axios.post(`${API_URL}/valuation`, payload);
      setData(res.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const displayNPV = data ? (isSalesView ? Math.abs(data.npv) : 0.00) : 0;
  const npvColor = isSalesView ? 'var(--success)' : 'var(--text-muted)';
  const npvLabel = isSalesView ? "Estimated Sales Margin (Credit)" : "Structure Cost (Client Price)";
  const npvSub = isSalesView ? "Bank Day 1 Profit" : "Zero Premium Structure";

  return (
    <div className="view-container">
      <aside className="sidebar">
        <div className="sidebar-header"><h2><Calculator size={20} /> Pricing Parameters</h2></div>
        <div className="sidebar-content">
          <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <button onClick={() => setIsSalesView(false)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', background: !isSalesView ? 'white' : 'transparent', color: !isSalesView ? '#001489' : '#64748b', boxShadow: !isSalesView ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}><UserCheck size={14} style={{ marginBottom: '-2px', marginRight: '4px' }} /> Client View</button>
            <button onClick={() => setIsSalesView(true)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', background: isSalesView ? 'white' : 'transparent', color: isSalesView ? '#008675' : '#64748b', boxShadow: isSalesView ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}><Briefcase size={14} style={{ marginBottom: '-2px', marginRight: '4px' }} /> Sales View</button>
          </div>
          <form onSubmit={calculate}>
            <div className="form-section-title">Market Data</div>
            <div className="form-group"><label>Spot Price</label><input className="form-control" type="number" step="0.0001" value={marketInputs.spot_price} onChange={(e) => setMarketInputs({ ...marketInputs, spot_price: parseFloat(e.target.value) })} /></div>
            <div className="form-group"><label>Volatility</label><input className="form-control" type="number" step="0.01" value={marketInputs.volatility} onChange={(e) => setMarketInputs({ ...marketInputs, volatility: parseFloat(e.target.value) })} /></div>
            <div className="form-group"><label>Risk Free Rate</label><input className="form-control" type="number" step="0.01" value={marketInputs.risk_free_rate} onChange={(e) => setMarketInputs({ ...marketInputs, risk_free_rate: parseFloat(e.target.value) })} /></div>
            <div className="form-group"><label>Days to Expiry</label><input className="form-control" type="number" value={marketInputs.days_to_expiry} onChange={(e) => setMarketInputs({ ...marketInputs, days_to_expiry: parseInt(e.target.value) })} /></div>
            <div className="form-section-title" style={{ marginTop: '20px', color: '#001489' }}><Lock size={12} style={{ marginRight: '4px' }} /> Structure (Linked)</div>
            <div className="input-row"><div className="form-group"><label>Strike</label><input className="form-control" disabled value={sharedData.strike_price} /></div><div className="form-group"><label>Barrier</label><input className="form-control" disabled value={sharedData.ko_price} /></div></div>
            <button type="submit" className="primary-btn" disabled={loading}>{loading ? 'Pricing...' : 'Calculate Greeks'}</button>
          </form>
        </div>
      </aside>
      <div className="content-area">
        {!data && <div className="empty-state">Configure parameters and calculate.</div>}
        {data && (
          <div className="dashboard-animate">
            <div style={{ background: isSalesView ? 'var(--success-bg)' : '#f0f9ff', border: `1px solid ${isSalesView ? 'var(--success)' : '#bae6fd'}`, borderRadius: '12px', padding: '24px', marginBottom: '32px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.3s' }}>
              <div style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>{npvLabel}</div>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: npvColor, letterSpacing: '-1px' }}>{isSalesView ? '+' : ''}${displayNPV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>{npvSub}</div>
            </div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '16px', borderLeft: '4px solid var(--primary)', paddingLeft: '12px' }}>Risk & Probabilities</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <GreekCard title="Prob Knock-out" symbol="%" value={`${data.prob_ko}%`} description="Probability structure ends early." color="var(--danger)" />
              <GreekCard title="Delta" symbol="Δ" value={data.greeks.delta.toLocaleString()} description="Hedge Ratio" color={COLORS.delta} />
              <GreekCard title="Gamma" symbol="Γ" value={data.greeks.gamma.toLocaleString()} description="Convexity" color={COLORS.gamma} />
              <GreekCard title="Vega" symbol="ν" value={data.greeks.vega.toLocaleString()} description="Vol Risk" color={COLORS.vega} />
              <GreekCard title="Theta" symbol="Θ" value={data.greeks.theta.toLocaleString()} description="Time Decay" color={COLORS.theta} />
            </div>
            <div className="chart-card" style={{ marginTop: '30px' }}>
              <h3>Payoff Scenario (Spot +/- 10%)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.payoff_scenario} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="spot_pct" tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} tick={{ fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fill: 'var(--text-muted)' }} />
                  <Tooltip formatter={(v) => `$${v.toLocaleString()}`} labelFormatter={(v) => `Spot Move: ${v}%`} contentStyle={{ borderColor: 'var(--border)' }} />
                  <ReferenceLine y={0} stroke="#000" />
                  <Area type="monotone" dataKey="estimated_pnl" stroke="var(--primary)" fillOpacity={1} fill="url(#colorPnl)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- CONSTANTS ---
const SUPPORTED_PAIRS = [
  "EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", "USDCAD=X", "USDCHF=X",
  "NZDUSD=X", "EURGBP=X", "EURJPY=X", "GBPJPY=X"
];

// --- MAIN APP ---
function App() {
  const [view, setView] = useState('simulator');
  const [globalData, setGlobalData] = useState({
    ticker: 'EURUSD=X',
    start_date: '',
    end_date: '',
    product_type: 'Accumulator',
    frequency: 'Weekly',
    strike_price: 0,
    ko_price: 0,
    notional: 1000000,
    leverage: 2.0,
    gearing_limit: 52
  });
  const [simulationResult, setSimulationResult] = useState(null);
  const [initLoading, setInitLoading] = useState(false);

  // Smart Initialization
  useEffect(() => {
    let isMounted = true;
    const initializeDefaults = async () => {
      setInitLoading(true);
      try {
        // 1. Dates
        const today = new Date();
        const endDateStr = today.toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(today.getDate() - 365); // 52 weeks ago
        const startDateStr = startDate.toISOString().split('T')[0];

        // 2. Fetch Spot
        const res = await axios.get(`${API_URL}/spot`, { params: { ticker: globalData.ticker } });
        const spot = res.data.spot;

        // 3. Calculate Levels
        const isAcc = globalData.product_type === 'Accumulator';
        const strike = spot; // Strike = Spot
        const barrier = isAcc ? spot * 1.10 : spot * 0.90; // Barrier 10% away

        if (isMounted) {
          setGlobalData(prev => ({
            ...prev,
            start_date: prev.start_date || startDateStr, // Keep existing if set
            end_date: prev.end_date || endDateStr,
            strike_price: parseFloat(strike.toFixed(4)),
            ko_price: parseFloat(barrier.toFixed(4)),
            // Don't reset everything if it looks customized, but here we reset purely based on ticker change context
          }));
        }
      } catch (e) {
        console.error("Init failed", e);
      } finally {
        if (isMounted) setInitLoading(false);
      }
    };

    initializeDefaults();

    return () => { isMounted = false; };
  }, [globalData.ticker, globalData.product_type]);

  return (
    <div className="app-layout">
      <nav className="top-nav">
        <div className="brand"><Activity size={24} /><span>FX Structurer</span></div>
        <div className="nav-links">
          <button className={view === 'simulator' ? 'active' : ''} onClick={() => setView('simulator')}><History size={18} /> Backtest</button>
          <button className={view === 'valuation' ? 'active' : ''} onClick={() => setView('valuation')}><BarChart2 size={18} /> Valuation</button>
          <button className={view === 'structure' ? 'active' : ''} onClick={() => setView('structure')}><Layers size={18} /> Structure</button>
          <button className={view === 'termsheet' ? 'active' : ''} onClick={() => setView('termsheet')}><FileText size={18} /> Termsheet</button>
        </div>
      </nav>
      {view === 'simulator' && (
        <SimulatorView
          formData={globalData}
          setFormData={setGlobalData}
          result={simulationResult}
          setResult={setSimulationResult}
          supportedPairs={SUPPORTED_PAIRS}
          initLoading={initLoading}
        />
      )}
      {view === 'valuation' && <ValuationView sharedData={globalData} />}
      {view === 'structure' && <StructureView formData={globalData} />}
      {view === 'termsheet' && <TermsheetView data={globalData} simulationResult={simulationResult} />}
    </div>
  );
}

export default App;