"use client";

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import * as React from 'react';
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { TrendingUp, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageWrapper from "@/components/ui/PageWrapper";

// Define type for dispersion data
type DispersionData = {
  latitude: number;
  longitude: number;
  pm25: number;
};

// Initialize Leaflet icon options
(function () {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
})();

// Function to scale PM2.5 values to a maximum of 30 µg/m³
const scalePm25 = (value: number, maxValue: number = 30): number => {
  return Math.min(value, maxValue);
};

// Haversine formula to calculate distance in km between two lat/lng points
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function MapChartClient({
  showPrediction,
  prediction,
  dispersion,
  regionalStandards,
  loadingDispersion,
  handleDispersionRun,
}: {
  showPrediction: boolean;
  prediction: number | null;
  dispersion: DispersionData[];
  regionalStandards: { jurisdiction: string; annual: number; daily: number | null }[];
  loadingDispersion: boolean;
  handleDispersionRun: () => void;
}) {
  const [comparisonType, setComparisonType] = React.useState<'daily' | 'annual'>('daily');

  // Area Chart Data
  const areaChartData = regionalStandards.map((std) => ({
    jurisdiction: std.jurisdiction,
    standard: comparisonType === 'daily' ? std.daily ?? 0 : std.annual,
    prediction: prediction ? scalePm25(prediction) : 0,
  }));

  const areaChartConfig = {
    standard: {
      label: `${comparisonType === 'daily' ? 'Daily' : 'Annual'} Limit`,
      color: 'var(--color-primary)', // Theme primary color (e.g., blue)
    },
    prediction: {
      label: 'Prediction',
      color: 'var(--color-secondary)', // Theme secondary color (e.g., green)
    },
  } satisfies ChartConfig;

  // Radar Chart Data (Directional Dispersion)
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const radarChartData = directions.map((direction, index) => {
    const angle = index * 45; // Center of each 45-degree sector
    const sectorPoints = dispersion.filter((point) => {
      // Calculate angle from center (6.5244, 3.3792) to point
      let pointAngle = Math.atan2(point.longitude - 3.3792, point.latitude - 6.5244) * 180 / Math.PI;
      // Normalize angle to [0, 360)
      pointAngle = (pointAngle + 360) % 360;
      const sectorStart = (angle - 22.5 + 360) % 360;
      const sectorEnd = (angle + 22.5 + 360) % 360;
      // Handle wrap-around at 0/360
      if (sectorStart < sectorEnd) {
        return pointAngle >= sectorStart && pointAngle <= sectorEnd;
      } else {
        return pointAngle >= sectorStart || pointAngle <= sectorEnd;
      }
    });
    // Calculate average PM2.5 with distance-based decay
    const avgPm25 = sectorPoints.length
      ? sectorPoints.reduce((sum, point) => {
          const distance = haversineDistance(6.5244, 3.3792, point.latitude, point.longitude);
          // Stronger decay factor to emphasize reduction with distance
          const decayFactor = 1 / (1 + distance * 2); // Increased decay rate
          return sum + scalePm25(point.pm25 * decayFactor);
        }, 0) / sectorPoints.length
      : 0.1; // Minimum value for visibility
    return { direction, pm25: scalePm25(avgPm25) };
  });

  const radarChartConfig = {
    pm25: {
      label: 'PM2.5 (µg/m³)',
      color: 'var(--color-accent)', // Theme accent color (e.g., yellow)
    },
  } satisfies ChartConfig;

  // Line Chart Data (Predicted PM2.5 vs Regulatory Thresholds)
  const lineChartData = regionalStandards.map((std) => ({
    jurisdiction: std.jurisdiction,
    dailyLimit: std.daily ?? 0,
    annualLimit: std.annual,
    prediction: prediction ? scalePm25(prediction) : 0,
  }));

  const lineChartConfig = {
    dailyLimit: {
      label: 'Daily Limit',
      color: 'var(--color-primary)', // Theme primary color
    },
    annualLimit: {
      label: 'Annual Limit',
      color: 'var(--color-accent)', // Theme accent color
    },
    prediction: {
      label: 'Predicted PM2.5',
      color: 'var(--color-secondary)', // Theme secondary color
    },
  } satisfies ChartConfig;

  // Bar Chart Data (Dispersion at Distance Ranges)
  const distanceRanges = ['0-1km', '1-2km', '2-3km', '3-4km', '4-5km', '>5km'];
  const barChartData = distanceRanges.map((range) => {
    const [start, end] = range.includes('>')
      ? [parseFloat(range.slice(1, -2)), Infinity]
      : range.split('-').map((val) => parseFloat(val.replace('km', '')));
    const pointsInRange = dispersion.filter((point) => {
      const distance = haversineDistance(6.5244, 3.3792, point.latitude, point.longitude);
      return distance >= start && distance < end;
    });
    // Calculate average PM2.5 with distance-based decay
    const avgPm25 = pointsInRange.length
      ? pointsInRange.reduce((sum, point) => {
          const distance = haversineDistance(6.5244, 3.3792, point.latitude, point.longitude);
          // Stronger decay factor to emphasize reduction with distance
          const decayFactor = 1 / (1 + distance * 2); // Increased decay rate
          return sum + scalePm25(point.pm25 * decayFactor);
        }, 0) / pointsInRange.length
      : 0.1; // Minimum value for visibility
    return { range, pm25: scalePm25(avgPm25) };
  });

  const barChartConfig = {
    pm25: {
      label: 'PM2.5 (µg/m³)',
      color: 'var(--color-primary)', // Theme primary color
    },
  } satisfies ChartConfig;

  return (
    <PageWrapper>
      {/* Leaflet Map */}
      <div className="relative h-[400px] w-full mt-6 rounded-xl overflow-hidden border border-border shadow-sm bg-background">
        <MapContainer
          center={[6.5244, 3.3792]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            className="opacity-90"
          />
          {dispersion.map((point, index) => (
            <Marker key={index} position={[point.latitude, point.longitude]}>
              <Popup className="bg-background text-foreground border border-border rounded-lg p-2">
                PM2.5: {scalePm25(point.pm25).toFixed(2)} µg/m³
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Select for Area Chart Type */}
      {regionalStandards.length > 0 && (
        <div className="flex justify-end mt-6">
          <Select value={comparisonType} onValueChange={(val: 'daily' | 'annual') => setComparisonType(val)}>
            <SelectTrigger className="w-[180px] rounded-lg border-border bg-background text-foreground focus:ring focus:ring-ring">
              <SelectValue placeholder="Compare with" />
            </SelectTrigger>
            <SelectContent className="bg-background text-foreground border-border rounded-lg">
              <SelectItem value="daily">Daily Limit</SelectItem>
              <SelectItem value="annual">Annual Limit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Results Container */}
      {showPrediction && prediction !== null && (
        <div className="mt-6 p-6 bg-muted/50 border border-border rounded-xl text-foreground">
          <p className="text-lg font-semibold">
            🔬 Predicted PM<sub>2.5</sub> Concentration: <span className="font-bold text-secondary">{scalePm25(prediction).toFixed(2)} µg/m³</span>
          </p>

          {/* Line Chart */}
          <Card className="mt-6 bg-background border-border shadow-sm rounded-xl">
            <CardHeader className="flex flex-col items-stretch border-b border-border p-6">
              <CardTitle className="text-foreground">Predicted PM2.5 vs Regulatory Thresholds</CardTitle>
              <CardDescription className="text-muted-foreground">Comparison against daily and annual limits</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ChartContainer
                config={lineChartConfig}
                className="h-[250px] w-full"
              >
                <LineChart
                  accessibilityLayer
                  data={lineChartData}
                  margin={{ left: 12, right: 12 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--color-muted)" />
                  <XAxis
                    dataKey="jurisdiction"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tick={{ fill: 'var(--color-foreground)' }}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent className="bg-background text-foreground border-border" />}
                  />
                  <Line
                    dataKey="dailyLimit"
                    type="monotone"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="annualLimit"
                    type="monotone"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="prediction"
                    type="monotone"
                    stroke="var(--color-secondary)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <ChartLegend content={<ChartLegendContent className="text-foreground" />} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Area Chart */}
          <Card className="mt-6 bg-background border-border shadow-sm rounded-xl">
            <CardHeader className="p-6">
              <CardTitle className="text-foreground">PM2.5 Prediction vs Standards</CardTitle>
              <CardDescription className="text-muted-foreground">Comparison of prediction against {comparisonType} limits</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ChartContainer config={areaChartConfig} className="h-[250px] w-full">
                <AreaChart data={areaChartData}>
                  <defs>
                    <linearGradient id="fillStandard" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillPrediction" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--color-muted)" />
                  <XAxis
                    dataKey="jurisdiction"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={16}
                    tick={{ fill: 'var(--color-foreground)' }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" className="bg-background text-foreground border-border" />}
                  />
                  <Area
                    dataKey="standard"
                    type="monotone"
                    fill="url(#fillStandard)"
                    stroke="var(--color-primary)"
                    stackId="a"
                  />
                  <Area
                    dataKey="prediction"
                    type="monotone"
                    fill="url(#fillPrediction)"
                    stroke="var(--color-secondary)"
                    stackId="a"
                  />
                  <ChartLegend content={<ChartLegendContent className="text-foreground" />} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Dispersion Trigger */}
          <Button
            type="submit"
            disabled={loadingDispersion}
            onClick={handleDispersionRun}
            className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
          >
            {loadingDispersion ? (
              <>
                <Loader className="h-4 w-4 animate-spin mr-2" />
                Running Dispersion...
              </>
            ) : (
              'Dispersion Analysis Completed'
            )}
          </Button>

          {/* Radar and Bar Charts (Side by Side) */}
          {dispersion.length > 0 && (
            <div className="mt-6 flex flex-col md:flex-row gap-4">
              {/* Radar Chart */}
              <Card className="bg-background border-border shadow-sm rounded-xl w-full md:w-1/2">
                <CardHeader className="p-6 text-center">
                  <CardTitle className="text-foreground">Directional PM2.5 Dispersion</CardTitle>
                  <CardDescription className="text-muted-foreground">PM2.5 levels by wind direction</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <ChartContainer
                    config={radarChartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <RadarChart data={radarChartData} outerRadius="80%">
                      <ChartTooltip cursor={false} content={<ChartTooltipContent className="bg-background text-foreground border-border" />} />
                      <PolarAngleAxis dataKey="direction" tick={{ fill: 'var(--color-foreground)' }} />
                      <PolarGrid stroke="var(--color-muted)" />
                      <Radar
                        dataKey="pm25"
                        fill="var(--color-accent)"
                        fillOpacity={0.6}
                        stroke="var(--color-accent)"
                      />
                    </RadarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col gap-2 text-sm p-6">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    Dispersion pattern analysis <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="text-muted-foreground">
                    Based on spatial distribution
                  </div>
                </CardFooter>
              </Card>

              {/* Bar Chart */}
              <Card className="bg-background border-border shadow-sm rounded-xl w-full md:w-1/2">
                <CardHeader className="p-6">
                  <CardTitle className="text-foreground">PM2.5 Dispersion by Distance</CardTitle>
                  <CardDescription className="text-muted-foreground">Average PM2.5 levels at various distances from center</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <ChartContainer config={barChartConfig}>
                    <BarChart accessibilityLayer data={barChartData}>
                      <CartesianGrid vertical={false} stroke="var(--color-muted)" />
                      <XAxis
                        dataKey="range"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        tick={{ fill: 'var(--color-foreground)' }}
                        tickFormatter={(value) => value}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel className="bg-background text-foreground border-border" />}
                      />
                      <Bar dataKey="pm25" fill="var(--color-primary)" radius={8} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm p-6">
                  <div className="flex gap-2 font-medium text-foreground">
                    Spatial distribution analysis <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="text-muted-foreground">
                    Based on distance from center point
                  </div>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}