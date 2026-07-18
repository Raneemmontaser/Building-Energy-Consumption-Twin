import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  Radar, PieChart, Pie, Cell 
} from 'recharts';
import { Clock, Zap, Thermometer, Users, DollarSign, Activity, TrendingUp, TrendingDown, Calendar, ArrowRight, Building, Sun, Moon, Cloud, Wind, Gauge, BarChart3, Target } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#EF4444', '#3B82F6', '#10B981', '#F59E0B'];

const SIMULATION_SCENARIOS = [
  { key: 'baseline', label: 'Baseline (Current)', color: '#a16207', icon: '📊' },
  { key: 'heatwave', label: 'Heatwave (+5°C)', color: '#ff0080', icon: '🔥' },
  { key: 'cold_snap', label: 'Cold Snap (-5°C)', color: '#f97316', icon: '❄️' },
  { key: 'high_occupancy', label: 'High Occupancy (x1.5)', color: '#fbbf24', icon: '👥' },
  { key: 'remote_work', label: 'Remote Work Mode', color: '#84cc16', icon: '🏠' },
  { key: 'energy_crisis', label: 'Energy Crisis (Price x3)', color: '#8b5cf6', icon: '⚡' },
  { key: 'green_mode', label: 'Green Mode (Eco)', color: '#14b8a6', icon: '🌱' },
  { key: 'solar_peak', label: 'Solar Peak', color: '#fbbf24', icon: '☀️' },
  { key: 'peak_demand', label: 'Peak Demand', color: '#f97316', icon: '📈' }
];

const DigitalTwin = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sensorData, setSensorData] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [activeTab, setActiveTab] = useState('live');
  const [loading, setLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [selectedSimulationScenario, setSelectedSimulationScenario] = useState(null);
  const [optimizationComparison, setOptimizationComparison] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date for API
  const formatTimestamp = (date) => {
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // --- API Calls ---

  const fetchSensorData = async (useCurrentTime = true) => {
    setLoading(true);
    try {
      const timestamp = useCurrentTime ? formatTimestamp(currentTime) : (selectedTimestamp ? formatTimestamp(new Date(selectedTimestamp)) : formatTimestamp(currentTime));
      const response = await fetch(`http://localhost:5000/api/sensor/current?timestamp=${encodeURIComponent(timestamp)}`);
      const result = await response.json();
      if (result.success) {
        const data = result.data;
        setSensorData(data);
        setSelectedTimestamp(data.timestamp);
        
        // Update historical data with timestamped data
        const timeStr = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setHistoricalData(prev => {
          const newEntry = {
            time: timeStr,
            temp: data.Indoor_Temp_C ?? 0,
            humidity: data.Indoor_Humidity_Pct ?? 0,
            occupancy: data.Total_Occupancy_Count ?? 0,
            timestamp: data.timestamp
          };
          const filtered = prev.filter(item => item.time !== timeStr);
          return [...filtered.slice(-23), newEntry].sort((a, b) => a.time.localeCompare(b.time));
        });
      }
    } catch (error) {
      console.error("Error fetching sensor data:", error);
    }
    setLoading(false);
  };

  const predictEnergy = async () => {
    if (!sensorData) return;
    setLoading(true);
    try {
      const timestamp = selectedTimestamp || formatTimestamp(currentTime);
      const response = await fetch('http://localhost:5000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...sensorData, timestamp: timestamp})
      });
      const result = await response.json();
      if (result.success) {
        setPredictions(result.predictions);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const runOptimization = async () => {
    if (!sensorData) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sensorData, 
          timestamp: selectedTimestamp || formatTimestamp(currentTime),
          simulationScenario: selectedSimulationScenario
        })
      });
      const result = await response.json();
      if (result.success) {
        setScenarios(result.scenarios);
        setSelectedScenario(result.scenarios[0]);
        if (result.comparison) {
          setOptimizationComparison(result.comparison);
        }
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const runSimulation = async (scenarioKey) => {
    setLoading(true);
    setSelectedSimulationScenario(scenarioKey);
    try {
      const response = await fetch('http://localhost:5000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenario: scenarioKey,
          timestamp: selectedTimestamp || formatTimestamp(currentTime)
        })
      });
      const result = await response.json();
      if (result.success) {
        setSimulationResult(result.data);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const compareScenarios = async (scenarioKeys) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarios: scenarioKeys,
          timestamp: selectedTimestamp || formatTimestamp(currentTime)
        })
      });
      const result = await response.json();
      if (result.success) {
        setComparisonData(result);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  // --- Helpers for Charts ---

  // --- Minimalist Black & White Theme with Neon Accents ---
  const theme = {
    bg: '#000000',
    bgSecondary: '#0a0a0a',
    card: '#111111',
    cardHover: '#1a1a1a',
    text: '#ffffff',
    textSecondary: '#888888',
    primary: '#00ffff',
    accent: '#ff00ff',
    border: '#333333',
    gradient: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)',
    warning: '#ff0080',
    success: '#00ff80',
    headerGradient: 'linear-gradient(90deg, rgba(0, 255, 255, 0.1) 0%, rgba(255, 0, 255, 0.1) 100%)',
    titleGradient: 'linear-gradient(to right, #00ffff, #ff00ff, #00ff80)',
    muted: '#444444',
    lightMuted: '#666666'
  };

  const energyBreakdown = predictions ? [
    { name: 'HVAC', value: predictions.Energy_HVAC_Wh ?? 0, color: '#ff0080' },
    { name: 'Lighting', value: predictions.Energy_Lighting_Wh ?? 0, color: '#00ff80' },
    { name: 'Plug Loads', value: predictions.Energy_Plug_Wh ?? 0, color: theme.primary },
    { name: 'Other', value: predictions.Energy_Other_Wh ?? 0, color: theme.accent }
  ] : [];

  const simulationBreakdown = simulationResult ? [
    { name: 'HVAC', value: simulationResult.outputs.hvac, color: '#ff0080' },
    { name: 'Lighting', value: simulationResult.outputs.lighting, color: '#00ff80' },
    { name: 'Plug Loads', value: simulationResult.outputs.plug, color: theme.primary },
  ] : [];

  // --- Enhanced Styles ---
  const cardStyle = {
    backgroundColor: theme.card,
    padding: '32px',
    borderRadius: '12px',
    minWidth: '200px',
    flex: 1,
    textAlign: 'center',
    boxShadow: `0 4px 12px rgba(0, 255, 255, 0.1)`,
    border: `1px solid ${theme.border}`,
    transition: 'transform 0.2s, box-shadow 0.2s'
  };

  const buttonStyle = (active = false, color = theme.primary) => ({
    marginRight: '12px',
    marginBottom: '12px',
    padding: '18px 36px',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '12px',
    backgroundColor: active ? color : theme.cardHover,
    color: theme.text,
    fontWeight: '600',
    transition: 'all 0.3s',
    opacity: active ? 1 : 0.85,
    boxShadow: active ? `0 4px 12px ${color}40` : 'none',
    fontSize: '18px'
  });

  const gradientBg = theme.gradient;

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
      background: theme.gradient,
      color: theme.text, 
      minHeight: '100vh',
      width: '100%',
      height: '100vh',
      boxSizing: 'border-box',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* Enhanced Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px', 
        borderBottom: `2px solid ${theme.border}`, 
        paddingBottom: '20px',
        background: theme.bgSecondary,
        padding: '24px 32px',
        borderRadius: '12px',
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0
      }}>
        <div>
          <h1 style={{ 
            fontSize: '56px', 
            margin: 0, 
            fontWeight: '800', 
            background: theme.titleGradient, 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-1px'
          }}>
            Building Energy Digital Twin
          </h1>
          <p style={{ margin: '12px 0 0 0', color: theme.textSecondary, fontSize: '22px' }}>
            AI-Powered Monitoring & Simulation System
          </p>
        </div>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '12px',
          backgroundColor: theme.bgSecondary, 
          padding: '24px 32px', 
          borderRadius: '16px',
          border: `2px solid ${theme.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '24px' }}>
            <Clock size={32} color={theme.primary} /> 
            <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>
              {currentTime.toLocaleTimeString()}
            </span>
          </div>
          {selectedTimestamp && (
            <div style={{ fontSize: '16px', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} />
              <span>Synced: {selectedTimestamp}</span>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Navigation Tabs */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        gap: '12px', 
        flexWrap: 'nowrap',
        background: theme.bgSecondary,
        padding: '12px',
        borderRadius: '12px',
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0,
        justifyContent: 'space-between'
      }}>
        {['live', 'predictions', 'simulation', 'optimization', 'analytics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '20px 40px',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '12px',
              background: activeTab === tab 
                ? `linear-gradient(135deg, ${theme.primary} 0%, ${theme.accent} 100%)` 
                : 'transparent',
              color: activeTab === tab ? theme.text : theme.textSecondary,
              fontSize: '20px',
              fontWeight: '700',
              textTransform: 'capitalize',
              boxShadow: activeTab === tab 
                ? `0 6px 16px ${theme.primary}40` 
                : 'none',
              transition: 'all 0.3s',
              position: 'relative',
              flex: 1,
              minWidth: '0'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* --- LIVE TAB (Enhanced) --- */}
      {activeTab === 'live' && (
        <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px',
            flexShrink: 0
          }}>
            <h2 style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              fontSize: '40px',
              fontWeight: '700'
            }}>
              <Activity size={48} color={theme.primary} /> 
              Live Sensor Status
            </h2>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <input
                type="datetime-local"
                value={selectedTimestamp ? new Date(selectedTimestamp).toISOString().slice(0, 16) : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedTimestamp(new Date(e.target.value).toLocaleString());
                  }
                }}
                style={{
                  padding: '22px 32px',
                  borderRadius: '12px',
                  border: `2px solid ${theme.border}`,
                  backgroundColor: theme.bgSecondary,
                  color: theme.text,
                  fontSize: '22px',
                  minWidth: '400px',
                  width: '100%',
                  maxWidth: '500px'
                }}
              />
              <button 
                onClick={() => fetchSensorData(false)} 
                disabled={loading} 
                style={{
                  ...buttonStyle(true, theme.success),
                  padding: '22px 40px',
                  fontSize: '20px',
                  minWidth: '180px'
                }}
              >
                {loading ? 'Syncing...' : 'Fetch Data'}
              </button>
              <button 
                onClick={() => fetchSensorData(true)} 
                disabled={loading} 
                style={{
                  ...buttonStyle(true, theme.primary),
                  padding: '22px 40px',
                  fontSize: '20px',
                  minWidth: '180px'
                }}
              >
                {loading ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>

          {sensorData ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', width: '100%', flex: 1 }}>
              {[
                { icon: Thermometer, label: 'Indoor Temp', value: `${sensorData.Indoor_Temp_C?.toFixed(1)}°C`, color: '#ff0080' },
                { icon: TrendingDown, label: 'Outdoor Temp', value: `${sensorData.OutsideWeather_Temp_C?.toFixed(1)}°C`, color: theme.accent },
                { icon: Activity, label: 'Indoor Humidity', value: `${sensorData.Indoor_Humidity_Pct?.toFixed(0)}%`, color: theme.primary },
                { icon: Cloud, label: 'Outdoor Humidity', value: `${sensorData.OutsideWeather_Humidity_Pct?.toFixed(0)}%`, color: theme.primary },
                { icon: Users, label: 'Occupancy', value: sensorData.Total_Occupancy_Count, color: theme.accent },
                { icon: Zap, label: 'HVAC Load', value: `${Math.round(sensorData.HVAC_Load_Estimate)} W`, color: '#8b5cf6' },
                { icon: DollarSign, label: 'Energy Price', value: `$${sensorData.Energy_Price_USD_kWh?.toFixed(3)}/kWh`, color: theme.success },
                { icon: Gauge, label: 'Pressure', value: `${sensorData.Pressure_mmHg?.toFixed(0)} mmHg`, color: '#06b6d4' },
                { icon: Wind, label: 'Wind Speed', value: `${sensorData.Wind_Speed_m_s?.toFixed(1)} m/s`, color: '#06b6d4' },
                { icon: Clock, label: 'Hour', value: `${sensorData.Hour || 0}:00`, color: theme.textSecondary },
                { icon: TrendingUp, label: 'Temp Deviation', value: `${sensorData.Temp_Deviation?.toFixed(1)}°C`, color: '#ff0080' },
                { icon: Sun, label: 'Solar Irradiance', value: `${sensorData.Solar_Irradiance_Estimate?.toFixed(0)} W/m²`, color: theme.accent },
                { icon: Activity, label: 'Indoor Temp Dev', value: `${sensorData.Indoor_Temp_Deviation?.toFixed(1)}°C`, color: '#ff0080' },
                { icon: Activity, label: 'Indoor Humidity Dev', value: `${sensorData.Indoor_Humidity_Deviation?.toFixed(1)}%`, color: theme.primary },
                { icon: Activity, label: 'Humidity Deviation', value: `${sensorData.Humidity_Deviation?.toFixed(1)}%`, color: theme.primary },
                { icon: BarChart3, label: 'Temp-Occupancy', value: `${sensorData.Temp_Occupancy_Interaction?.toFixed(0)}`, color: theme.accent },
                { icon: Building, label: 'Building Area', value: `${sensorData.Building_Area_m2?.toFixed(0)} m²`, color: theme.textSecondary },
                { icon: Sun, label: 'Daylight Factor', value: `${sensorData.Daylight_Hours_Factor?.toFixed(2)}`, color: theme.accent },
                { icon: BarChart3, label: 'Lighting Ratio', value: `${sensorData.Lighting_Occupancy_Ratio?.toFixed(2)}`, color: '#00ff80' },
                { icon: Clock, label: 'Plug Peak Hour', value: sensorData.Plug_Peak_Hour ? 'Yes' : 'No', color: theme.primary },
                { icon: Target, label: 'Device Usage', value: `${(sensorData.Device_Usage_Factor * 100)?.toFixed(0)}%`, color: theme.accent },
                { icon: Target, label: 'Remote Work', value: `${(sensorData.Remote_Work_Factor * 100)?.toFixed(0)}%`, color: theme.primary },
                { icon: BarChart3, label: 'Price Sensitivity', value: `${sensorData.Price_Sensitivity?.toFixed(2)}`, color: theme.success },
                { icon: Clock, label: 'Day of Week', value: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][sensorData.Day_of_Week] || 'N/A', color: theme.textSecondary },
                { icon: Moon, label: 'Is Weekend', value: sensorData.Is_Weekend ? 'Yes' : 'No', color: theme.accent },
                { icon: Sun, label: 'Is Daytime', value: sensorData.Is_Daytime ? 'Yes' : 'No', color: theme.accent },
                { icon: BarChart3, label: 'Season', value: ['Winter', 'Spring', 'Summer', 'Fall'][sensorData.Season] || 'N/A', color: theme.textSecondary },
                { icon: Building, label: 'Month', value: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(sensorData.Month || 1) - 1] || 'N/A', color: theme.textSecondary }
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={idx}
                    style={{
                      ...cardStyle,
                      borderLeft: `6px solid ${item.color}`,
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = `0 12px 24px -4px ${item.color}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0, 0, 0, 0.3)';
                    }}
                  >
                    <Icon size={48} color={item.color} style={{ marginBottom: '16px' }} />
                    <div style={{ color: theme.textSecondary, fontSize: '16px', marginBottom: '12px', fontWeight: '600' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: item.color, textShadow: `0 0 12px ${item.color}60` }}>
                      {item.value}
                    </div>
                    {item.label === 'Occupancy' && sensorData.timestamp && (
                      <div style={{ fontSize: '14px', color: theme.textSecondary, marginTop: '12px' }}>
                        {sensorData.timestamp}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              padding: '60px', 
              textAlign: 'center', 
              backgroundColor: theme.bgSecondary, 
              borderRadius: '16px', 
              color: theme.textSecondary,
              border: `2px dashed ${theme.border}`
            }}>
              <Activity size={64} color={theme.textSecondary} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p style={{ fontSize: '18px', margin: 0 }}>
                No data loaded. Click "Fetch Data" or "Sync Now" to connect to the Digital Twin.
              </p>
            </div>
          )}
        </div>
      )}

      {/* --- PREDICTIONS TAB (Enhanced) --- */}
      {activeTab === 'predictions' && (
        <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '40px', fontWeight: '700' }}>
              <Zap size={48} color={theme.primary} /> 
              AI Energy Prediction - All 4 Models
            </h2>
            <button 
              onClick={predictEnergy} 
              disabled={loading || !sensorData} 
              style={buttonStyle(true, theme.primary)}
            >
              {loading ? 'Processing...' : 'Run Prediction Model'}
            </button>
          </div>

          {!sensorData && (
              <div style={{ 
                padding: '24px', 
                backgroundColor: theme.warning + '20', 
                borderRadius: '8px', 
                color: theme.warning,
                border: `1px solid ${theme.warning}40`
              }}>
                ⚠️ Please fetch live data first to run predictions.
              </div>
          )}
          
          {predictions && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px', width: '100%' }}>
                {[
                  { label: 'HVAC Model', value: (predictions?.Energy_HVAC_Wh / 1000).toFixed(2), unit: 'kWh', color: '#ff0080', border: '#ff0080', model: 'HVAC' },
                  { label: 'Lighting Model', value: (predictions?.Energy_Lighting_Wh / 1000).toFixed(2), unit: 'kWh', color: '#00ff80', border: '#00ff80', model: 'Lighting' },
                  { label: 'Plug Model', value: (predictions?.Energy_Plug_Wh / 1000).toFixed(2), unit: 'kWh', color: theme.primary, border: theme.primary, model: 'Plug' },
                  { label: 'Total Energy (Meta Model)', value: (predictions?.Total_Energy_Wh / 1000).toFixed(2), unit: 'kWh', color: theme.accent, border: theme.accent, highlight: true, model: 'Total' }
                ].map((item, idx) => (
                  <div 
                    key={idx}
                    style={{
                      ...cardStyle,
                      borderLeft: `6px solid ${item.border}`,
                      backgroundColor: item.highlight ? theme.bgSecondary : theme.card,
                      boxShadow: item.highlight ? `0 0 24px ${item.color}40` : `0 4px 12px rgba(0, 255, 255, 0.1)`
                    }}
                  >
                    <div style={{ fontSize: '16px', color: theme.textSecondary, marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: item.highlight ? '44px' : '38px', fontWeight: 'bold', color: item.color, textShadow: `0 0 14px ${item.color}80` }}>
                      {item.value} <span style={{fontSize: item.highlight ? '22px' : '20px', opacity: 0.7}}>{item.unit}</span>
                    </div>
                    {item.model && (
                      <div style={{ fontSize: '14px', color: theme.textSecondary, marginTop: '12px', opacity: 0.6 }}>
                        {item.model} Model
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ flex: 1, minWidth: '350px', backgroundColor: theme.bgSecondary, borderRadius: '12px', padding: '28px', border: `2px solid ${theme.border}`, height: '500px' }}>
                  <h3 style={{ margin: '0 0 28px 0', fontSize: '26px', fontWeight: '600' }}>Consumption Distribution</h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                      <Pie 
                        data={energyBreakdown} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={70} 
                        outerRadius={110} 
                        paddingAngle={5} 
                        dataKey="value"
                      >
                        {energyBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme.card, 
                          border: `1px solid ${theme.border}`, 
                          color: '#fff',
                          borderRadius: '8px'
                        }} 
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 2, minWidth: '500px', backgroundColor: theme.bgSecondary, borderRadius: '12px', padding: '28px', border: `2px solid ${theme.border}`, height: '500px' }}>
                  <h3 style={{ margin: '0 0 28px 0', fontSize: '26px', fontWeight: '600' }}>Load Breakdown (Wh)</h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={energyBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                      <XAxis type="number" stroke={theme.textSecondary} tick={{ fill: theme.textSecondary }} />
                      <YAxis dataKey="name" type="category" stroke={theme.textSecondary} width={100} tick={{ fill: theme.textSecondary }} />
                      <Tooltip 
                        cursor={{fill: theme.border, opacity: 0.3}} 
                        contentStyle={{ 
                          backgroundColor: theme.bgSecondary, 
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {energyBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- SIMULATION TAB (Enhanced) --- */}
      {activeTab === 'simulation' && (
        <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%' }}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '40px', fontWeight: '700', marginBottom: '16px' }}>
              Scenario Simulation
            </h2>
            <p style={{ color: theme.textSecondary, fontSize: '20px', lineHeight: '1.6' }}>
              Select a scenario to simulate how extreme conditions or operational changes affect building energy and cost.
              All scenarios are compared against baseline predictions.
            </p>
          </div>
          
          {/* Enhanced Scenario Buttons */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gap: '20px', 
            marginBottom: '40px' 
          }}>
            {SIMULATION_SCENARIOS.map((scenario) => (
              <button
                key={scenario.key}
                onClick={() => runSimulation(scenario.key)}
                style={{
                  ...buttonStyle(simulationResult?.scenario === scenario.key, scenario.color),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  flexDirection: 'column',
                  minHeight: '120px',
                  fontSize: '18px'
                }}
              >
                <span style={{ fontSize: '36px' }}>{scenario.icon}</span>
                <span>{scenario.label}</span>
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ 
              padding: '24px', 
              textAlign: 'center', 
              backgroundColor: theme.bgSecondary, 
              borderRadius: '12px',
              color: theme.primary,
              fontSize: '18px'
            }}>
              <Activity size={32} style={{ marginBottom: '12px', animation: 'spin 1s linear infinite' }} />
              Running Simulation Model...
            </div>
          )}

          {simulationResult && (
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              {/* Simulation Inputs */}
              <div style={{ flex: 1, minWidth: '300px', backgroundColor: theme.bgSecondary, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                <h3 style={{ borderBottom: `2px solid ${theme.border}`, paddingBottom: '16px', marginBottom: '28px', fontSize: '28px', fontWeight: '600' }}>
                  Simulation Inputs
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { label: 'Weather Temp', value: `${simulationResult.inputs.temp.toFixed(1)}°C`, icon: '🌡️', color: theme.success },
                    { label: 'Occupancy', value: `${Math.round(simulationResult.inputs.occupancy)} ppl`, icon: '👥', color: theme.primary },
                    { label: 'Energy Price', value: `$${simulationResult.inputs.price.toFixed(3)}/kWh`, icon: '💰', color: theme.success }
                  ].map((item, idx) => (
                    <div 
                      key={idx}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        backgroundColor: theme.bg, 
                        padding: '18px', 
                        borderRadius: '12px',
                        border: `1px solid ${item.color}40`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>{item.icon}</span>
                        <span style={{ fontSize: '15px', fontWeight: '500' }}>{item.label}</span>
                      </div>
                      <span style={{ fontWeight: 'bold', color: item.color, fontSize: '16px' }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulation Outputs */}
              <div style={{ flex: 2, minWidth: '400px' }}>
                <h3 style={{ borderBottom: `2px solid ${theme.border}`, paddingBottom: '16px', marginBottom: '28px', fontSize: '28px', fontWeight: '600' }}>
                  Predicted Impact
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <div style={{ ...cardStyle, backgroundColor: theme.bgSecondary, border: `1px solid ${theme.border}` }}>
                    <div style={{ color: theme.textSecondary, marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                      Total Energy
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.success }}>
                      {(simulationResult.outputs.total / 1000).toFixed(2)} <span style={{fontSize: '18px', opacity: 0.8}}>kWh</span>
                    </div>
                  </div>
                  <div style={{ ...cardStyle, backgroundColor: theme.bgSecondary, border: `1px solid ${theme.border}` }}>
                    <div style={{ color: theme.textSecondary, marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                      Hourly Cost
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.warning }}>
                      ${simulationResult.outputs.cost.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ height: '350px', backgroundColor: theme.bgSecondary, borderRadius: '16px', padding: '24px', border: `1px solid ${theme.border}` }}>
                  <h4 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                    Energy Breakdown by Category
                  </h4>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={simulationBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                      <XAxis dataKey="name" stroke={theme.textSecondary} tick={{ fill: theme.textSecondary }} />
                      <YAxis stroke={theme.textSecondary} tick={{ fill: theme.textSecondary }} />
                      <Tooltip 
                        cursor={{fill: theme.border, opacity: 0.3}} 
                        contentStyle={{ 
                          backgroundColor: theme.bg, 
                          borderColor: theme.border,
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="value" name="Energy (Wh)" radius={[8, 8, 0, 0]}>
                        {simulationBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- OPTIMIZATION TAB (Enhanced) --- */}
      {activeTab === 'optimization' && (
        <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '40px', fontWeight: '700' }}>
              <TrendingDown size={48} color={theme.success} /> 
              Optimization Engine
            </h2>
            <button 
              onClick={runOptimization} 
              disabled={loading || !sensorData} 
              style={buttonStyle(true, theme.success)}
            >
              {loading ? 'Calculating...' : 'Run Optimizer'}
            </button>
          </div>
          
          {!sensorData && (
            <div style={{ 
              padding: '24px', 
              backgroundColor: '#7f1d1d', 
              borderRadius: '12px', 
              color: '#fca5a5',
              border: '1px solid #991b1b'
            }}>
              ⚠️ Please fetch live data first to run optimization analysis.
            </div>
          )}

          {scenarios.length > 0 && (
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              {/* Enhanced List of Scenarios */}
              <div style={{ flex: 1, minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto', paddingRight: '8px' }}>
                {scenarios.map((s, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedScenario(s)}
                    style={{ 
                      backgroundColor: selectedScenario === s ? theme.primary : theme.bgSecondary,
                      padding: '24px', 
                      borderRadius: '16px', 
                      cursor: 'pointer',
                      border: selectedScenario === s ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`,
                      transition: 'all 0.3s',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedScenario !== s) {
                        e.currentTarget.style.backgroundColor = theme.cardHover;
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedScenario !== s) {
                        e.currentTarget.style.backgroundColor = theme.bgSecondary;
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '28px' }}>{s.icon || '📊'}</span>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                          {s.scenario}
                        </h3>
                      </div>
                      {s.savings_pct > 0 && (
                        <span style={{ 
                          backgroundColor: theme.success + '20', 
                          color: theme.success, 
                          padding: '6px 12px', 
                          borderRadius: '8px', 
                          fontSize: '13px', 
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap'
                        }}>
                          -{s.savings_pct}%
                        </span>
                      )}
                    </div>
                    <p style={{ 
                      margin: '8px 0 12px 0', 
                      fontSize: '14px', 
                      color: theme.textSecondary, 
                      lineHeight: '1.5',
                      paddingLeft: '40px'
                    }}>
                      {s.description}
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      paddingTop: '12px',
                      borderTop: `1px solid ${theme.border}`,
                      paddingLeft: '40px'
                    }}>
                      <div style={{ fontSize: '14px', color: theme.textSecondary }}>
                        Est. Cost: <span style={{ color: '#fff', fontWeight: '600' }}>${s.monthly_cost_usd}</span>/month
                      </div>
                      {s.cost_savings_usd > 0 && (
                        <div style={{ color: theme.success, fontSize: '13px', fontWeight: '600' }}>
                          Save ${s.cost_savings_usd}/mo
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Enhanced Details Panel */}
              {selectedScenario && (
                <div style={{ 
                  flex: 2, 
                  minWidth: '400px',
                  backgroundColor: theme.bgSecondary, 
                  padding: '32px', 
                  borderRadius: '16px', 
                  border: `2px solid ${theme.border}`,
                  position: 'sticky',
                  top: '20px',
                  maxHeight: '80vh',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '48px' }}>{selectedScenario.icon || '📊'}</span>
                    <div>
                      <h2 style={{ margin: 0, color: theme.primary, fontSize: '36px', fontWeight: '700' }}>
                        {selectedScenario.scenario}
                      </h2>
                      {selectedScenario.savings_pct > 0 && (
                        <div style={{ 
                          display: 'inline-block',
                          marginTop: '8px',
                          backgroundColor: theme.success + '20', 
                          color: theme.success, 
                          padding: '4px 12px', 
                          borderRadius: '6px', 
                          fontSize: '14px', 
                          fontWeight: 'bold'
                        }}>
                          Save {selectedScenario.savings_pct}% Energy
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <p style={{ 
                    fontSize: '16px', 
                    lineHeight: '1.8', 
                    color: theme.text,
                    marginBottom: '32px',
                    padding: '20px',
                    backgroundColor: theme.bg,
                    borderRadius: '12px',
                    border: `1px solid ${theme.border}`
                  }}>
                    {selectedScenario.description}
                  </p>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '20px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ 
                      backgroundColor: theme.bg, 
                      padding: '24px', 
                      borderRadius: '12px',
                      border: `1px solid ${theme.border}`
                    }}>
                      <div style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
                        Monthly Consumption
                      </div>
                      <div style={{ fontSize: '36px', fontWeight: 'bold', color: theme.primary }}>
                        {selectedScenario.monthly_kwh} 
                        <span style={{fontSize: '20px', opacity: 0.8, marginLeft: '4px'}}>kWh</span>
                      </div>
                      {selectedScenario.savings_kwh > 0 && (
                        <div style={{ 
                          color: theme.success, 
                          fontSize: '14px', 
                          marginTop: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <TrendingDown size={16} />
                          Save {selectedScenario.savings_kwh} kWh
                        </div>
                      )}
                    </div>
                    <div style={{ 
                      backgroundColor: theme.bg, 
                      padding: '24px', 
                      borderRadius: '12px',
                      border: `1px solid ${theme.border}`
                    }}>
                      <div style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
                        Monthly Cost
                      </div>
                      <div style={{ fontSize: '48px', fontWeight: 'bold', color: theme.accent }}>
                        ${selectedScenario.monthly_cost_usd}
                      </div>
                      {selectedScenario.cost_savings_usd > 0 && (
                        <div style={{ 
                          color: theme.success, 
                          fontSize: '14px', 
                          marginTop: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <DollarSign size={16} />
                          Save ${selectedScenario.cost_savings_usd}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Additional metrics */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '16px',
                    padding: '20px',
                    backgroundColor: theme.bg,
                    borderRadius: '12px',
                    border: `1px solid ${theme.border}`
                  }}>
                    <div>
                      <div style={{ color: theme.textSecondary, fontSize: '12px', marginBottom: '4px' }}>
                        Energy Savings
                      </div>
                      <div style={{ color: theme.success, fontSize: '26px', fontWeight: 'bold' }}>
                        {selectedScenario.savings_kwh} kWh
                      </div>
                    </div>
                    <div>
                      <div style={{ color: theme.textSecondary, fontSize: '12px', marginBottom: '4px' }}>
                        Cost Savings
                      </div>
                      <div style={{ color: theme.success, fontSize: '26px', fontWeight: 'bold' }}>
                        ${selectedScenario.cost_savings_usd}
                      </div>
                    </div>
                  </div>

                  {/* Before/After Comparison Chart */}
                  {optimizationComparison && optimizationComparison.modelComparison && optimizationComparison.modelComparison.length > 0 && (
                    <div style={{ marginTop: '32px' }}>
                      <h4 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '600' }}>
                        Model Comparison: Before vs After Optimization
                      </h4>
                      <div style={{ height: '450px', backgroundColor: theme.bg, borderRadius: '12px', padding: '28px', border: `2px solid ${theme.border}` }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={optimizationComparison.modelComparison.map(item => ({
                              model: item.model,
                              before: item.before,
                              after: item.after
                            }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                            <XAxis 
                              dataKey="model" 
                              stroke={theme.textSecondary} 
                              tick={{ fill: theme.textSecondary, fontSize: 16, fontWeight: '600' }}
                              tickLine={{ stroke: theme.border }}
                            />
                            <YAxis 
                              stroke={theme.textSecondary} 
                              tick={{ fill: theme.textSecondary, fontSize: 14 }}
                              tickLine={{ stroke: theme.border }}
                              tickFormatter={(value) => {
                                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                                return value.toString();
                              }}
                            />
                            <Tooltip 
                              formatter={(value, name) => {
                                const formattedValue = value >= 1000 
                                  ? `${(value / 1000).toFixed(2)} kWh (${value.toFixed(0)} Wh)`
                                  : `${value.toFixed(2)} Wh`;
                                return [formattedValue, name];
                              }}
                              contentStyle={{ 
                                backgroundColor: theme.bgSecondary, 
                                border: `2px solid ${theme.border}`,
                                borderRadius: '8px',
                                color: theme.text,
                                fontSize: '14px'
                              }} 
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '20px', fontSize: '16px' }}
                              iconType="square"
                            />
                            <Bar 
                              dataKey="before" 
                              name="Before Optimization" 
                              fill={theme.warning} 
                              radius={[8, 8, 0, 0]}
                              maxBarSize={80}
                            />
                            <Bar 
                              dataKey="after" 
                              name="After Optimization" 
                              fill={theme.success} 
                              radius={[8, 8, 0, 0]}
                              maxBarSize={80}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- ANALYTICS TAB (Enhanced) --- */}
      {activeTab === 'analytics' && (
        <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%' }}>
          <div style={{ marginBottom: '24px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '40px', fontWeight: '700', marginBottom: '12px' }}>
              Historical Trends & Analytics
            </h2>
          {historicalData.length === 0 && (
            <div style={{
              padding: '60px', 
              textAlign: 'center', 
              backgroundColor: theme.bgSecondary, 
              borderRadius: '16px', 
              color: theme.textSecondary,
              border: `2px dashed ${theme.border}`
            }}>
              <Activity size={64} color={theme.textSecondary} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p style={{ fontSize: '18px', margin: 0 }}>
                No historical data collected yet. Keep the dashboard open and fetch data to gather live trends.
              </p>
            </div>
          )}
          
          {historicalData.length > 0 && (
            <>
              {/* First Row - Main Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px', flex: '0 0 auto' }}>
                <div style={{ height: '450px', backgroundColor: theme.bgSecondary, padding: '24px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                  <h4 style={{margin: '0 0 24px 0', fontSize: '24px', fontWeight: '600'}}>
                    Temperature & Humidity Over Time
                  </h4>
                  <ResponsiveContainer width="100%" height="85%">
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                      <XAxis dataKey="time" stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 14 }} />
                      <YAxis stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 14 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme.bg, 
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          color: theme.text
                        }} 
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '16px', fontSize: '16px' }}
                        iconType="line"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="temp" 
                        stroke={theme.warning} 
                        strokeWidth={2} 
                        dot={{ r: 3 }}
                        name="Temp (°C)"
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="humidity" 
                        stroke={theme.primary} 
                        strokeWidth={2} 
                        dot={{ r: 3 }}
                        name="Humidity (%)"
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ height: '450px', backgroundColor: theme.bgSecondary, padding: '24px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                  <h4 style={{margin: '0 0 24px 0', fontSize: '24px', fontWeight: '600'}}>
                    Environmental Radar
                  </h4>
                  <ResponsiveContainer width="100%" height="85%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={historicalData.slice(-5)}>
                      <PolarGrid stroke={theme.border} />
                      <PolarAngleAxis 
                        dataKey="time" 
                        tick={{ fill: theme.textSecondary, fontSize: 12 }} 
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        stroke={theme.textSecondary} 
                        tick={{ fill: theme.textSecondary, fontSize: 12 }}
                      />
                      <Radar 
                        name="Temp" 
                        dataKey="temp" 
                        stroke={theme.warning} 
                        fill={theme.warning} 
                        fillOpacity={0.4}
                        strokeWidth={2}
                      />
                      <Radar 
                        name="Humidity" 
                        dataKey="humidity" 
                        stroke={theme.primary} 
                        fill={theme.primary} 
                        fillOpacity={0.4}
                        strokeWidth={2}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '16px', fontSize: '15px' }}
                        iconType="circle"
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Second Row - Multiple Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px', flex: '0 0 auto' }}>
                <div style={{ height: '380px', backgroundColor: theme.bgSecondary, padding: '24px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                  <h4 style={{margin: '0 0 24px 0', fontSize: '22px', fontWeight: '600'}}>
                    Occupancy Trends
                  </h4>
                  <ResponsiveContainer width="100%" height="85%">
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                      <XAxis dataKey="time" stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 10 }} />
                      <YAxis stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme.bg, 
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          color: theme.text
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="occupancy" 
                        stroke={theme.accent} 
                        strokeWidth={2} 
                        dot={{ r: 3 }}
                        name="Occupancy"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {sensorData && predictions && (
                  <>
                    <div style={{ height: '380px', backgroundColor: theme.bgSecondary, padding: '24px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                      <h4 style={{margin: '0 0 24px 0', fontSize: '22px', fontWeight: '600'}}>
                        Energy Distribution
                      </h4>
                      <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                          <Pie 
                            data={energyBreakdown} 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={80} 
                            paddingAngle={3} 
                            dataKey="value"
                            label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {energyBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: theme.bg, 
                              border: `1px solid ${theme.border}`,
                              borderRadius: '6px',
                              color: theme.text
                            }} 
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div style={{ height: '380px', backgroundColor: theme.bgSecondary, padding: '24px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                      <h4 style={{margin: '0 0 24px 0', fontSize: '22px', fontWeight: '600'}}>
                        Cost Breakdown
                      </h4>
                      <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={[
                          { name: 'HVAC', cost: (predictions.Energy_HVAC_Wh / 1000) * (sensorData.Energy_Price_USD_kWh || 0.1), color: '#ff0080' },
                          { name: 'Lighting', cost: (predictions.Energy_Lighting_Wh / 1000) * (sensorData.Energy_Price_USD_kWh || 0.1), color: '#00ff80' },
                          { name: 'Plug', cost: (predictions.Energy_Plug_Wh / 1000) * (sensorData.Energy_Price_USD_kWh || 0.1), color: theme.primary },
                          { name: 'Other', cost: ((predictions.Energy_Other_Wh || 0) / 1000) * (sensorData.Energy_Price_USD_kWh || 0.1), color: theme.accent }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                          <XAxis dataKey="name" stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 11 }} />
                          <YAxis stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 11 }} />
                          <Tooltip 
                            formatter={(value) => `$${value.toFixed(2)}`}
                            contentStyle={{ 
                              backgroundColor: theme.bg, 
                              border: `1px solid ${theme.border}`,
                              borderRadius: '6px',
                              color: theme.text
                            }} 
                          />
                          <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                            {[
                              { name: 'HVAC', cost: 0, color: '#ff0080' },
                              { name: 'Lighting', cost: 0, color: '#00ff80' },
                              { name: 'Plug', cost: 0, color: theme.primary },
                              { name: 'Other', cost: 0, color: theme.accent }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>

              {/* Third Row - Energy Efficiency Metrics */}
              {sensorData && predictions && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px', flex: '0 0 auto' }}>
                  <div style={{ backgroundColor: theme.bgSecondary, padding: '28px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                    <div style={{ fontSize: '16px', color: theme.textSecondary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                      Energy Intensity
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.primary, textShadow: `0 0 12px ${theme.primary}60` }}>
                      {((predictions.Total_Energy_Wh / 1000) / (sensorData.Building_Area_m2 || 1000)).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '14px', color: theme.textSecondary, marginTop: '8px' }}>
                      kWh/m²
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: theme.bgSecondary, padding: '28px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                    <div style={{ fontSize: '16px', color: theme.textSecondary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                      Hourly Cost
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.success, textShadow: `0 0 12px ${theme.success}60` }}>
                      ${((predictions.Total_Energy_Wh / 1000) * (sensorData.Energy_Price_USD_kWh || 0.1)).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '14px', color: theme.textSecondary, marginTop: '8px' }}>
                      USD/hour
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: theme.bgSecondary, padding: '28px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                    <div style={{ fontSize: '16px', color: theme.textSecondary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                      Peak Load
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.accent, textShadow: `0 0 12px ${theme.accent}60` }}>
                      {(predictions.Total_Energy_Wh / 1000).toFixed(1)}
                    </div>
                    <div style={{ fontSize: '14px', color: theme.textSecondary, marginTop: '8px' }}>
                      kW
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: theme.bgSecondary, padding: '28px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                    <div style={{ fontSize: '16px', color: theme.textSecondary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                      Efficiency Ratio
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.primary, textShadow: `0 0 12px ${theme.primary}60` }}>
                      {((predictions.Energy_HVAC_Wh + predictions.Energy_Lighting_Wh) / predictions.Total_Energy_Wh * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '14px', color: theme.textSecondary, marginTop: '8px' }}>
                      HVAC+Lighting
                    </div>
                  </div>
                </div>
              )}

              {/* Fourth Row - Time Series Analysis */}
              {historicalData.length > 5 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: '0 0 auto' }}>
                  <div style={{ height: '380px', backgroundColor: theme.bgSecondary, padding: '24px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                    <h4 style={{margin: '0 0 24px 0', fontSize: '22px', fontWeight: '600'}}>
                      Energy Consumption Over Time
                    </h4>
                    <ResponsiveContainer width="100%" height="85%">
                      <LineChart data={historicalData.map(d => ({ ...d, energy: (d.temp * 10) + (d.humidity * 5) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                        <XAxis dataKey="time" stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 10 }} />
                        <YAxis stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: theme.bg, 
                            border: `1px solid ${theme.border}`,
                            borderRadius: '6px',
                            color: theme.text
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="energy" 
                          stroke={theme.primary} 
                          strokeWidth={2} 
                          dot={{ r: 3 }}
                          name="Energy Index"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div style={{ height: '380px', backgroundColor: theme.bgSecondary, padding: '24px', borderRadius: '12px', border: `2px solid ${theme.border}` }}>
                    <h4 style={{margin: '0 0 24px 0', fontSize: '22px', fontWeight: '600'}}>
                      Occupancy vs Temperature
                    </h4>
                    <ResponsiveContainer width="100%" height="85%">
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                        <XAxis dataKey="time" stroke={theme.textSecondary} tick={{ fill: theme.textSecondary, fontSize: 10 }} />
                        <YAxis yAxisId="left" stroke={theme.warning} tick={{ fill: theme.warning, fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" stroke={theme.accent} tick={{ fill: theme.accent, fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: theme.bg, 
                            border: `1px solid ${theme.border}`,
                            borderRadius: '6px',
                            color: theme.text
                          }} 
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="temp" 
                          stroke={theme.warning} 
                          strokeWidth={2} 
                          dot={{ r: 3 }}
                          name="Temp (°C)"
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="occupancy" 
                          stroke={theme.accent} 
                          strokeWidth={2} 
                          dot={{ r: 3 }}
                          name="Occupancy"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      {/* Enhanced Animation Styles */}
      <style>{`
        .fade-in { 
          animation: fadeIn 0.5s ease-in-out; 
        }
        @keyframes fadeIn { 
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          } 
          to { 
            opacity: 1; 
            transform: translateY(0); 
          } 
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: ${theme.bg};
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
          background: ${theme.border};
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${theme.primary};
        }
      `}</style>

    </div>
  );
}

export default DigitalTwin;
