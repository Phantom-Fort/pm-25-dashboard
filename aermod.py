import sys
import json
import numpy as np
import math

def get_stability_class(temperature_c: float, wind_speed_m_s: float) -> str:
    if wind_speed_m_s < 2 and temperature_c > 25:
        return "F"
    elif wind_speed_m_s < 5:
        return "D"
    else:
        return "B"

def get_dispersion_coefficients(stability: str, distance_m: float) -> tuple:
    if stability == "F":
        sigma_y = 0.08 * distance_m * (1 + 0.0001 * distance_m) ** -0.5
        sigma_z = 0.06 * distance_m * (1 + 0.0015 * distance_m) ** -0.5
    elif stability == "D":
        sigma_y = 0.11 * distance_m * (1 + 0.0001 * distance_m) ** -0.5
        sigma_z = 0.08 * distance_m * (1 + 0.0015 * distance_m) ** -0.5
    else:
        sigma_y = 0.22 * distance_m * (1 + 0.0001 * distance_m) ** -0.5
        sigma_z = 0.12 * distance_m * (1 + 0.0015 * distance_m) ** -0.5
    return sigma_y, sigma_z

def calculate_dispersion(
    source_pm25: float, wind_speed: float, wind_dir: float, distances: np.ndarray
) -> np.ndarray:
    stability = get_stability_class(25.0, wind_speed)
    theta = math.radians(wind_dir)
    x = distances * np.cos(theta)
    y = distances * np.sin(theta)
    sigma_y, sigma_z = get_dispersion_coefficients(stability, distances)
    Q = source_pm25 / 1000
    H = 0.0
    concentration = (
        (Q / (2 * math.pi * wind_speed * sigma_y * sigma_z))
        * np.exp(-0.5 * (y**2 / sigma_y**2))
        * np.exp(-0.5 * ((H) ** 2 / sigma_z**2))
    )
    return concentration * 1000

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

    pm25 = data.get("pm25", 0.0)
    wind_speed = data.get("wind_speed_m_s", 2.0)
    wind_dir = data.get("wind_direction_deg", 180.0)
    base_lat = 6.9149
    base_lon = 5.1478

    try:
        n_points = 10
        distances = np.linspace(100, 10000, n_points)
        angles = np.linspace(-45, 45, n_points) * math.pi / 180
        lats = base_lat + (distances * np.sin(angles)) / 111000
        lons = base_lon + (distances * np.cos(angles)) / (
            111000 / math.cos(math.radians(base_lat))
        )

        concentrations = calculate_dispersion(pm25, wind_speed, wind_dir, distances)
        dispersion = [
            {
                "latitude": float(lats[i]),
                "longitude": float(lons[i]),
                "pm25": float(concentrations[i]),
            }
            for i in range(n_points)
            if concentrations[i] > 0.1 * np.max(concentrations)
        ]
        print(json.dumps({"dispersion": dispersion}))
    except Exception as e:
        print(json.dumps({"error": f"Dispersion failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()