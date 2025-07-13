import { NextResponse } from "next/server";

function linspace(start: number, end: number, num: number): number[] {
  const arr: number[] = [];
  const step = (end - start) / (num - 1);
  for (let i = 0; i < num; i++) arr.push(start + i * step);
  return arr;
}

function getStabilityClass(tempC: number, windSpeed: number): string {
  if (windSpeed < 2 && tempC > 25) return "F"; // stable, low mixing
  if (windSpeed < 5) return "D"; // neutral
  return "B"; // unstable, high mixing
}

function getDispersionCoefficients(stability: string, distance: number): [number, number] {
  let sigmaY = 0, sigmaZ = 0;
  switch (stability) {
    case "F":
      sigmaY = 0.08 * distance * Math.pow(1 + 0.0001 * distance, -0.5);
      sigmaZ = 0.06 * distance * Math.pow(1 + 0.0015 * distance, -0.5);
      break;
    case "D":
      sigmaY = 0.11 * distance * Math.pow(1 + 0.0001 * distance, -0.5);
      sigmaZ = 0.08 * distance * Math.pow(1 + 0.0015 * distance, -0.5);
      break;
    default: // "B"
      sigmaY = 0.22 * distance * Math.pow(1 + 0.0001 * distance, -0.5);
      sigmaZ = 0.12 * distance * Math.pow(1 + 0.0015 * distance, -0.5);
  }
  return [sigmaY, sigmaZ];
}

function calculateDispersion(pm25: number, windSpeed: number, windDir: number, distances: number[]) {
  const stability = getStabilityClass(25.0, windSpeed); // ambient temp assumed 25°C
  const theta = (windDir * Math.PI) / 180;
  const y = distances.map((d) => d * Math.sin(theta));
  const Q = pm25 / 1000; // Convert to g/s for Gaussian model
  const H = 0.0;

  return distances.map((d, i) => {
    const [sigmaY, sigmaZ] = getDispersionCoefficients(stability, d);
    const exponentY = -0.5 * Math.pow(y[i] / sigmaY, 2);
    const exponentZ = -0.5 * Math.pow(H / sigmaZ, 2);
    const concentration =
      (Q / (2 * Math.PI * windSpeed * sigmaY * sigmaZ)) *
      Math.exp(exponentY) *
      Math.exp(exponentZ);
    return concentration * 1000; // µg/m³
  });
}

export async function POST(request: Request) {
  try {
    const { pm25 = 0.0, wind_speed_m_s = 2.0, wind_direction_deg = 180.0 } = await request.json();

    const baseLat = 6.9149;
    const baseLon = 5.1478;
    const nPoints = 10;
    const distances = linspace(100, 10000, nPoints);
    const angles = linspace(-45, 45, nPoints).map((deg) => deg * (Math.PI / 180));

    const lats = angles.map((a, i) => baseLat + (distances[i] * Math.sin(a)) / 111000);
    const lons = angles.map(
      (a, i) => baseLon + (distances[i] * Math.cos(a)) / (111000 / Math.cos(baseLat * (Math.PI / 180)))
    );

    const concentrations = calculateDispersion(pm25, wind_speed_m_s, wind_direction_deg, distances);

    const maxConc = Math.max(...concentrations);
    const dispersion = concentrations
      .map((c, i) => ({
        latitude: lats[i],
        longitude: lons[i],
        pm25: c,
      }))
      .filter((point) => point.pm25 > 0.1 * maxConc); // filter weak points

    return NextResponse.json({ dispersion }, { status: 200 });
  } catch (error) {
    console.error("Dispersion error:", error);
    return NextResponse.json({ error: `Dispersion failed: ${error || "Unknown error"}` }, { status: 500 });
  }
}