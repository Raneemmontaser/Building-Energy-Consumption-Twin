# Building Energy Digital Twin Project

## Project Overview

This project implements a **Building Energy Digital Twin** for intelligent energy management and decision support. The system simulates, predicts, and optimizes building energy consumption using a **hierarchical machine learning architecture** that models individual sub-systems (HVAC, Lighting, and Plug Loads) and aggregates them into a unified total energy prediction.

The solution includes:

* A **synthetic data generator** for realistic building behavior simulation
* Multiple **machine learning models** organized hierarchically
* A **Flask-based backend API** for inference, simulation, and optimization
* A **React dashboard** for real-time visualization and scenario analysis

The project is designed to demonstrate how Digital Twins can be applied to smart buildings, energy optimization, and AI-driven sustainability.


---

## 1. Data Generation & Preprocessing

### Synthetic_data.ipynb

**Description:**
A Jupyter Notebook used to generate a realistic synthetic dataset representing hourly building operation.

**Key Capabilities:**

* Simulates hourly timestamps
* Generates weather conditions
* Models occupancy behavior
* Derives energy consumption for HVAC, lighting, and plug loads

### Building_Energy_Twin_Sequential.csv

**Description:**
The primary dataset used for training and testing all machine learning models.

---

## 2. Dataset Feature Description

### Time & Calendar Features

* **Timestamp**: Hourly date-time index
* **Hour**: Hour of the day (0–23)
* **Day_of_Week**: Day index (0=Monday, 6=Sunday)
* **Is_Weekend**: Weekend indicator (0/1)
* **Is_Daytime**: Daytime flag (07:00–18:00)
* **Month**: Month number (1–12)
* **Season**: Season code (1=Winter, 2=Spring, 3=Summer, 4=Autumn)

### Weather Features (External)

* **OutsideWeather_Temp_C**: Outdoor temperature (°C)
* **OutsideWeather_Humidity_Pct**: Outdoor humidity (%)
* **Pressure_mmHg**: Atmospheric pressure
* **Wind_Speed_m_s**: Wind speed (m/s)

### Occupancy & Building Properties

* **Total_Occupancy_Count**: Number of occupants per hour
* **Building_Area_m2**: Fixed building area (8000 m²)

### Derived Thermal Features (HVAC-Relevant)

* **Temp_Deviation**: |Outside Temp − 22°C|
* **HVAC_Load_Estimate**: Estimated heating/cooling demand
* **Temp_Occupancy_Interaction**: Temp_Deviation × Occupancy

### Indoor Comfort Indicators

* **Indoor_Temp_C**: Indoor temperature
* **Indoor_Humidity_Pct**: Indoor humidity
* **Indoor_Temp_Deviation**: |Indoor Temp − 22°C|
* **Indoor_Humidity_Deviation**: |Indoor Humidity − 50%|
* **Humidity_Deviation**: |Outdoor Humidity − 50%|

### Lighting-Related Features

* **Daylight_Hours_Factor**: Daylight availability factor (0–1)
* **Lighting_Occupancy_Ratio**: Occupancy-to-capacity ratio
* **Solar_Irradiance_Estimate**: Estimated sunlight intensity

### Plug Load Features

* **Plug_Peak_Hour**: Peak working hours indicator (09:00–17:00)
* **Device_Usage_Factor**: Device usage multiplier
* **Remote_Work_Factor**: Weekend / remote work reduction factor
* **Price_Sensitivity**: Demand-response adjustment factor

### Target Variables (Energy Outputs)

* **Energy_Price_USD_kWh**: Electricity price per kWh
* **Energy_HVAC_Wh**: HVAC energy consumption
* **Energy_Lighting_Wh**: Lighting energy consumption
* **Energy_Plug_Wh**: Plug load energy consumption
* **Energy_Other_Wh**: Base miscellaneous load
* **Total_Energy_Wh**: Total building energy consumption

---

## 3. Machine Learning Architecture (Hierarchical Regression)

The system follows a **hierarchical modeling strategy** where sub-system energy loads are predicted independently and then aggregated using a meta-model.

### Step 1: Sub-System Models

#### HVAC_Model.py

* **Algorithm:** XGBoost Regressor
* **Inputs:** Weather, occupancy, and thermal interaction features
* **Output:** `Energy_HVAC_Wh`

#### Lighting_Model.py

* **Algorithm:** XGBoost Regressor
* **Inputs:** Time features, solar irradiance, daylight factors, occupancy
* **Output:** `Energy_Lighting_Wh`

#### Plug_Model.py

* **Algorithm:** XGBoost Regressor
* **Inputs:** Work schedules, device usage factors, occupancy patterns
* **Output:** `Energy_Plug_Wh`

### Step 2: Aggregation Model

#### Total_Energy.py

* **Algorithm:** Neural Network (TensorFlow / Keras)
* **Inputs:**

  * Predicted HVAC load
  * Predicted Lighting load
  * Predicted Plug load
  * High-level temporal features
* **Output:** `Total_Energy_Wh`

This model acts as a **meta-learner**, synthesizing all sub-system behaviors into a final building-level energy prediction.

---

## 4. Optimization & Simulation

### Optimizer.py

**Purpose:**
Evaluates energy cost and proposes optimization strategies.

**Examples:**

* HVAC setpoint adjustment
* Plug load reduction during non-working hours
* Energy-aware scheduling to reduce annual cost

### Simulation Scenarios

Available through the backend and frontend UI:

* **Baseline** – Current operating conditions
* **Heatwave / Cold Snap** – ±5°C outdoor temperature
* **High Occupancy** – +50% occupants
* **Remote Work** – 30% occupancy with reduced plug loads
* **Green Mode** – Energy-minimized configuration

---

## 5. Application Layer

### Backend (Flask)

**File:** `Backend_App.py`

**Endpoints:**

* `/api/sensor/current` – Current simulated sensor values
* `/api/predict` – Energy prediction via hierarchical models
* `/api/simulate` – Scenario-based simulation
* `/api/optimize` – Optimization recommendations

### Frontend (React)

**File:** `App.js`

**Dashboard Features:**

* Real-time sensor visualization (temperature, humidity, occupancy)
* Scenario selector and comparison views
* Energy breakdown charts (Line, Bar, Radar)

---

## 6. Technology Stack

* **Languages:** Python, JavaScript
* **Data & ML:** Pandas, NumPy, Scikit-Learn, XGBoost, TensorFlow / Keras
* **Backend:** Flask, Flask-CORS
* **Frontend:** React, Recharts, Lucide-React

---

## 7. Usage Guide

### Data Generation

```bash
jupyter notebook Synthetic_data.ipynb
```

### Model Training

Run models sequentially:

```bash
python HVAC_Model.py
python Lighting_Model.py
python Plug_Model.py
python Total_Energy.py
```

### Backend

```bash
python Backend_App.py
```

Runs on `http://localhost:5000`

### Frontend

```bash
npm install
npm start
```


