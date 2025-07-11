import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import { toast } from "sonner";

interface PredictionInput {
  hole_diameter_mm: string;
  hole_depth_m: string;
  spacing_m: string;
  burden_m: string;
  charge_weight_kg: string;
  rock_density_g_cm3: string;
  moisture_percent: string;
  temperature_c: string;
  wind_speed_m_s: string;
  wind_direction_deg: string;
  humidity_percent: string;
  explosive_type: string;
  rock_type: string;
  dust_suppression: string;
  useApi: boolean;
  country: string;
  state: string;
}

interface DispersionData {
  latitude: number;
  longitude: number;
  pm25: number;
}

export const storePrediction = async ({
  input,
  prediction,
  dispersion = [],
  uid,
}: {
  input: PredictionInput;
  prediction: number;
  dispersion?: DispersionData[];
  uid?: string | null;
}) => {
  try {
    await addDoc(collection(db, "predictions"), {
      timestamp: new Date().toISOString(),
      input,
      prediction,
      dispersion,
      uid: uid || null,
    });
    console.log("✅ Prediction stored in Firestore");
  } catch (error) {
    console.error("❌ Error storing prediction:", error);
    toast.error("Failed to store prediction.");
  }
};

export const storeDispersion = async ({
  dispersion,
  metadata,
  uid,
}: {
  dispersion: DispersionData[];
  metadata?: {
    pm25: number;
    wind_speed: number;
    wind_dir: number;
  };
  uid?: string | null;
}) => {
  try {
    await addDoc(collection(db, "dispersion"), {
      timestamp: new Date().toISOString(),
      dispersion,
      metadata,
      uid: uid || null,
    });
    console.log("✅ Dispersion data stored in Firestore");
  } catch (error) {
    console.error("❌ Error storing dispersion data:", error);
    toast.error("Failed to store dispersion data.");
  }
};