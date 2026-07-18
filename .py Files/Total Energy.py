import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

df = pd.read_csv(r"C:\Users\Laptop World\Building_Energy_Twin_Sequential_3Years_LowNoise.csv", parse_dates=['Timestamp'], index_col='Timestamp')

model_hvac = joblib.load(r"C:\Users\Laptop World\model_hvac_xgb_3y.pkl")
scaler_hvac = joblib.load(r"C:\Users\Laptop World\scaler_hvac_3y.pkl")

hvac_features = [
    'HVAC_Load_Estimate', 'Temp_Occupancy_Interaction', 'Indoor_Temp_Deviation',
    'Temp_Deviation', 'Total_Occupancy_Count', 'Indoor_Temp_C',
    'OutsideWeather_Temp_C', 'Hour', 'Is_Daytime', 'OutsideWeather_Humidity_Pct',
    'Indoor_Humidity_Pct', 'Pressure_mmHg', 'Indoor_Humidity_Deviation',
    'Season', 'Humidity_Deviation', 'Is_Weekend'
]

X_hvac = df[hvac_features]
X_hvac_scaled = scaler_hvac.transform(X_hvac)
pred_hvac = model_hvac.predict(X_hvac_scaled)

model_lighting = joblib.load(r"C:\Users\Laptop World\model_lighting_xgb_3y.pkl")
scaler_lighting = joblib.load(r"C:\Users\Laptop World\scaler_lighting_3y.pkl")

lighting_features = [
    'Hour', 'Is_Daytime', 'Total_Occupancy_Count', 'Day_of_Week', 'Is_Weekend',
    'Season', 'OutsideWeather_Temp_C', 'Temp_Deviation', 'Indoor_Temp_C',
    'Building_Area_m2', 'Daylight_Hours_Factor', 'Lighting_Occupancy_Ratio',
    'Solar_Irradiance_Estimate'
]

X_lighting = df[lighting_features]
X_lighting_scaled = scaler_lighting.transform(X_lighting)
pred_lighting = model_lighting.predict(X_lighting_scaled)

model_plug = joblib.load(r"C:\Users\Laptop World\model_plug_xgb_3y_improved.pkl")
scaler_plug = joblib.load(r"C:\Users\Laptop World\scaler_plug_3y_improved.pkl")

plug_features = [
    'Total_Occupancy_Count', 'Hour', 'Is_Daytime', 'Day_of_Week', 'Is_Weekend',
    'Season', 'Building_Area_m2', 'Energy_Price_USD_kWh', 'OutsideWeather_Temp_C',
    'Indoor_Temp_C', 'Plug_Peak_Hour', 'Device_Usage_Factor', 'Remote_Work_Factor',
    'Price_Sensitivity', 'Temp_Deviation', 'Indoor_Temp_Deviation', 'Solar_Irradiance_Estimate'
]

X_plug = df[plug_features]
X_plug_scaled = scaler_plug.transform(X_plug)
pred_plug = model_plug.predict(X_plug_scaled)

meta_input = np.column_stack([pred_hvac, pred_lighting, pred_plug, df['Energy_Other_Wh'].values])

X_train, X_test, y_train, y_test = train_test_split(meta_input, df['Total_Energy_Wh'].values, test_size=0.2, random_state=42)

scaler_meta = StandardScaler()
X_train_scaled = scaler_meta.fit_transform(X_train)
X_test_scaled = scaler_meta.transform(X_test)

model = Sequential([
    Dense(256, activation='relu', input_shape=(4,)),
    BatchNormalization(),
    Dropout(0.3),
    Dense(128, activation='relu'),
    BatchNormalization(),
    Dropout(0.3),
    Dense(64, activation='relu'),
    BatchNormalization(),
    Dropout(0.2),
    Dense(32, activation='relu'),
    Dropout(0.1),
    Dense(1, activation='linear')
])

model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss='mse', metrics=['mae'])

early_stop = EarlyStopping(monitor='val_loss', patience=20, restore_best_weights=True)
reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=10, min_lr=1e-7)

model.fit(X_train_scaled, y_train, validation_split=0.2, epochs=400, batch_size=256, callbacks=[early_stop, reduce_lr], verbose=1)

pred_total = model.predict(X_test_scaled).flatten()

r2 = r2_score(y_test, pred_total)
mae = mean_absolute_error(y_test, pred_total)
rmse = np.sqrt(mean_squared_error(y_test, pred_total))

print("Level 2 - Meta Model (Stacked NN)")
print(f"R²:   {r2:.4f}")
print(f"MAE:  {mae:.4f} Wh")
print(f"RMSE: {rmse:.4f} Wh")

model.save(r"C:\Users\Laptop World\meta_model_nn_3y_low_noise.keras")
joblib.dump(scaler_meta, r"C:\Users\Laptop World\meta_scaler_3y_low_noise.pkl")