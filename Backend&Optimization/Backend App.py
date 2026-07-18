from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import tensorflow as tf
from tensorflow.keras.models import load_model  # type: ignore
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

BASE_PATH = r"C:\Users\Laptop World"
DATASET_PATH = r"C:\Users\Laptop World\Desktop\ST\DataSet\Building_Energy_Twin_Sequential_3Years.csv"

model_hvac = joblib.load(os.path.join(BASE_PATH, "model_hvac_xgb_3y.pkl"))
scaler_hvac = joblib.load(os.path.join(BASE_PATH, "scaler_hvac_3y.pkl"))

model_lighting = joblib.load(os.path.join(BASE_PATH, "model_lighting_xgb_3y.pkl"))
scaler_lighting = joblib.load(os.path.join(BASE_PATH, "scaler_lighting_3y.pkl"))

model_plug = joblib.load(os.path.join(BASE_PATH, "model_plug_xgb_3y_improved.pkl"))
scaler_plug = joblib.load(os.path.join(BASE_PATH, "scaler_plug_3y_improved.pkl"))

meta_model = tf.keras.models.load_model(os.path.join(BASE_PATH, "meta_model_nn_3y_low_noise.keras"))
meta_scaler = joblib.load(os.path.join(BASE_PATH, "meta_scaler_3y_low_noise.pkl"))

df = pd.read_csv(DATASET_PATH, parse_dates=['Timestamp'], index_col='Timestamp')

hvac_features = [
    'HVAC_Load_Estimate', 'Temp_Occupancy_Interaction', 'Indoor_Temp_Deviation',
    'Temp_Deviation', 'Total_Occupancy_Count', 'Indoor_Temp_C',
    'OutsideWeather_Temp_C', 'Hour', 'Is_Daytime', 'OutsideWeather_Humidity_Pct',
    'Indoor_Humidity_Pct', 'Pressure_mmHg', 'Indoor_Humidity_Deviation',
    'Season', 'Humidity_Deviation', 'Is_Weekend'
]

lighting_features = [
    'Hour', 'Is_Daytime', 'Total_Occupancy_Count', 'Day_of_Week', 'Is_Weekend',
    'Season', 'OutsideWeather_Temp_C', 'Temp_Deviation', 'Indoor_Temp_C',
    'Building_Area_m2', 'Daylight_Hours_Factor', 'Lighting_Occupancy_Ratio',
    'Solar_Irradiance_Estimate'
]

plug_features = [
    'Total_Occupancy_Count', 'Hour', 'Is_Daytime', 'Day_of_Week', 'Is_Weekend',
    'Season', 'Building_Area_m2', 'Energy_Price_USD_kWh', 'OutsideWeather_Temp_C',
    'Indoor_Temp_C', 'Plug_Peak_Hour', 'Device_Usage_Factor', 'Remote_Work_Factor',
    'Price_Sensitivity', 'Temp_Deviation', 'Indoor_Temp_Deviation', 'Solar_Irradiance_Estimate'
]

# Enhanced Simulation Scenarios
SCENARIO_CONFIG = {
    'baseline': {},
    'heatwave': {'OutsideWeather_Temp_C': 5.0, 'mod_type': 'add'},
    'cold_snap': {'OutsideWeather_Temp_C': -5.0, 'mod_type': 'add'},
    'high_occupancy': {'Total_Occupancy_Count': 1.5, 'mod_type': 'multiply'},
    'remote_work': {'Total_Occupancy_Count': 0.3, 'Remote_Work_Factor': 1.0, 'mod_type': 'multiply_set'},
    'energy_crisis': {'Energy_Price_USD_kWh': 3.0, 'mod_type': 'multiply'},
    'green_mode': {'Total_Occupancy_Count': 1.0, 'mod_type': 'set'},
    'solar_peak': {'Solar_Irradiance_Estimate': 1.8, 'mod_type': 'multiply'},
    'peak_demand': {'Energy_Price_USD_kWh': 5.0, 'mod_type': 'multiply'}
}

def predict_total(df_input):
    X_hvac = df_input[hvac_features]
    X_hvac_scaled = scaler_hvac.transform(X_hvac)
    pred_hvac = model_hvac.predict(X_hvac_scaled)

    X_lighting = df_input[lighting_features]
    X_lighting_scaled = scaler_lighting.transform(X_lighting)
    pred_lighting = model_lighting.predict(X_lighting_scaled)

    X_plug = df_input[plug_features]
    X_plug_scaled = scaler_plug.transform(X_plug)
    pred_plug = model_plug.predict(X_plug_scaled)

    meta_input = np.column_stack([pred_hvac, pred_lighting, pred_plug, df_input['Energy_Other_Wh'].values])
    meta_input_scaled = meta_scaler.transform(meta_input)
    pred_total = meta_model.predict(meta_input_scaled, verbose=0).flatten()
    
    return pred_hvac, pred_lighting, pred_plug, pred_total

def get_closest_timestamp(target_time):
    target_dt = pd.to_datetime(target_time)
    time_diff = abs(df.index - target_dt)
    closest_idx = time_diff.argmin()
    return df.index[closest_idx]

def recalculate_derived_features(df_scenario):
    """Recalculate derived features after modifications"""
    df_scenario = df_scenario.copy()
    df_scenario['Indoor_Temp_Deviation'] = np.abs(df_scenario['Indoor_Temp_C'] - 22)
    df_scenario['Temp_Deviation'] = np.abs(df_scenario['OutsideWeather_Temp_C'] - df_scenario['Indoor_Temp_C'])
    df_scenario['Temp_Occupancy_Interaction'] = df_scenario['Temp_Deviation'] * df_scenario['Total_Occupancy_Count']
    return df_scenario

@app.route('/api/sensor/current', methods=['GET'])
def get_current_sensor_data():
    try:
        timestamp_str = request.args.get('timestamp', datetime.now().strftime('%m/%d/%Y %I:%M:%S %p'))
        closest_ts = get_closest_timestamp(timestamp_str)
        sensor_data = df.loc[closest_ts].to_dict()
        sensor_data['timestamp'] = closest_ts.strftime('%m/%d/%Y %I:%M:%S %p')
        
        return jsonify({
            'success': True,
            'data': sensor_data,
            'requested_time': timestamp_str,
            'actual_time': sensor_data['timestamp']
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def predict_energy():
    """Predict energy consumption using all 4 models"""
    try:
        data = request.json
        timestamp_str = data.get('timestamp', None)
        
        # Get data point based on timestamp or latest
        if timestamp_str:
            closest_ts = get_closest_timestamp(timestamp_str)
            current_data = df.loc[closest_ts:closest_ts].iloc[0].copy()
        else:
            current_data = df.iloc[-1].copy()
        
        # Prepare input
        input_df = pd.DataFrame([current_data])
        input_df = recalculate_derived_features(input_df)
        
        # Get predictions from all 4 models
        pred_hvac, pred_lighting, pred_plug, pred_total = predict_total(input_df)
        
        predictions = {
            'Energy_HVAC_Wh': float(pred_hvac[0]),
            'Energy_Lighting_Wh': float(pred_lighting[0]),
            'Energy_Plug_Wh': float(pred_plug[0]),
            'Energy_Other_Wh': float(current_data.get('Energy_Other_Wh', 0)),
            'Total_Energy_Wh': float(pred_total[0])
        }
        
        return jsonify({'success': True, 'predictions': predictions})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/simulate', methods=['POST'])
def simulate_scenario():
    try:
        req = request.json
        scenario_key = req.get('scenario', 'baseline')
        timestamp_str = req.get('timestamp', None)
        
        # Get data point based on timestamp or latest
        if timestamp_str:
            closest_ts = get_closest_timestamp(timestamp_str)
            current_data = df.loc[closest_ts:closest_ts].iloc[0].copy()
        else:
            current_data = df.iloc[-1].copy()
        
        # Apply Scenario Modifications
        config = SCENARIO_CONFIG.get(scenario_key, {})
        simulated_data = current_data.copy()
        
        if scenario_key != 'baseline':
            for feature, val in config.items():
                if feature == 'mod_type': continue
                
                if feature in simulated_data:
                    if config.get('mod_type') == 'add':
                        simulated_data[feature] += val
                    elif config.get('mod_type') == 'multiply':
                        simulated_data[feature] *= val
                    elif config.get('mod_type') == 'multiply_set':
                        if feature == 'Total_Occupancy_Count':
                            simulated_data[feature] *= val
                        else:
                            simulated_data[feature] = val
                    else:
                        simulated_data[feature] = val

        # Re-calculate dependent physical features
        simulated_data['Temp_Deviation'] = abs(simulated_data['OutsideWeather_Temp_C'] - simulated_data.get('Indoor_Temp_C', 22))
        simulated_data['Indoor_Temp_Deviation'] = abs(simulated_data['Indoor_Temp_C'] - 22)
        
        # Prepare for Prediction
        input_df = pd.DataFrame([simulated_data])
        input_df = recalculate_derived_features(input_df)
        
        # Get Predictions
        pred_hvac, pred_lighting, pred_plug, pred_total = predict_total(input_df)
        
        # Calculate Costs
        total_energy_wh = float(pred_total[0])
        total_cost = (total_energy_wh / 1000) * simulated_data['Energy_Price_USD_kWh']
        
        response = {
            'scenario': scenario_key,
            'inputs': {
                'temp': float(simulated_data['OutsideWeather_Temp_C']),
                'occupancy': float(simulated_data['Total_Occupancy_Count']),
                'price': float(simulated_data['Energy_Price_USD_kWh'])
            },
            'outputs': {
                'hvac': float(pred_hvac[0]),
                'lighting': float(pred_lighting[0]),
                'plug': float(pred_plug[0]),
                'total': total_energy_wh,
                'cost': total_cost
            }
        }
        
        return jsonify({'success': True, 'data': response})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/optimize', methods=['POST'])
def optimize_scenarios():
    try:
        data = request.json
        simulation_scenario = data.get('simulationScenario')
        timestamp = data.get('timestamp')
        
        # Get baseline data - either from timestamp or use current
        if timestamp:
            try:
                target_dt = pd.to_datetime(timestamp)
                time_diff = abs(df.index - target_dt)
                closest_idx = time_diff.argmin()
                baseline_row = df.iloc[[closest_idx]].copy()
            except:
                baseline_row = df.iloc[[0]].copy()
        else:
            baseline_row = df.iloc[[0]].copy()
        
        baseline_df = baseline_row.copy()
        
        # Apply simulation scenario if selected
        if simulation_scenario and simulation_scenario in SCENARIO_CONFIG:
            config = SCENARIO_CONFIG[simulation_scenario]
            for key, val in config.items():
                if key != 'mod_type' and key in baseline_df.columns:
                    if config['mod_type'] == 'add':
                        baseline_df[key] = baseline_df[key] + val
                    elif config['mod_type'] == 'multiply':
                        baseline_df[key] = baseline_df[key] * val
                    elif config['mod_type'] == 'multiply_set':
                        if key == 'Total_Occupancy_Count':
                            baseline_df[key] = baseline_df[key] * val
                        else:
                            baseline_df[key] = val
        
        # Get baseline predictions
        baseline_df = recalculate_derived_features(baseline_df)
        pred_hvac_baseline, pred_lighting_baseline, pred_plug_baseline, pred_total_baseline = predict_total(baseline_df)
        
        hours_per_year = 8760
        hours_per_month = hours_per_year / 12
        
        baseline_monthly_kwh = float(pred_total_baseline[0]) * hours_per_month / 1000
        baseline_monthly_cost = (float(pred_total_baseline[0]) / 1000 * float(baseline_df['Energy_Price_USD_kWh'].iloc[0])) * hours_per_month
        
        results = []
        comparison_data = {
            'baseline': {
                'hvac': float(pred_hvac_baseline[0]),
                'lighting': float(pred_lighting_baseline[0]),
                'plug': float(pred_plug_baseline[0]),
                'total': float(pred_total_baseline[0])
            },
            'modelComparison': []
        }
        
        # Comprehensive Optimization Scenarios
        scenarios_logic = [
            {
                'name': 'Baseline',
                'desc': 'No optimizations applied - current operational baseline.',
                'icon': '📊',
                'apply': lambda d: d
            },
            {
                'name': 'HVAC Setpoint Optimization',
                'desc': 'Wider temperature bands: +2°C in summer, -2°C in winter. Reduces HVAC cycling.',
                'icon': '🌡️',
                'apply': lambda d: d.assign(
                    Indoor_Temp_C=np.where(d['Season'] == 3, d['Indoor_Temp_C'] + 2, d['Indoor_Temp_C'] - 2).clip(18, 28)
                )
            },
            {
                'name': 'Occupancy-Based HVAC',
                'desc': 'HVAC reduced by 60% when occupancy < 80 people. Smart zoning.',
                'icon': '👥',
                'apply': lambda d: d.assign(
                    HVAC_Load_Estimate=np.where(d['Total_Occupancy_Count'] < 80, d['HVAC_Load_Estimate'] * 0.4, d['HVAC_Load_Estimate'])
                )
            },
            {
                'name': 'LED Lighting Upgrade',
                'desc': '30% reduction in lighting energy through LED conversion.',
                'icon': '💡',
                'apply': lambda d: d
            },
            {
                'name': 'Daylight Harvesting',
                'desc': '40% lighting reduction during daylight hours via smart controls.',
                'icon': '☀️',
                'apply': lambda d: d.assign(
                    Lighting_Occupancy_Ratio=np.where(d['Is_Daytime'] == 1, d['Lighting_Occupancy_Ratio'] * 0.6, d['Lighting_Occupancy_Ratio'])
                )
            },
            {
                'name': 'Remote Work Integration',
                'desc': '50% occupancy reduction with 40% plug load reduction.',
                'icon': '🏠',
                'apply': lambda d: d.assign(
                    Total_Occupancy_Count=d['Total_Occupancy_Count'] * 0.5,
                    Device_Usage_Factor=d['Device_Usage_Factor'] * 0.6
                )
            },
            {
                'name': 'Peak Demand Shaving',
                'desc': '30% load reduction during peak hours (8am-6pm weekdays).',
                'icon': '⚡',
                'apply': lambda d: d.assign(
                    HVAC_Load_Estimate=np.where((d['Hour'] >= 8) & (d['Hour'] <= 18) & (d['Is_Weekend'] == 0), 
                                               d['HVAC_Load_Estimate'] * 0.7, d['HVAC_Load_Estimate']),
                    Energy_Plug_Wh=np.where((d['Hour'] >= 8) & (d['Hour'] <= 18) & (d['Is_Weekend'] == 0),
                                           d['Energy_Plug_Wh'] * 0.7, d['Energy_Plug_Wh'])
                )
            },
            {
                'name': 'Night Mode Optimization',
                'desc': '70% HVAC reduction and 50% plug reduction during off-hours.',
                'icon': '🌙',
                'apply': lambda d: d.assign(
                    HVAC_Load_Estimate=np.where((d['Hour'] < 7) | (d['Hour'] > 19) | (d['Is_Weekend'] == 1),
                                               d['HVAC_Load_Estimate'] * 0.3, d['HVAC_Load_Estimate']),
                    Energy_Plug_Wh=np.where((d['Hour'] < 7) | (d['Hour'] > 19) | (d['Is_Weekend'] == 1),
                                           d['Energy_Plug_Wh'] * 0.5, d['Energy_Plug_Wh'])
                )
            },
            {
                'name': 'Natural Ventilation Boost',
                'desc': '50% HVAC reduction when outdoor temp is 18-26°C (comfort zone).',
                'icon': '🌬️',
                'apply': lambda d: d.assign(
                    HVAC_Load_Estimate=np.where((d['OutsideWeather_Temp_C'] >= 18) & (d['OutsideWeather_Temp_C'] <= 26),
                                               d['HVAC_Load_Estimate'] * 0.5, d['HVAC_Load_Estimate'])
                )
            },
            {
                'name': 'Smart Plug Management',
                'desc': '40% reduction in plug loads through smart scheduling and power management.',
                'icon': '🔌',
                'apply': lambda d: d.assign(
                    Device_Usage_Factor=d['Device_Usage_Factor'] * 0.6,
                    Energy_Plug_Wh=d['Energy_Plug_Wh'] * 0.6
                )
            },
            {
                'name': 'Aggressive HVAC Optimization',
                'desc': 'Wider temp bands (±3°C) + 70% reduction when occupancy < 100.',
                'icon': '❄️',
                'apply': lambda d: d.assign(
                    Indoor_Temp_C=np.where(d['Season'] == 3, d['Indoor_Temp_C'] + 3, d['Indoor_Temp_C'] - 3).clip(18, 30),
                    HVAC_Load_Estimate=np.where(d['Total_Occupancy_Count'] < 100, d['HVAC_Load_Estimate'] * 0.3, d['HVAC_Load_Estimate'])
                )
            },
            {
                'name': 'Price-Responsive Load',
                'desc': '30% load reduction when energy price > $0.15/kWh.',
                'icon': '💰',
                'apply': lambda d: d.assign(
                    HVAC_Load_Estimate=np.where(d['Energy_Price_USD_kWh'] > 0.15, d['HVAC_Load_Estimate'] * 0.7, d['HVAC_Load_Estimate']),
                    Energy_Plug_Wh=np.where(d['Energy_Price_USD_kWh'] > 0.15, d['Energy_Plug_Wh'] * 0.7, d['Energy_Plug_Wh'])
                )
            },
            {
                'name': 'Weekend Optimization',
                'desc': '60% HVAC and 50% plug reduction on weekends.',
                'icon': '📅',
                'apply': lambda d: d.assign(
                    HVAC_Load_Estimate=np.where(d['Is_Weekend'] == 1, d['HVAC_Load_Estimate'] * 0.4, d['HVAC_Load_Estimate']),
                    Energy_Plug_Wh=np.where(d['Is_Weekend'] == 1, d['Energy_Plug_Wh'] * 0.5, d['Energy_Plug_Wh'])
                )
            },
            {
                'name': 'Combined Moderate',
                'desc': 'Setpoint optimization + occupancy-based HVAC + 25% plug reduction off-hours.',
                'icon': '🔄',
                'apply': lambda d: d.assign(
                    Indoor_Temp_C=np.where(d['Season'] == 3, d['Indoor_Temp_C'] + 1.5, d['Indoor_Temp_C'] - 1.5).clip(18, 28),
                    HVAC_Load_Estimate=np.where(d['Total_Occupancy_Count'] < 80, d['HVAC_Load_Estimate'] * 0.5, d['HVAC_Load_Estimate']),
                    Energy_Plug_Wh=np.where((d['Hour'] < 8) | (d['Hour'] > 17) | (d['Is_Weekend'] == 1), 
                                           d['Energy_Plug_Wh'] * 0.75, d['Energy_Plug_Wh'])
                )
            },
            {
                'name': 'Combined Aggressive',
                'desc': 'All optimizations: ±3°C temp, natural ventilation, 70% peak shaving, 50% off-hours.',
                'icon': '🚀',
                'apply': lambda d: d.assign(
                    Indoor_Temp_C=np.where(d['Season'] == 3, d['Indoor_Temp_C'] + 3, d['Indoor_Temp_C'] - 3).clip(18, 30),
                    HVAC_Load_Estimate=np.where(
                        (d['Total_Occupancy_Count'] < 100) & ((d['OutsideWeather_Temp_C'] >= 18) & (d['OutsideWeather_Temp_C'] <= 26)),
                        d['HVAC_Load_Estimate'] * 0.3 * 0.4,
                        np.where(d['Total_Occupancy_Count'] < 100, d['HVAC_Load_Estimate'] * 0.3,
                        np.where((d['OutsideWeather_Temp_C'] >= 18) & (d['OutsideWeather_Temp_C'] <= 26),
                                d['HVAC_Load_Estimate'] * 0.4, d['HVAC_Load_Estimate']))
                    ),
                    Energy_Plug_Wh=np.where(
                        ((d['Hour'] < 8) | (d['Hour'] > 17) | (d['Is_Weekend'] == 1)) & (d['Energy_Price_USD_kWh'] > 0.15),
                        d['Energy_Plug_Wh'] * 0.5 * 0.7,
                        np.where((d['Hour'] < 8) | (d['Hour'] > 17) | (d['Is_Weekend'] == 1),
                                d['Energy_Plug_Wh'] * 0.5,
                        np.where(d['Energy_Price_USD_kWh'] > 0.15, d['Energy_Plug_Wh'] * 0.7, d['Energy_Plug_Wh']))
                    )
                )
            },
            {
                'name': 'Ultimate Energy Saver',
                'desc': 'Maximum savings: all optimizations combined with 80% HVAC reduction low occupancy.',
                'icon': '♻️',
                'apply': lambda d: d.assign(
                    Indoor_Temp_C=np.where(d['Season'] == 3, d['Indoor_Temp_C'] + 3, d['Indoor_Temp_C'] - 3).clip(18, 30),
                    HVAC_Load_Estimate=np.where(
                        (d['Total_Occupancy_Count'] < 100) & ((d['OutsideWeather_Temp_C'] >= 18) & (d['OutsideWeather_Temp_C'] <= 27)),
                        d['HVAC_Load_Estimate'] * 0.2 * 0.2,
                        np.where(d['Total_Occupancy_Count'] < 100, d['HVAC_Load_Estimate'] * 0.2,
                        np.where((d['OutsideWeather_Temp_C'] >= 18) & (d['OutsideWeather_Temp_C'] <= 27),
                                d['HVAC_Load_Estimate'] * 0.2, d['HVAC_Load_Estimate']))
                    ),
                    Energy_Plug_Wh=np.where(
                        ((d['Hour'] < 7) | (d['Hour'] > 18) | (d['Is_Weekend'] == 1)) & (d['Energy_Price_USD_kWh'] > 0.14),
                        d['Energy_Plug_Wh'] * 0.3 * 0.6,
                        np.where((d['Hour'] < 7) | (d['Hour'] > 18) | (d['Is_Weekend'] == 1),
                                d['Energy_Plug_Wh'] * 0.3,
                        np.where(d['Energy_Price_USD_kWh'] > 0.14, d['Energy_Plug_Wh'] * 0.6, d['Energy_Plug_Wh']))
                    ),
                    Device_Usage_Factor=d['Device_Usage_Factor'] * 0.5,
                    Lighting_Occupancy_Ratio=np.where(d['Is_Daytime'] == 1, d['Lighting_Occupancy_Ratio'] * 0.5, d['Lighting_Occupancy_Ratio'])
                )
            },
            {
                'name': 'Seasonal Adaptation',
                'desc': 'Winter: -2°C setpoint, Summer: +2°C setpoint, Spring/Fall: natural ventilation priority.',
                'icon': '🍂',
                'apply': lambda d: d.assign(
                    Indoor_Temp_C=np.where(d['Season'] == 0, d['Indoor_Temp_C'] - 2,  # Winter
                                          np.where(d['Season'] == 1, d['Indoor_Temp_C'] + 1,  # Spring
                                                  np.where(d['Season'] == 2, d['Indoor_Temp_C'] + 2,  # Summer
                                                          d['Indoor_Temp_C'] - 1))).clip(18, 28),  # Fall
                    HVAC_Load_Estimate=np.where((d['Season'].isin([1, 3])) & (d['OutsideWeather_Temp_C'] >= 18) & (d['OutsideWeather_Temp_C'] <= 26),
                                               d['HVAC_Load_Estimate'] * 0.4, d['HVAC_Load_Estimate'])
                )
            },
            {
                'name': 'Zoned Building Control',
                'desc': 'Different zones optimized independently based on occupancy patterns.',
                'icon': '🏢',
                'apply': lambda d: d.assign(
                    HVAC_Load_Estimate=np.where(d['Total_Occupancy_Count'] < 50, d['HVAC_Load_Estimate'] * 0.3,
                                               np.where(d['Total_Occupancy_Count'] < 100, d['HVAC_Load_Estimate'] * 0.6,
                                                       d['HVAC_Load_Estimate']))
                )
            },
            {
                'name': 'Smart Grid Integration',
                'desc': 'Dynamic load shifting based on grid signals and pricing (40% reduction high-price periods).',
                'icon': '🔋',
                'apply': lambda d: d.assign(
                    HVAC_Load_Estimate=np.where(d['Energy_Price_USD_kWh'] > 0.12, d['HVAC_Load_Estimate'] * 0.6, d['HVAC_Load_Estimate']),
                    Energy_Plug_Wh=np.where(d['Energy_Price_USD_kWh'] > 0.12, d['Energy_Plug_Wh'] * 0.6, d['Energy_Plug_Wh']),
                    Device_Usage_Factor=np.where(d['Energy_Price_USD_kWh'] > 0.12, d['Device_Usage_Factor'] * 0.7, d['Device_Usage_Factor'])
                )
            }
        ]

        for logic in scenarios_logic:
            sc = baseline_df.copy()
            sc = logic['apply'](sc)
            sc = recalculate_derived_features(sc)
            
            # Predict with all models
            pred_hvac, pred_lighting, pred_plug, pred_total = predict_total(sc)
            
            monthly_kwh = float(pred_total[0]) * hours_per_month / 1000
            monthly_cost = (float(pred_total[0]) / 1000 * float(sc['Energy_Price_USD_kWh'].iloc[0])) * hours_per_month
            
            savings_kwh = baseline_monthly_kwh - monthly_kwh
            savings_pct = (savings_kwh / baseline_monthly_kwh * 100) if baseline_monthly_kwh > 0 else 0
            
            results.append({
                'scenario': logic['name'],
                'monthly_kwh': int(round(monthly_kwh)),
                'savings_kwh': int(round(savings_kwh)),
                'savings_pct': round(savings_pct, 2),
                'monthly_cost_usd': int(round(monthly_cost)),
                'cost_savings_usd': int(round(baseline_monthly_cost - monthly_cost)),
                'description': logic['desc'],
                'icon': logic.get('icon', '📊')
            })
            
            # Store model comparison for the first optimized scenario (skip baseline)
            if len(comparison_data['modelComparison']) == 0 and logic['name'] != 'Baseline':
                comparison_data['modelComparison'] = [
                    {'model': 'HVAC', 'before': comparison_data['baseline']['hvac'], 'after': float(pred_hvac[0])},
                    {'model': 'Lighting', 'before': comparison_data['baseline']['lighting'], 'after': float(pred_lighting[0])},
                    {'model': 'Plug', 'before': comparison_data['baseline']['plug'], 'after': float(pred_plug[0])},
                    {'model': 'Total', 'before': comparison_data['baseline']['total'], 'after': float(pred_total[0])}
                ]
        
        # Sort by savings percentage
        results = sorted(results, key=lambda x: x['savings_pct'], reverse=True)
        
        return jsonify({'success': True, 'scenarios': results, 'comparison': comparison_data})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/comparison', methods=['POST'])
def compare_scenarios():
    """Compare multiple scenarios with baseline predictions"""
    try:
        req = request.json
        scenario_keys = req.get('scenarios', ['baseline'])
        timestamp_str = req.get('timestamp', None)
        
        # Get baseline data
        if timestamp_str:
            closest_ts = get_closest_timestamp(timestamp_str)
            baseline_data = df.loc[closest_ts:closest_ts].iloc[0].copy()
        else:
            baseline_data = df.iloc[-1].copy()
        
        baseline_df = pd.DataFrame([baseline_data])
        baseline_df = recalculate_derived_features(baseline_df)
        _, _, _, baseline_pred = predict_total(baseline_df)
        baseline_total = float(baseline_pred[0])
        baseline_cost = (baseline_total / 1000) * baseline_data['Energy_Price_USD_kWh']
        
        comparisons = []
        for scenario_key in scenario_keys:
            config = SCENARIO_CONFIG.get(scenario_key, {})
            sim_data = baseline_data.copy()
            
            if scenario_key != 'baseline':
                for feature, val in config.items():
                    if feature == 'mod_type': continue
                    if feature in sim_data:
                        if config.get('mod_type') == 'add':
                            sim_data[feature] += val
                        elif config.get('mod_type') == 'multiply':
                            sim_data[feature] *= val
                        elif config.get('mod_type') == 'multiply_set':
                            if feature == 'Total_Occupancy_Count':
                                sim_data[feature] *= val
                            else:
                                sim_data[feature] = val
                        else:
                            sim_data[feature] = val
            
            sim_data['Temp_Deviation'] = abs(sim_data['OutsideWeather_Temp_C'] - sim_data.get('Indoor_Temp_C', 22))
            sim_data['Indoor_Temp_Deviation'] = abs(sim_data['Indoor_Temp_C'] - 22)
            
            input_df = pd.DataFrame([sim_data])
            input_df = recalculate_derived_features(input_df)
            pred_hvac, pred_lighting, pred_plug, pred_total = predict_total(input_df)
            
            total_energy = float(pred_total[0])
            total_cost = (total_energy / 1000) * sim_data['Energy_Price_USD_kWh']
            
            comparisons.append({
                'scenario': scenario_key,
                'energy_wh': total_energy,
                'cost': total_cost,
                'savings_wh': baseline_total - total_energy,
                'savings_cost': baseline_cost - total_cost,
                'savings_pct': ((baseline_total - total_energy) / baseline_total * 100) if baseline_total > 0 else 0,
                'breakdown': {
                    'hvac': float(pred_hvac[0]),
                    'lighting': float(pred_lighting[0]),
                    'plug': float(pred_plug[0])
                }
            })
        
        return jsonify({'success': True, 'baseline': {'energy_wh': baseline_total, 'cost': baseline_cost}, 'comparisons': comparisons})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/historical', methods=['GET'])
def get_historical_data():
    try:
        hours = int(request.args.get('hours', 24))
        end_time = request.args.get('end_time', None)
        
        if end_time:
            end_dt = pd.to_datetime(end_time)
        else:
            end_dt = df.index[-1]
        
        start_dt = end_dt - pd.Timedelta(hours=hours)
        historical = df.loc[start_dt:end_dt].copy()
        
        data = []
        for ts, row in historical.iterrows():
            data.append({
                'timestamp': ts.strftime('%m/%d/%Y %I:%M:%S %p'),
                'Indoor_Temp_C': float(row['Indoor_Temp_C']),
                'Indoor_Humidity_Pct': float(row['Indoor_Humidity_Pct']),
                'Total_Occupancy_Count': int(row['Total_Occupancy_Count']),
                'OutsideWeather_Temp_C': float(row['OutsideWeather_Temp_C']),
                'Energy_Price_USD_kWh': float(row['Energy_Price_USD_kWh'])
            })
        
        return jsonify({'success': True, 'data': data, 'count': len(data)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'message': 'Building Energy Digital Twin API is running',
        'models_loaded': True,
        'dataset_records': len(df)
    })

if __name__ == '__main__':
    print("Building Energy Digital Twin Backend API Started...")
    app.run(debug=True, host='0.0.0.0', port=5000)
