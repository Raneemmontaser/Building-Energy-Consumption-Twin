import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib
from xgboost import XGBRegressor

df = pd.read_csv(r"C:\Users\Laptop World\Building_Energy_Twin_Sequential_3Years_LowNoise.csv", parse_dates=['Timestamp'], index_col='Timestamp')

features = [
    'Hour',
    'Is_Daytime',
    'Total_Occupancy_Count',
    'Day_of_Week',
    'Is_Weekend',
    'Season',
    'OutsideWeather_Temp_C',
    'Temp_Deviation',
    'Indoor_Temp_C',
    'Building_Area_m2',
    'Daylight_Hours_Factor',
    'Lighting_Occupancy_Ratio',
    'Solar_Irradiance_Estimate'
]

target = 'Energy_Lighting_Wh'

X = df[features]
y = df[target]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

model = XGBRegressor(
    n_estimators=1500,
    learning_rate=0.05,
    max_depth=8,
    subsample=0.9,
    colsample_bytree=0.9,
    random_state=42,
    n_jobs=-1,
    tree_method='hist',
    eval_metric='rmse',
    early_stopping_rounds=100
)

model.fit(
    X_train_scaled, y_train,
    eval_set=[(X_test_scaled, y_test)],
    verbose=False
)

pred = model.predict(X_test_scaled)

r2 = r2_score(y_test, pred)
mae = mean_absolute_error(y_test, pred)
rmse = np.sqrt(mean_squared_error(y_test, pred))

print("Model B - Lighting")
print(f"R²:   {r2:.4f}")
print(f"MAE:  {mae:.4f} Wh")
print(f"RMSE: {rmse:.4f} Wh")

joblib.dump(model, r"C:\Users\Laptop World\model_lighting_xgb_3y.pkl")
joblib.dump(scaler, r"C:\Users\Laptop World\scaler_lighting_3y.pkl")