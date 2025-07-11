import sys
import json
import os
import numpy as np
import joblib
import pandas as pd

# Load model and scaler parameters
base_dir = os.path.dirname(os.path.abspath(__file__))

# Load trained model
model_path = os.path.join(base_dir, "rf_model.pkl")
try:
    model = joblib.load(model_path)
except FileNotFoundError:
    print(json.dumps({"error": f"Model file not found at {model_path}"}))
    sys.exit(1)

# Load min-max scaler parameters
scaler_params_path = os.path.join(base_dir, "pm25_scaler_params.json")
try:
    with open(scaler_params_path, "r") as f:
        scaler_params = json.load(f)
except FileNotFoundError:
    print(json.dumps({"error": f"Scaler parameters file not found at {scaler_params_path}"}))
    sys.exit(1)

# Load expected feature names
feature_names_path = os.path.join(base_dir, "feature_names.json")
try:
    with open(feature_names_path, "r") as f:
        feature_names = json.load(f)
except FileNotFoundError:
    print(json.dumps({"error": f"Feature names file not found at {feature_names_path}"}))
    sys.exit(1)

# Define one-hot encoded features (not scaled)
one_hot_features = [
    "explosive_type_ANFO",
    "explosive_type_emulsion",
    "rock_type_granite",
    "rock_type_limestone",
    "rock_type_sandstone",
    "dust_suppression_none",
    "dust_suppression_water_spray",
    "dust_suppression_chemical",
]

def main():
    # Read input from file
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input file provided"}))
        sys.exit(1)

    input_file = sys.argv[1]
    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON data in input file: {str(e)}"}))
        sys.exit(1)
    except FileNotFoundError:
        print(json.dumps({"error": f"Input file not found: {input_file}"}))
        sys.exit(1)

    # Validate input
    missing_features = [feat for feat in feature_names if feat not in data]
    if missing_features:
        print(json.dumps({"error": f"Missing features: {missing_features}"}))
        sys.exit(1)

    df = pd.DataFrame([data], columns=feature_names)

    # Clamp and scale numerical features
    for col in feature_names:
        if col in one_hot_features:
            if df[col].iloc[0] not in [0, 1]:
                print(
                    json.dumps(
                        {"error": f"Invalid value for {col}: must be 0 or 1"}
                    )
                )
                sys.exit(1)
            continue

        if col not in scaler_params:
            print(
                json.dumps(
                    {"error": f"Scaler parameters missing for feature: {col}"}
                )
            )
            sys.exit(1)

        min_val = scaler_params[col].get("min")
        max_val = scaler_params[col].get("max")

        if min_val is None or max_val is None:
            print(
                json.dumps(
                    {"error": f"Incomplete scaler parameters for feature: {col}"}
                )
            )
            sys.exit(1)

        original_value = df[col].iloc[0]
        clamped_value = max(min(original_value, max_val), min_val)
        df[col] = clamped_value

        if max_val - min_val == 0:
            df[col] = 0
        else:
            df[col] = (clamped_value - min_val) / (max_val - min_val)

    # Make prediction
    try:
        prediction = model.predict(df)[0]
        print(json.dumps({"pm25": float(prediction)}))
    except Exception as e:
        print(json.dumps({"error": f"Prediction failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()