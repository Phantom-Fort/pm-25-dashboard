import os
import json
import traceback
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import math

app = Flask(__name__)
CORS(app, resources={
    r"/predict": {"origins": "http://localhost:3000"},
    r"/aermod": {"origins": "http://localhost:3000"}
})

# Load model and scaler parameters
base_dir = os.path.dirname(os.path.abspath(__file__))

# Load trained model
model_path = os.path.join(base_dir, 'rf_model.pkl')
try:
    model = joblib.load(model_path)
except FileNotFoundError:
    print(f"Error: Model file not found at {model_path}")
    raise
except Exception as e:
    print(f"Error loading model: {str(e)}")
    raise

# Load min-max scaler parameters
scaler_params_path = os.path.join(base_dir, 'pm25_scaler_params.json')
try:
    with open(scaler_params_path, 'r') as f:
        scaler_params = json.load(f)
except FileNotFoundError:
    print(f"Error: Scaler parameters file not found at {scaler_params_path}")
    raise
except json.JSONDecodeError:
    print(f"Error: Invalid JSON in {scaler_params_path}")
    raise

# Load expected feature names
feature_names_path = os.path.join(base_dir, 'feature_names.json')
try:
    with open(feature_names_path, 'r') as f:
        feature_names = json.load(f)
except FileNotFoundError:
    print(f"Error: Feature names file not found at {feature_names_path}")
    raise
except json.JSONDecodeError:
    print(f"Error: Invalid JSON in {feature_names_path}")
    raise

# Define one-hot encoded features (not scaled)
one_hot_features = [
    "explosive_type_ANFO",
    "explosive_type_emulsion",
    "rock_type_granite",
    "rock_type_limestone",
    "rock_type_sandstone",
    "dust_suppression_none",
    "dust_suppression_water_spray",
    "dust_suppression_chemical"
]

# AERMOD functions
def get_stability_class(temperature_c: float, wind_speed_m_s: float) -> str:
    if wind_speed_m_s < 2 and temperature_c > 25:
        return 'F'  # Stable, low wind
    elif wind_speed_m_s < 5:
        return 'D'  # Neutral
    else:
        return 'B'  # Unstable

def get_dispersion_coefficients(stability: str, distance_m: float) -> tuple:
    if stability == 'F':
        sigma_y = 0.08 * distance_m * (1 + 0.0001 * distance_m)**-0.5
        sigma_z = 0.06 * distance_m * (1 + 0.0015 * distance_m)**-0.5
    elif stability == 'D':
        sigma_y = 0.11 * distance_m * (1 + 0.0001 * distance_m)**-0.5
        sigma_z = 0.08 * distance_m * (1 + 0.0015 * distance_m)**-0.5
    else:  # B
        sigma_y = 0.22 * distance_m * (1 + 0.0001 * distance_m)**-0.5
        sigma_z = 0.12 * distance_m * (1 + 0.0015 * distance_m)**-0.5
    return sigma_y, sigma_z

def calculate_dispersion(source_pm25: float, wind_speed: float, wind_dir: float, distances: np.ndarray) -> np.ndarray:
    stability = get_stability_class(25.0, wind_speed)
    theta = math.radians(wind_dir)
    x = distances * np.cos(theta)
    y = distances * np.sin(theta)
    sigma_y, sigma_z = get_dispersion_coefficients(stability, distances)
    
    Q = source_pm25 / 1000  # Convert to g/m³
    H = 0.0
    concentration = (Q / (2 * math.pi * wind_speed * sigma_y * sigma_z)) * np.exp(-0.5 * (y**2 / sigma_y**2)) * np.exp(-0.5 * ((H)**2 / sigma_z**2))
    return concentration * 1000  # Convert back to µg/m³

@app.route('/predict', methods=['POST'])
def predict():
    try:
        raw_data = request.get_data(as_text=True)
        print("Raw request data for /predict:", raw_data)
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received in request'}), 400

        print("Parsed JSON data for /predict:", data)

        missing_features = [feat for feat in feature_names if feat not in data]
        if missing_features:
            print(f"Missing features: {missing_features}")
            return jsonify({'error': f'Missing features: {missing_features}'}), 400

        df = pd.DataFrame([data], columns=feature_names)

        # Clamp and scale numerical features only
        for col in feature_names:
            if col in one_hot_features:
                # Validate one-hot features are 0 or 1
                if df[col].iloc[0] not in [0, 1]:
                    print(f"Invalid value for {col}: {df[col].iloc[0]} (must be 0 or 1)")
                    return jsonify({'error': f'Invalid value for {col}: must be 0 or 1'}), 400
                continue  # Skip scaling for one-hot features

            if col not in scaler_params:
                print(f"Scaler parameters missing for feature: {col}")
                return jsonify({'error': f'Scaler parameters missing for feature: {col}'}), 500

            min_val = scaler_params[col].get('min')
            max_val = scaler_params[col].get('max')

            if min_val is None or max_val is None:
                print(f"Incomplete scaler parameters for feature: {col}")
                return jsonify({'error': f'Incomplete scaler parameters for feature: {col}'}), 500

            # Clamp
            original_value = df[col].iloc[0]
            clamped_value = max(min(original_value, max_val), min_val)
            df[col] = clamped_value

            # Scale
            if max_val - min_val == 0:
                df[col] = 0  # Avoid division by zero
            else:
                df[col] = (clamped_value - min_val) / (max_val - min_val)

        print("Final scaled input for prediction:\n", df.to_dict())

        prediction = model.predict(df)[0]
        return jsonify({'pm25': float(prediction)})

    except Exception as e:
        print("======== EXCEPTION IN /predict ========")
        traceback.print_exc()
        print(f"Error: {str(e)}")
        print("====================================")
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500

@app.route('/aermod', methods=['POST'])
def aermod():
    try:
        raw_data = request.get_data(as_text=True)
        print("Raw request data for /aermod:", raw_data)
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        print("Parsed JSON data for /aermod:", data)

        pm25 = data.get('pm25', 0.0)
        wind_speed = data.get('wind_speed_m_s', 2.0)
        wind_dir = data.get('wind_direction_deg', 180.0)
        base_lat = 6.9149  # Ondo, Nigeria
        base_lon = 5.1478

        n_points = 10
        distances = np.linspace(100, 10000, n_points)
        angles = np.linspace(-45, 45, n_points) * math.pi / 180
        lats = base_lat + (distances * np.sin(angles)) / 111000
        lons = base_lon + (distances * np.cos(angles)) / (111000 / math.cos(math.radians(base_lat)))

        concentrations = calculate_dispersion(pm25, wind_speed, wind_dir, distances)
        dispersion = [
            {'latitude': float(lats[i]), 'longitude': float(lons[i]), 'pm25': float(concentrations[i])}
            for i in range(n_points) if concentrations[i] > 0.1 * np.max(concentrations)
        ]

        return jsonify({'dispersion': dispersion})

    except Exception as e:
        print("======== EXCEPTION IN /aermod ========")
        traceback.print_exc()
        print(f"Error: {str(e)}")
        print("====================================")
        return jsonify({'error': f'Dispersion failed: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Flask server is running'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)