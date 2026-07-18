import joblib
import numpy as np
import pandas as pd
import tensorflow as tf

df = pd.read_csv(r"C:\Users\Laptop World\Building_Energy_Twin_Sequential_3Years.csv", parse_dates=['Timestamp'], index_col='Timestamp')

model_hvac = joblib.load(r"C:\Users\Laptop World\model_hvac_xgb_3y.pkl")
scaler_hvac = joblib.load(r"C:\Users\Laptop World\scaler_hvac_3y.pkl")

hvac_features = [
    'HVAC_Load_Estimate', 'Temp_Occupancy_Interaction', 'Indoor_Temp_Deviation',
    'Temp_Deviation', 'Total_Occupancy_Count', 'Indoor_Temp_C',
    'OutsideWeather_Temp_C', 'Hour', 'Is_Daytime', 'OutsideWeather_Humidity_Pct',
    'Indoor_Humidity_Pct', 'Pressure_mmHg', 'Indoor_Humidity_Deviation',
    'Season', 'Humidity_Deviation', 'Is_Weekend'
]

model_lighting = joblib.load(r"C:\Users\Laptop World\model_lighting_xgb_3y.pkl")
scaler_lighting = joblib.load(r"C:\Users\Laptop World\scaler_lighting_3y.pkl")

lighting_features = [
    'Hour', 'Is_Daytime', 'Total_Occupancy_Count', 'Day_of_Week', 'Is_Weekend',
    'Season', 'OutsideWeather_Temp_C', 'Temp_Deviation', 'Indoor_Temp_C',
    'Building_Area_m2', 'Daylight_Hours_Factor', 'Lighting_Occupancy_Ratio',
    'Solar_Irradiance_Estimate'
]

model_plug = joblib.load(r"C:\Users\Laptop World\model_plug_xgb_3y_improved.pkl")
scaler_plug = joblib.load(r"C:\Users\Laptop World\scaler_plug_3y_improved.pkl")

plug_features = [
    'Total_Occupancy_Count', 'Hour', 'Is_Daytime', 'Day_of_Week', 'Is_Weekend',
    'Season', 'Building_Area_m2', 'Energy_Price_USD_kWh', 'OutsideWeather_Temp_C',
    'Indoor_Temp_C', 'Plug_Peak_Hour', 'Device_Usage_Factor', 'Remote_Work_Factor',
    'Price_Sensitivity', 'Temp_Deviation', 'Indoor_Temp_Deviation', 'Solar_Irradiance_Estimate'
]

meta_model = tf.keras.models.load_model(r"C:\Users\Laptop World\meta_model_nn_3y_low_noise.keras")
meta_scaler = joblib.load(r"C:\Users\Laptop World\meta_scaler_3y_low_noise.pkl")

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
    return pred_total

baseline_df = df.copy()
baseline_df['Predicted_Total_Wh'] = predict_total(baseline_df)

hours_per_year = 8760
baseline_annual_kwh = baseline_df['Predicted_Total_Wh'].mean() * hours_per_year / 1000  # kWh

results = []
results.append({
    'Scenario': 'Baseline',
    'Annual_kWh': int(round(baseline_annual_kwh)),
    'Savings_kWh': 0,
    'Savings_%': 0.0,
    'Annual_Cost_USD': int(round((baseline_df['Predicted_Total_Wh'] / 1000 * baseline_df['Energy_Price_USD_kWh']).mean() * hours_per_year))
})

# HVAC Setpoint Optimization
sc = df.copy()
sc['Indoor_Temp_C'] = np.where(sc['Season'] == 3, sc['Indoor_Temp_C'] + 2, sc['Indoor_Temp_C'] - 2)
sc['Indoor_Temp_C'] = sc['Indoor_Temp_C'].clip(18, 28)
sc['Indoor_Temp_Deviation'] = np.abs(sc['Indoor_Temp_C'] - 22)
sc['Temp_Deviation'] = np.abs(sc['OutsideWeather_Temp_C'] - sc['Indoor_Temp_C'] + 2)
sc['HVAC_Load_Estimate'] = sc['Building_Area_m2'] * sc['Temp_Deviation'] * 0.01 + sc['Total_Occupancy_Count'] * 30
sc['Predicted_Total_Wh'] = predict_total(sc)
annual_kwh = sc['Predicted_Total_Wh'].mean() * hours_per_year / 1000
annual_cost = (sc['Predicted_Total_Wh'] / 1000 * sc['Energy_Price_USD_kWh']).mean() * hours_per_year
results.append({
    'Scenario': 'HVAC Setpoint Optimization',
    'Annual_kWh': int(round(annual_kwh)),
    'Savings_kWh': int(round(baseline_annual_kwh - annual_kwh)),
    'Savings_%': round((baseline_annual_kwh - annual_kwh) / baseline_annual_kwh * 100, 2),
    'Annual_Cost_USD': int(round(annual_cost))
})

# Occupancy-Based HVAC
sc = df.copy()
low_occupancy = sc['Total_Occupancy_Count'] < 80
sc.loc[low_occupancy, 'HVAC_Load_Estimate'] *= 0.4
sc['Predicted_Total_Wh'] = predict_total(sc)
annual_kwh = sc['Predicted_Total_Wh'].mean() * hours_per_year / 1000
annual_cost = (sc['Predicted_Total_Wh'] / 1000 * sc['Energy_Price_USD_kWh']).mean() * hours_per_year
results.append({
    'Scenario': 'Occupancy-Based HVAC',
    'Annual_kWh': int(round(annual_kwh)),
    'Savings_kWh': int(round(baseline_annual_kwh - annual_kwh)),
    'Savings_%': round((baseline_annual_kwh - annual_kwh) / baseline_annual_kwh * 100, 2),
    'Annual_Cost_USD': int(round(annual_cost))
})

# Natural Ventilation
sc = df.copy()
comfort_temp = (sc['OutsideWeather_Temp_C'] >= 18) & (sc['OutsideWeather_Temp_C'] <= 26)
sc.loc[comfort_temp, 'HVAC_Load_Estimate'] *= 0.5
sc['Predicted_Total_Wh'] = predict_total(sc)
annual_kwh = sc['Predicted_Total_Wh'].mean() * hours_per_year / 1000
annual_cost = (sc['Predicted_Total_Wh'] / 1000 * sc['Energy_Price_USD_kWh']).mean() * hours_per_year
results.append({
    'Scenario': 'Natural Ventilation',
    'Annual_kWh': int(round(annual_kwh)),
    'Savings_kWh': int(round(baseline_annual_kwh - annual_kwh)),
    'Savings_%': round((baseline_annual_kwh - annual_kwh) / baseline_annual_kwh * 100, 2),
    'Annual_Cost_USD': int(round(annual_cost))
})

# Combined Moderate
sc = df.copy()
sc['Indoor_Temp_C'] = np.where(sc['Season'] == 3, sc['Indoor_Temp_C'] + 1.5, sc['Indoor_Temp_C'] - 1.5)
sc['Indoor_Temp_C'] = sc['Indoor_Temp_C'].clip(18, 28)
sc['Indoor_Temp_Deviation'] = np.abs(sc['Indoor_Temp_C'] - 22)
low_occupancy = sc['Total_Occupancy_Count'] < 80
sc.loc[low_occupancy, 'HVAC_Load_Estimate'] *= 0.5
non_working = (sc['Hour'] < 8) | (sc['Hour'] > 17) | (sc['Is_Weekend'] == 1)
sc.loc[non_working, 'Energy_Plug_Wh'] *= 0.75
sc['Predicted_Total_Wh'] = predict_total(sc)
annual_kwh = sc['Predicted_Total_Wh'].mean() * hours_per_year / 1000
annual_cost = (sc['Predicted_Total_Wh'] / 1000 * sc['Energy_Price_USD_kWh']).mean() * hours_per_year
results.append({
    'Scenario': 'Combined Moderate',
    'Annual_kWh': int(round(annual_kwh)),
    'Savings_kWh': int(round(baseline_annual_kwh - annual_kwh)),
    'Savings_%': round((baseline_annual_kwh - annual_kwh) / baseline_annual_kwh * 100, 2),
    'Annual_Cost_USD': int(round(annual_cost))
})

# Combined Aggressive
df.copy()
sc['Indoor_Temp_C'] = np.where(sc['Season'] == 3, sc['Indoor_Temp_C'] + 3, sc['Indoor_Temp_C'] - 3)
sc['Indoor_Temp_C'] = sc['Indoor_Temp_C'].clip(18, 30)
sc['Indoor_Temp_Deviation'] = np.abs(sc['Indoor_Temp_C'] - 22)
low_occupancy = sc['Total_Occupancy_Count'] < 100
sc.loc[low_occupancy, 'HVAC_Load_Estimate'] *= 0.3
comfort_temp = (sc['OutsideWeather_Temp_C'] >= 18) & (sc['OutsideWeather_Temp_C'] <= 26)
sc.loc[comfort_temp, 'HVAC_Load_Estimate'] *= 0.4
non_working = (sc['Hour'] < 8) | (sc['Hour'] > 17) | (sc['Is_Weekend'] == 1)
sc.loc[non_working, 'Energy_Plug_Wh'] *= 0.5
high_price = sc['Energy_Price_USD_kWh'] > 0.15
sc.loc[high_price, 'Energy_Plug_Wh'] *= 0.7
sc['Predicted_Total_Wh'] = predict_total(sc)
annual_kwh = sc['Predicted_Total_Wh'].mean() * hours_per_year / 1000
annual_cost = (sc['Predicted_Total_Wh'] / 1000 * sc['Energy_Price_USD_kWh']).mean() * hours_per_year
results.append({
    'Scenario': 'Combined Aggressive',
    'Annual_kWh': int(round(annual_kwh)),
    'Savings_kWh': int(round(baseline_annual_kwh - annual_kwh)),
    'Savings_%': round((baseline_annual_kwh - annual_kwh) / baseline_annual_kwh * 100, 2),
    'Annual_Cost_USD': int(round(annual_cost))
})

# Aggressive HVAC + Natural Ventilation
sc = df.copy()
sc['Indoor_Temp_C'] = np.where(sc['Season'] == 3, sc['Indoor_Temp_C'] + 3, sc['Indoor_Temp_C'] - 2)
sc['Indoor_Temp_C'] = sc['Indoor_Temp_C'].clip(18, 30)
sc['Indoor_Temp_Deviation'] = np.abs(sc['Indoor_Temp_C'] - 22)
comfort_temp = (sc['OutsideWeather_Temp_C'] >= 18) & (sc['OutsideWeather_Temp_C'] <= 27)
sc.loc[comfort_temp, 'HVAC_Load_Estimate'] *= 0.3
sc['Predicted_Total_Wh'] = predict_total(sc)
annual_kwh = sc['Predicted_Total_Wh'].mean() * hours_per_year / 1000
annual_cost = (sc['Predicted_Total_Wh'] / 1000 * sc['Energy_Price_USD_kWh']).mean() * hours_per_year
results.append({
    'Scenario': 'Aggressive HVAC + Natural Ventilation',
    'Annual_kWh': int(round(annual_kwh)),
    'Savings_kWh': int(round(baseline_annual_kwh - annual_kwh)),
    'Savings_%': round((baseline_annual_kwh - annual_kwh) / baseline_annual_kwh * 100, 2),
    'Annual_Cost_USD': int(round(annual_cost))
})

# Ultimate Combined (All Aggressive)
sc = df.copy()
sc['Indoor_Temp_C'] = np.where(sc['Season'] == 3, sc['Indoor_Temp_C'] + 3, sc['Indoor_Temp_C'] - 3)
sc['Indoor_Temp_C'] = sc['Indoor_Temp_C'].clip(18, 30)
sc['Indoor_Temp_Deviation'] = np.abs(sc['Indoor_Temp_C'] - 22)
low_occupancy = sc['Total_Occupancy_Count'] < 100
sc.loc[low_occupancy, 'HVAC_Load_Estimate'] *= 0.2
comfort_temp = (sc['OutsideWeather_Temp_C'] >= 18) & (sc['OutsideWeather_Temp_C'] <= 27)
sc.loc[comfort_temp, 'HVAC_Load_Estimate'] *= 0.2
non_working = (sc['Hour'] < 7) | (sc['Hour'] > 18) | (sc['Is_Weekend'] == 1)
sc.loc[non_working, 'Energy_Plug_Wh'] *= 0.3
high_price = sc['Energy_Price_USD_kWh'] > 0.14
sc.loc[high_price, 'Energy_Plug_Wh'] *= 0.6
sc['Predicted_Total_Wh'] = predict_total(sc)
annual_kwh = sc['Predicted_Total_Wh'].mean() * hours_per_year / 1000
annual_cost = (sc['Predicted_Total_Wh'] / 1000 * sc['Energy_Price_USD_kWh']).mean() * hours_per_year
results.append({
    'Scenario': 'Ultimate Combined (All Aggressive)',
    'Annual_kWh': int(round(annual_kwh)),
    'Savings_kWh': int(round(baseline_annual_kwh - annual_kwh)),
    'Savings_%': round((baseline_annual_kwh - annual_kwh) / baseline_annual_kwh * 100, 2),
    'Annual_Cost_USD': int(round(annual_cost))
})

results_df = pd.DataFrame(results)
results_df['Cost_Savings_USD'] = results_df['Annual_Cost_USD'].iloc[0] - results_df['Annual_Cost_USD']

print(results_df.to_string(index=False))