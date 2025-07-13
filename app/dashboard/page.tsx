"use client";

import { Sun, Moon, AirVent, Loader, ChevronDown, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeContext";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { storePrediction, storeDispersion } from "@/lib/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";
import PageWrapper from "@/components/ui/PageWrapper";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import dynamic from "next/dynamic";

const MapChartClient = dynamic(() => import("../components/MapChartClient"), {
  ssr: false,
  loading: () => <div className="text-center text-muted-foreground mt-4">Loading map...</div>,
});

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

interface WeatherData {
  moisture_percent?: number;
  temperature_c?: number;
  wind_speed_m_s?: number;
  wind_direction_deg?: number;
  humidity_percent?: number;
}

interface DispersionData {
  latitude: number;
  longitude: number;
  pm25: number;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  input: PredictionInput;
  prediction: number | null;
  dispersion: DispersionData[];
  uid: string | null;
}

const initialHistory: HistoryEntry[] = [];

const regionalStandards = [
  { jurisdiction: "Nigeria (NESREA)", annual: 40, daily: 60 },
  { jurisdiction: "South Africa", annual: 20, daily: 40 },
  { jurisdiction: "WHO (2021)", annual: 5, daily: 15 },
  { jurisdiction: "USA (EPA)", annual: 12, daily: 35 },
  { jurisdiction: "EU", annual: 25, daily: null },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("home");
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  const countries = {
    Nigeria: ["Ondo", "Lagos", "Abuja", "Kaduna", "Ilorin"],
    Ghana: ["Accra", "Kumasi", "Tamale"],
    SouthAfrica: ["Gauteng", "Western Cape", "KwaZulu-Natal"],
  };

  const miningFacts = useMemo(() => [
    "Blasting vibrations can cause structural damage if not properly controlled.",
    "Prolonged exposure to silica dust from quarrying can lead to silicosis, a serious lung disease.",
    "Using water sprays can reduce dust emissions by up to 80% during blasting.",
    "Excessive noise from quarry operations may cause permanent hearing loss without protection.",
    "Uncontrolled flyrock from blasting can travel over 100 meters, posing risks to workers and property.",
    "Wearing PPE (Personal Protective Equipment) is mandatory near blasting zones to prevent fatal injuries.",
    "Ground vibrations are monitored using seismographs to ensure safe blast limits.",
    "Poor blast planning can lead to overbreak and increase overall project costs.",
    "A properly designed blast reduces air overpressure and improves fragmentation.",
    "Dust particles smaller than 2.5 microns (PM2.5) can penetrate deep into lungs and cause chronic illness.",
    "Weather conditions like wind speed and humidity greatly affect PM2.5 dispersion.",
    "Flyrock incidents are one of the leading causes of blasting-related injuries worldwide.",
    "Noise levels near blasts can exceed 120 dB, which is beyond safe exposure without protection.",
    "Controlled blasting reduces environmental impacts while maximizing excavation efficiency.",
    "Overcharging a blast hole can result in ground heaving and instability.",
    "Drill accuracy directly influences the effectiveness and safety of the blast.",
    "Blast mats are used to control flyrock and dust emissions during blasting.",
    "Proper stemming in blast holes ensures energy is directed downward, improving safety and efficiency.",
    "Quarries near populated areas must strictly follow vibration and dust emission regulations.",
    "Monitoring PM2.5 emissions helps quarries stay compliant with air quality standards.",
    "Blasting isn\'t safe without proper training and equipment.", // Escaped single quote
  ], []);

  const [visibleFacts, setVisibleFacts] = useState<string[]>([]);
  const getRandomFacts = useCallback(() => {
    const shuffled = [...miningFacts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 9);
  }, [miningFacts]);

  const [formData, setFormData] = useState<PredictionInput>({
    hole_diameter_mm: "",
    hole_depth_m: "",
    spacing_m: "",
    burden_m: "",
    charge_weight_kg: "",
    rock_density_g_cm3: "",
    moisture_percent: "",
    temperature_c: "",
    wind_speed_m_s: "",
    wind_direction_deg: "",
    humidity_percent: "",
    explosive_type: "ANFO",
    rock_type: "granite",
    dust_suppression: "none",
    useApi: true,
    country: "",
    state: "",
  });
  const [prediction, setPrediction] = useState<number | null>(null);
  const [dispersion, setDispersion] = useState<DispersionData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPrediction, setShowPrediction] = useState(false);
  const [showDispersion, setShowDispersion] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [loadingDispersion, setLoadingDispersion] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);
  const [lastDispersionInput, setLastDispersionInput] = useState<{
    pm25: number;
    wind_speed: number;
    wind_dir: number;
  } | null>(null);

  const [weather, setWeather] = useState<WeatherData>({});

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setHistory(initialHistory);
      return;
    }

    try {
      const q = query(
        collection(db, "predictions"),
        where("uid", "==", user.uid),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((doc) => {
        const data = doc.data();
        let parsedInput: PredictionInput | null = null;
        try {
          parsedInput = typeof data.input === "string" ? JSON.parse(data.input) : data.input;
          if (!parsedInput || typeof parsedInput !== "object") {
            throw new Error("Invalid input format");
          }
        } catch (e) {
          console.warn(`Invalid input data for doc ${doc.id}:`, e);
          parsedInput = null;
        }

        const parsedDispersion: DispersionData[] = Array.isArray(data.dispersion) ? data.dispersion : [];
        return {
          id: doc.id,
          timestamp: data.timestamp,
          input: parsedInput,
          prediction: data.prediction ?? null,
          dispersion: parsedDispersion,
          uid: data.uid ?? null,
        };
      });
      const validDocs = docs.filter((doc): doc is HistoryEntry => doc.input !== null);
      setHistory(validDocs);
    } catch (err) {
      console.error("Error fetching Firestore data:", err);
      setHistory(initialHistory);
      toast.error("Failed to load history. Please try again.");
    }
  }, [user]);

  const columns = useMemo<ColumnDef<HistoryEntry>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="border-blue-200 dark:border-indigo-700"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="border-blue-200 dark:border-indigo-700"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "timestamp",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-blue-800 dark:text-indigo-200 hover:bg-blue-50 dark:hover:bg-indigo-900/50"
        >
          Timestamp
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-blue-800 dark:text-indigo-200">{new Date(row.getValue("timestamp")).toLocaleString()}</div>
      ),
    },
    {
      accessorKey: "prediction",
      header: "Prediction (μg/m³)",
      cell: ({ row }) => (
        <div className="text-blue-800 dark:text-indigo-200">{row.getValue("prediction") ? Number(row.getValue("prediction")).toFixed(2) : "—"}</div>
      ),
    },
    {
      id: "explosive_type",
      accessorFn: (row) => row.input?.explosive_type ?? "",
      header: "Explosive",
      cell: ({ row }) => (
        <div className="text-blue-800 dark:text-indigo-200">{row.original.input?.explosive_type ?? "—"}</div>
      ),
      filterFn: (row, id, value) => {
        const explosiveType = row.original.input?.explosive_type ?? "";
        return explosiveType.toLowerCase().includes(value.toLowerCase());
      },
    },
    {
      accessorKey: "input.useApi",
      header: "Weather Mode",
      cell: ({ row }) => (
        <div className="text-blue-800 dark:text-indigo-200">{row.original.input?.useApi ? "API" : "Manual"}</div>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-blue-800 dark:text-indigo-200 hover:bg-blue-50 dark:hover:bg-indigo-900/50 focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseOver={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 border-blue-200 dark:border-indigo-700"
              onCloseAutoFocus={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
              onMouseOver={(e) => e.stopPropagation()}
              onMouseLeave={(e) => e.stopPropagation()}
            >
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectedEntry(entry);
                }}
                className="focus:bg-blue-100 dark:focus:bg-indigo-800/50 cursor-pointer"
              >
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  navigator.clipboard.writeText(entry.id);
                  toast.success("Entry ID copied to clipboard.");
                }}
                className="focus:bg-blue-100 dark:focus:bg-indigo-800/50 cursor-pointer"
              >
                Copy Entry ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async (e) => {
                  e.preventDefault();
                  try {
                    await deleteDoc(doc(db, "predictions", entry.id));
                    toast.success("Entry deleted successfully.");
                    fetchHistory();
                  } catch (err) {
                    console.error("Error deleting entry:", err);
                    toast.error("Failed to delete entry.");
                  }
                }}
                className="focus:bg-blue-100 dark:focus:bg-indigo-800/50 cursor-pointer"
              >
                Delete Entry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [fetchHistory]);

  const table = useReactTable({
    data: history,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  useEffect(() => {
    const fetchWeather = async () => {
      if (formData.useApi && formData.country && formData.state) {
        const query = `${formData.state},${formData.country}`;
        const apiKey = "9d94c1f5db6ab53b6190bab925906b9f";
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${apiKey}&units=metric`;

        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
          const data = await response.json();

          setWeather({
            temperature_c: data.main.temp,
            wind_speed_m_s: data.wind.speed,
            wind_direction_deg: data.wind.deg,
            humidity_percent: data.main.humidity,
            moisture_percent: 1,
          });
          setError(null);
        } catch (err) {
          setError(`Failed to fetch weather data: ${err instanceof Error ? err.message : String(err)}. Using defaults.`);
          setWeather({
            temperature_c: 25,
            wind_speed_m_s: 2,
            wind_direction_deg: 180,
            humidity_percent: 60,
            moisture_percent: 5,
          });
          toast.error("Failed to fetch weather data.");
        }
      }
    };

    fetchWeather();
  }, [formData.useApi, formData.country, formData.state]);

  useEffect(() => {
    setVisibleFacts(getRandomFacts());
    const interval = setInterval(() => {
      setVisibleFacts(getRandomFacts());
    }, 10000);
    return () => clearInterval(interval);
  }, [getRandomFacts]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof PredictionInput) => (value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "country" ? { state: "" } : {}),
    }));
  };

  const handleToggleApi = () => {
    setFormData((prev) => ({
      ...prev,
      useApi: !prev.useApi,
      country: !prev.useApi ? prev.country : "",
      state: !prev.useApi ? prev.state : "",
    }));

    if (formData.useApi) {
      setWeather({
        temperature_c: 0,
        wind_speed_m_s: 0,
        wind_direction_deg: 0,
        humidity_percent: 0,
        moisture_percent: 0,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPrediction(true);
    setError(null);
    setPrediction(null);
    setShowPrediction(false);
    setDispersion([]);
    setLastDispersionInput(null);

    const moisturePercent = Number(formData.useApi ? weather.moisture_percent || 5 : formData.moisture_percent) || 0;
    if (moisturePercent > 1.9987006009444004 || moisturePercent < 0.0123676452817933) {
      setError("Moisture percent must be between 0.0124 and 1.9987");
      setLoadingPrediction(false);
      toast.error("Invalid moisture percent value.");
      return;
    }

    const timeoutId = setTimeout(() => {
      setLoadingPrediction(false);
      setError("Prediction timed out after 10 seconds.");
      toast.error("Prediction timed out.");
    }, 10000);

    const data = {
      hole_diameter_mm: Number(formData.hole_diameter_mm) || 0,
      hole_depth_m: Number(formData.hole_depth_m) || 0,
      spacing_m: Number(formData.spacing_m) || 0,
      burden_m: Number(formData.burden_m) || 0,
      charge_weight_kg: Number(formData.charge_weight_kg) || 0,
      rock_density_g_cm3: Number(formData.rock_density_g_cm3) || 0,
      moisture_percent: Number(formData.useApi ? weather.moisture_percent || 5 : formData.moisture_percent) || 0,
      temperature_c: Number(formData.useApi ? weather.temperature_c || 25 : formData.temperature_c) || 0,
      wind_speed_m_s: Number(formData.useApi ? weather.wind_speed_m_s || 2 : formData.wind_speed_m_s) || 0,
      wind_direction_deg: Number(formData.useApi ? weather.wind_direction_deg || 180 : formData.wind_direction_deg) || 0,
      humidity_percent: Number(formData.useApi ? weather.humidity_percent || 60 : formData.humidity_percent) || 0,
      explosive_type_ANFO: formData.explosive_type === "ANFO" ? 1 : 0,
      explosive_type_emulsion: formData.explosive_type === "emulsion" ? 1 : 0,
      rock_type_granite: formData.rock_type === "granite" ? 1 : 0,
      rock_type_limestone: formData.rock_type === "limestone" ? 1 : 0,
      rock_type_sandstone: formData.rock_type === "sandstone" ? 1 : 0,
      dust_suppression_none: formData.dust_suppression === "none" ? 1 : 0,
      dust_suppression_water_spray: formData.dust_suppression === "water_spray" ? 1 : 0,
      dust_suppression_chemical: formData.dust_suppression === "chemical" ? 1 : 0,
    };

    try {

    const response = await fetch("https://pm25-predictor.onrender.com/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: data }),
    });

      if (!response.ok) throw new Error(`Prediction API error: ${response.status}`);
      const result = await response.json();
      clearTimeout(timeoutId);

      toast.success("Prediction successful!");
      setPrediction(result.pm25 || null);

      await storePrediction({
        input: formData,
        prediction: result.pm25,
        dispersion: [],
        uid: user?.uid || null,
      });
      setShowPrediction(true);

      setLastDispersionInput({
        pm25: result.pm25,
        wind_speed: data.wind_speed_m_s,
        wind_dir: data.wind_direction_deg,
      });
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}. Check server status.`);
      setPrediction(null);
      toast.error("Prediction failed.");
    } finally {
      setLoadingPrediction(false);
    }
  };

  const handleDispersionRun = async () => {
    if (!lastDispersionInput) return;

    const timeoutId = setTimeout(() => {
      setLoadingDispersion(false);
      setError("Dispersion timed out after 10 seconds.");
      toast.error("Dispersion timed out.");
    }, 10000);

    try {
      setError(null);
      setLoadingDispersion(true);

      const response = await fetch("/api/aermod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastDispersionInput),
      });

      if (!response.ok) throw new Error(`AERMOD API error: ${response.status}`);
      const result = await response.json();
      clearTimeout(timeoutId);

      toast.success("Dispersion completed!");
      setDispersion(result.dispersion || []);

      await storeDispersion({
        dispersion: result.dispersion || [],
        metadata: lastDispersionInput,
        uid: user?.uid || null,
      });

      setShowDispersion(true);
    } catch (err) {
      setError(`Dispersion error: ${err instanceof Error ? err.message : String(err)}`);
      setDispersion([]);
      toast.error("Dispersion failed.");
    } finally {
      setLoadingDispersion(false);
    }
  };

  const [currentTime, setCurrentTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos", hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, user]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
    } else if (!user.displayName) {
      router.push("/profile");
    }
  }, [user, loading, router]);

  if (loading || !user) return <FullScreenLoader />;

  return (
    <PageWrapper>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 dark:bg-gray-900 text-blue-800 dark:text-indigo-200">
          <div className="lg:fixed lg:top-0 lg:left-0 lg:h-screen w-full lg:w-1/6 bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 shadow-md flex flex-col">
            <div className="p-6 border-b border-blue-200 dark:border-indigo-700">
              <div className="flex items-center space-x-2">
                <AirVent className="w-8 h-8 text-blue-500 dark:text-indigo-500" />
                <h1 className="text-2xl font-bold tracking-tight text-blue-800 dark:text-indigo-200">
                  PM<sub className="text-base">2.5</sub> Dashboard
                </h1>
              </div>
              <p className="mt-1 text-xs text-blue-600 dark:text-indigo-300">{currentTime} (Africa/Lagos)</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <TabsList className="flex flex-col space-y-2 bg-blue-50 dark:bg-indigo-900/50 justify-start" aria-label="Navigation Tabs">
                {[
                  { value: "home", label: "Home", tooltip: "Dashboard overview." },
                  { value: "predict", label: "Predict", tooltip: "Enter data to predict." },
                  { value: "dispersion", label: "Dispersion", tooltip: "View dispersion results." },
                  { value: "characterize", label: "Characterize", tooltip: "Source characterization and assessments" },
                  { value: "recommendations", label: "Recommendations", tooltip: "Mitigation recommendations." },
                  { value: "results", label: "Results", tooltip: "View results." },
                ].map(({ value, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="justify-start w-full bg-blue-50 dark:bg-indigo-900/50 hover:bg-blue-100 dark:hover:bg-indigo-800/50 text-blue-800 dark:text-indigo-200 p-2 rounded-2xl data-[state=active]:bg-blue-500 dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="p-4 border-t border-blue-200 dark:border-indigo-700 text-sm text-blue-800 dark:text-indigo-200">
              <p className="font-semibold">Current User: {user?.displayName || "User"}</p>
              <p className="truncate">{user?.email || "Not Available"}</p>
              <Button
                variant="outline"
                className="mt-2 w-full border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50 flex items-center justify-center"
                onClick={() => router.push("/profile")}
              >
                Profile
              </Button>
              <Button
                variant="outline"
                className="mt-2 w-full border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50 flex items-center justify-center"
                onClick={toggleTheme}
              >
                {theme === "light" ? (
                  <>
                    <Moon className="w-4 h-4 mr-2" />
                    Dark Mode
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 mr-2" />
                    Light Mode
                  </>
                )}
              </Button>
            </div>

            <div className="p-4 border-t border-blue-200 dark:border-indigo-700 text-center text-xs text-blue-600 dark:text-indigo-300">
              © {new Date().getFullYear()} Phantom Labs
            </div>
          </div>

          <div className="lg:ml-[16.666%] w-full lg:w-5/6 flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900 text-blue-800 dark:text-indigo-200">
            <TabsContent value="home">
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 text-white dark:text-white p-6 rounded-2xl shadow-md">
                  <h2 className="text-4xl font-bold mb-2">Welcome to the PM2.5 Prediction Dashboard</h2>
                  <p className="text-md">
                    Your companion for predicting and analyzing quarry PM2.5 emissions using environmental data and smart modeling.
                  </p>
                  <br />
                  <br />
                  <p className="text-md">
                  Olotu Opeyemi Masters Thesis Project...                  
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700">
                    <h3 className="text-2xl flex items-center font-semibold text-blue-800 dark:text-indigo-200 mb-2">🎯 Purpose</h3>
                    <p className="text-md text-blue-600 dark:text-indigo-300">
                      This tool predicts PM2.5 emissions and visualizes dispersion using AERMOD modeling based on quarry-specific environmental and blasting inputs.
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700">
                    <h3 className="text-2xl flex items-center font-semibold text-blue-800 dark:text-indigo-200 mb-2">🛠️ How to Use</h3>
                    <p className="text-md text-blue-600 dark:text-indigo-300">
                      Navigate to the Predict<b/> tab, enter blasting data with an option to fetch weather data, and submit for results. You will see PM2.5 predictions and spatial dispersion.
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700">
                    <h3 className="text-2xl font-semibold text-blue-800 dark:text-indigo-200 mb-2">📈 Features</h3>
                    <ul className="list-disc list-inside text-md text-blue-600 dark:text-indigo-300">
                      <li>Live weather API integration</li>
                      <li>Multiple regional compliance standards</li>
                      <li>Dynamic dispersion maps</li>
                      <li>Real-time result visualization</li>
                      <li>Source characterization and history tracking</li>
                      <li>Mitigation recommendations</li>
                    </ul>
                  </div>
                </div>

                <div className="text-center mt-6">
                  <p className="text-blue-600 dark:text-indigo-300 mb-2">Ready to get started?</p>
                  <Button
                    className="bg-blue-500 dark:bg-indigo-600 text-white dark:text-white hover:bg-blue-600 dark:hover:bg-indigo-700 font-semibold px-6 py-2 rounded-2xl shadow-md transition duration-300 w-full md:w-auto"
                    onClick={() => setActiveTab("predict")}
                  >
                    Go to Prediction →
                  </Button>
                </div>

                <div className="bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 p-6 rounded-2xl shadow-md w-full flex items-center justify-center flex-col space-y-4 border border-blue-200 dark:border-indigo-700">
                  <h3 className="text-4xl font-bold mb-2">🧠 Did You Know?</h3>
                  <ul className="list-disc list-inside text-blue-600 dark:text-indigo-300 space-y-2 text-lg">
                    {visibleFacts.map((fact, idx) => (
                      <li key={idx} className="transition-opacity duration-1000 ease-in-out">
                        {fact.replace(/"/g, '&quot;').replace(/'/g, '&apos;')}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="predict">
              <div className="space-y-8">
                <div className="bg-blue-50 dark:bg-indigo-900/50 border-l-4 border-blue-500 dark:border-indigo-500 p-4 rounded-xl shadow-sm">
                  <h2 className="text-2xl font-semibold text-blue-700 dark:text-indigo-300">📊 PM2.5 Prediction</h2>
                  <p className="text-sm text-blue-600 dark:text-indigo-300 mt-1">
                    Enter quarry blasting parameters and environmental data to predict PM2.5 emissions.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200">🌍 Location</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Country</label>
                        <Select
                          value={formData.country}
                          onValueChange={handleSelectChange("country")}
                          disabled={!formData.useApi}
                        >
                          <SelectTrigger className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200">
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 border-blue-200 dark:border-indigo-700">
                            {Object.keys(countries).map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">State</label>
                        <Select
                          value={formData.state}
                          onValueChange={handleSelectChange("state")}
                          disabled={!formData.useApi || !formData.country}
                        >
                          <SelectTrigger className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200">
                            <SelectValue placeholder="Select a state" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 border-blue-200 dark:border-indigo-700">
                            {formData.country &&
                              countries[formData.country as keyof typeof countries]?.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="useApi"
                        checked={formData.useApi}
                        onCheckedChange={handleToggleApi}
                        className="border-blue-200 dark:border-indigo-700"
                      />
                      <label htmlFor="useApi" className="text-sm text-blue-800 dark:text-indigo-200">
                        Use Weather API
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200">💥 Blasting Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Hole Diameter (mm)</label>
                        <Input
                          type="number"
                          name="hole_diameter_mm"
                          value={formData.hole_diameter_mm}
                          onChange={handleChange}
                          placeholder="e.g., 100"
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Hole Depth (m)</label>
                        <Input
                          type="number"
                          name="hole_depth_m"
                          value={formData.hole_depth_m}
                          onChange={handleChange}
                          placeholder="e.g., 10"
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Spacing (m)</label>
                        <Input
                          type="number"
                          name="spacing_m"
                          value={formData.spacing_m}
                          onChange={handleChange}
                          placeholder="e.g., 3"
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Burden (m)</label>
                        <Input
                          type="number"
                          name="burden_m"
                          value={formData.burden_m}
                          onChange={handleChange}
                          placeholder="e.g., 2"
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Charge Weight (kg)</label>
                        <Input
                          type="number"
                          name="charge_weight_kg"
                          value={formData.charge_weight_kg}
                          onChange={handleChange}
                          placeholder="e.g., 50"
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Rock Density (g/cm³)</label>
                        <Input
                          type="number"
                          name="rock_density_g_cm3"
                          value={formData.rock_density_g_cm3}
                          onChange={handleChange}
                          placeholder="e.g., 2.7"
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200">🌦️ Environmental Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Moisture (%)</label>
                        <Input
                          type="number"
                          name="moisture_percent"
                          value={formData.useApi ? weather.moisture_percent || "" : formData.moisture_percent}
                          onChange={handleChange}
                          placeholder="e.g., 5"
                          disabled={formData.useApi}
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Temperature (°C)</label>
                        <Input
                          type="number"
                          name="temperature_c"
                          value={formData.useApi ? weather.temperature_c || "" : formData.temperature_c}
                          onChange={handleChange}
                          placeholder="e.g., 25"
                          disabled={formData.useApi}
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Wind Speed (m/s)</label>
                        <Input
                          type="number"
                          name="wind_speed_m_s"
                          value={formData.useApi ? weather.wind_speed_m_s || "" : formData.wind_speed_m_s}
                          onChange={handleChange}
                          placeholder="e.g., 2"
                          disabled={formData.useApi}
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Wind Direction (deg)</label>
                        <Input
                          type="number"
                          name="wind_direction_deg"
                          value={formData.useApi ? weather.wind_direction_deg || "" : formData.wind_direction_deg}
                          onChange={handleChange}
                          placeholder="e.g., 180"
                          disabled={formData.useApi}
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Humidity (%)</label>
                        <Input
                          type="number"
                          name="humidity_percent"
                          value={formData.useApi ? weather.humidity_percent || "" : formData.humidity_percent}
                          onChange={handleChange}
                          placeholder="e.g., 60"
                          disabled={formData.useApi}
                          required
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200">⚙️ Additional Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Explosive Type</label>
                        <Select value={formData.explosive_type} onValueChange={handleSelectChange("explosive_type")}>
                          <SelectTrigger className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200">
                            <SelectValue placeholder="Select explosive type" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 border-blue-200 dark:border-indigo-700">
                            <SelectItem value="ANFO">ANFO</SelectItem>
                            <SelectItem value="emulsion">Emulsion</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Rock Type</label>
                        <Select value={formData.rock_type} onValueChange={handleSelectChange("rock_type")}>
                          <SelectTrigger className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200">
                            <SelectValue placeholder="Select rock type" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 border-blue-200 dark:border-indigo-700">
                            <SelectItem value="granite">Granite</SelectItem>
                            <SelectItem value="limestone">Limestone</SelectItem>
                            <SelectItem value="sandstone">Sandstone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-indigo-200">Dust Suppression</label>
                        <Select value={formData.dust_suppression} onValueChange={handleSelectChange("dust_suppression")}>
                          <SelectTrigger className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200">
                            <SelectValue placeholder="Select dust suppression" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 border-blue-200 dark:border-indigo-700">
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="water_spray">Water Spray</SelectItem>
                            <SelectItem value="chemical">Chemical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-blue-500 dark:bg-indigo-600 text-white dark:text-white hover:bg-blue-600 dark:hover:bg-indigo-700"
                    disabled={loadingPrediction}
                  >
                    {loadingPrediction ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Predicting...
                      </>
                    ) : (
                      "Predict PM2.5"
                    )}
                  </Button>
                </form>

                {showPrediction && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700">
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200 mb-4">📈 Prediction Results</h3>
                    {prediction !== null ? (
                      <div className="space-y-4">
                        <p className="text-2xl text-blue-800 dark:text-indigo-200">
                          Predicted PM2.5: <span className="font-bold">{prediction.toFixed(2)}</span> μg/m³
                        </p>
                        <Button
                          onClick={handleDispersionRun}
                          className="bg-blue-500 dark:bg-indigo-600 text-white dark:text-white hover:bg-blue-600 dark:hover:bg-indigo-700"
                          disabled={loadingDispersion || !lastDispersionInput}
                        >
                          {loadingDispersion ? (
                            <>
                              <Loader className="mr-2 h-4 w-4 animate-spin" />
                              Calculating Dispersion...
                            </>
                          ) : (
                            "Calculate Dispersion"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-blue-600 dark:text-indigo-300 italic">No prediction available.</p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="dispersion">
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-indigo-900/50 border-l-4 border-blue-500 dark:border-indigo-500 p-4 rounded-xl shadow-sm">
                  <h2 className="text-2xl font-semibold text-blue-700 dark:text-indigo-300">🗺️ Dispersion Modeling</h2>
                  <p className="text-sm text-blue-600 dark:text-indigo-300 mt-1">
                    Visualize the spatial distribution of PM2.5 emissions based on your prediction and environmental conditions.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700 space-y-4">
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200">🌬️ AERMOD Dispersion</h3>
                  {prediction !== null ? (
                    <Button
                      onClick={handleDispersionRun}
                      className="bg-blue-500 dark:bg-indigo-600 text-white dark:text-white hover:bg-blue-600 dark:hover:bg-indigo-700"
                      disabled={loadingDispersion || !lastDispersionInput}
                    >
                      {loadingDispersion ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        "Run Dispersion Model"
                      )}
                    </Button>
                  ) : (
                    <p className="text-sm text-blue-600 dark:text-indigo-300 italic">
                      Run a prediction first to enable dispersion modeling.
                    </p>
                  )}
                </div>

                {showDispersion && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700">
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200 mb-4">📍 Dispersion Results</h3>
                    <MapChartClient
                      showPrediction={showPrediction}
                      prediction={prediction}
                      dispersion={dispersion}
                      regionalStandards={regionalStandards}
                      loadingDispersion={loadingDispersion}
                      handleDispersionRun={handleDispersionRun}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="characterize">
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-indigo-900/50 border-l-4 border-blue-500 dark:border-indigo-500 p-4 rounded-xl shadow-sm">
                  <h2 className="text-2xl font-semibold text-blue-700 dark:text-indigo-300">🧪 Source Characterization</h2>
                  <p className="text-sm text-blue-600 dark:text-indigo-300 mt-1">
                    Compare predicted PM2.5 levels against regional air quality standards.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700 space-y-4">
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200">📊 Standards Comparison</h3>
                  {prediction !== null ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50 dark:bg-indigo-900/50">
                          <TableHead className="text-blue-800 dark:text-indigo-200">Jurisdiction</TableHead>
                          <TableHead className="text-blue-800 dark:text-indigo-200">Annual Limit (μg/m³)</TableHead>
                          <TableHead className="text-blue-800 dark:text-indigo-200">Daily Limit (μg/m³)</TableHead>
                          <TableHead className="text-blue-800 dark:text-indigo-200">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regionalStandards.map((standard, idx) => (
                          <TableRow key={idx} className="hover:bg-blue-50 dark:hover:bg-indigo-900/50">
                            <TableCell className="text-blue-800 dark:text-indigo-200">{standard.jurisdiction}</TableCell>
                            <TableCell className="text-blue-800 dark:text-indigo-200">{standard.annual}</TableCell>
                            <TableCell className="text-blue-800 dark:text-indigo-200">{standard.daily ?? "—"}</TableCell>
                            <TableCell>
                              {prediction > (standard.daily ?? standard.annual) ? (
                                <span className="text-red-600 dark:text-red-400 font-medium">❌ Exceeds</span>
                              ) : (
                                <span className="text-green-600 dark:text-green-400 font-medium">✅ Within Limit</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-blue-600 dark:text-indigo-300 italic">Run a prediction to see standards comparison.</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recommendations">
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-indigo-900/50 border-l-4 border-blue-500 dark:border-indigo-500 p-4 rounded-xl shadow-sm">
                  <h2 className="text-2xl font-semibold text-blue-700 dark:text-indigo-300">📢 Mitigation Recommendations</h2>
                  <p className="text-sm text-blue-600 dark:text-indigo-300 mt-1">
                    Suggested actions to reduce PM2.5 emissions based on your prediction.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700 space-y-4">
                  {prediction !== null ? (
                    <div className="space-y-6">
                      <div className="p-4 bg-blue-50 dark:bg-indigo-900/50 border-l-4 border-blue-500 dark:border-indigo-500 rounded-2xl">
                        <h3 className="font-semibold text-blue-700 dark:text-indigo-300">📋 Compliance Status</h3>
                        <ul className="list-disc list-inside text-sm text-blue-600 dark:text-indigo-300 mt-1">
                          {regionalStandards.map((region) => (
                            <li key={region.jurisdiction}>
                              {region.jurisdiction}:{" "}
                              {prediction > (region.daily || 0) ? (
                                <span className="text-red-600 dark:text-red-400 font-semibold">Non-Compliant</span>
                              ) : (
                                <span className="text-green-600 dark:text-green-400 font-semibold">Compliant</span>
                              )}{" "}
                              (Limit: {region.daily || "N/A"} μg/m³)
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/50 border-l-4 border-green-600 dark:border-green-600 rounded-2xl">
                        <h3 className="font-semibold text-green-700 dark:text-green-300">✅ Recommended Mitigations</h3>
                        <ul className="list-disc list-inside text-sm text-blue-600 dark:text-indigo-300 mt-1">
                          <li>Switch to low-emission explosives like emulsion-based compounds.</li>
                          <li>Apply water spray or chemical dust suppressants during and after blasting.</li>
                          <li>Schedule blasting operations when wind is low and blowing away from population zones.</li>
                          <li>Use blast mats or coverings to reduce airborne particulate escape.</li>
                          <li>Improve haul road surfacing and truck loading practices to limit dust agitation.</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/50 border-l-4 border-orange-500 dark:border-orange-500 rounded-2xl">
                        <h3 className="font-semibold text-orange-700 dark:text-orange-300">⚙️ Operational Adjustments</h3>
                        <ul className="list-disc list-inside text-sm text-blue-600 dark:text-indigo-300 mt-1">
                          <li>Train staff on low-dust explosive charging techniques.</li>
                          <li>Use real-time meteorological sensors to time operations more effectively.</li>
                          <li>Install perimeter air quality sensors for compliance tracking and alerts.</li>
                          <li>Log all blast activities and emissions for future audits and forecasting.</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-blue-600 dark:text-indigo-300 italic">Run a prediction to generate recommendations.</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="results">
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-indigo-900/50 border-l-4 border-blue-500 dark:border-indigo-500 p-4 rounded-xl shadow-sm">
                  <h2 className="text-2xl font-semibold text-blue-700 dark:text-indigo-300">📑 Report & Historical Results</h2>
                  <p className="text-sm text-blue-600 dark:text-indigo-300 mt-1">
                    View all saved predictions, input parameters, and dispersion data stored in Firebase.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-md border border-blue-200 dark:border-indigo-700 space-y-4">
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200">🕒 Historical Logs</h3>
                  <div className="w-full">
                    <div className="flex items-center py-4">
                      <Input
                        placeholder="Filter by explosive type..."
                        value={(table.getColumn("explosive_type")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                          table.getColumn("explosive_type")?.setFilterValue(event.target.value)
                        }
                        className="max-w-sm border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="ml-auto border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50">
                            Columns <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 border-blue-200 dark:border-indigo-700">
                          {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => (
                              <DropdownMenuCheckboxItem
                                key={column.id}
                                className="capitalize text-blue-800 dark:text-indigo-200"
                                checked={column.getIsVisible()}
                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                              >
                                {column.id}
                              </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="rounded-md border border-blue-200 dark:border-indigo-700">
                      <Table>
                        <TableHeader>
                          {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-blue-50 dark:bg-indigo-900/50">
                              {headerGroup.headers.map((header) => (
                                <TableHead key={header.id} className="text-blue-800 dark:text-indigo-200">
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                              ))}
                            </TableRow>
                          ))}
                        </TableHeader>
                        <TableBody>
                          {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                              <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                                className="hover:bg-blue-50 dark:hover:bg-indigo-900/50"
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <TableCell key={cell.id} className="text-blue-800 dark:text-indigo-200">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={columns.length} className="h-24 text-center text-blue-600 dark:text-indigo-300">
                                No results.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-end space-x-2 py-4">
                      <div className="text-blue-600 dark:text-indigo-300 flex-1 text-sm">
                        {table.getFilteredSelectedRowModel().rows.length} of{" "}
                        {table.getFilteredRowModel().rows.length} row(s) selected.
                      </div>
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => table.previousPage()}
                          disabled={!table.getCanPreviousPage()}
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => table.nextPage()}
                          disabled={!table.getCanNextPage()}
                          className="border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-blue-600 dark:text-indigo-300 text-center pt-6">
                  Data retrieved from secure Firestore instance. All rights reserved.
                </div>
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {selectedEntry && (
        <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 border-blue-200 dark:border-indigo-700">
            <DialogHeader>
              <DialogTitle className="text-blue-800 dark:text-indigo-200">Prediction Details</DialogTitle>
            </DialogHeader>
            {selectedEntry.input ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200 mb-2">📋 Input Parameters</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(selectedEntry.input).map(([key, value], idx) => (
                        <TableRow key={idx} className="hover:bg-blue-50 dark:hover:bg-indigo-900/50">
                          <TableCell className="font-medium text-blue-800 dark:text-indigo-200">
                            {key
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </TableCell>
                          <TableCell className="text-blue-800 dark:text-indigo-200">{value?.toString() ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200 mb-2">📊 Prediction</h3>
                  <p className="text-sm text-blue-600 dark:text-indigo-300">
                    PM2.5: {selectedEntry.prediction ? `${selectedEntry.prediction.toFixed(2)} μg/m³` : "Not available"}
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200 mb-2">🗺️ Dispersion Data</h3>
                  {selectedEntry.dispersion && selectedEntry.dispersion.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50 dark:bg-indigo-900/50">
                          <TableHead className="text-blue-800 dark:text-indigo-200">Latitude</TableHead>
                          <TableHead className="text-blue-800 dark:text-indigo-200">Longitude</TableHead>
                          <TableHead className="text-blue-800 dark:text-indigo-200">PM2.5 (μg/m³)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedEntry.dispersion.map((point, idx) => (
                          <TableRow key={idx} className="hover:bg-blue-50 dark:hover:bg-indigo-900/50">
                            <TableCell className="text-blue-800 dark:text-indigo-200">{point.latitude.toFixed(5)}</TableCell>
                            <TableCell className="text-blue-800 dark:text-indigo-200">{point.longitude.toFixed(5)}</TableCell>
                            <TableCell className="text-blue-800 dark:text-indigo-200">{point.pm25.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-blue-600 dark:text-indigo-300 italic">No dispersion data available.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200 mb-2">📈 Dispersion Map</h3>
                  <MapChartClient
                    showPrediction={false}
                    prediction={null}
                    dispersion={selectedEntry.dispersion ?? []}
                    regionalStandards={[]}
                    loadingDispersion={false}
                    handleDispersionRun={() => {}}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200 mb-2">🧪 Standards Comparison</h3>
                  {selectedEntry.prediction !== null ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50 dark:bg-indigo-900/50">
                          <TableHead className="text-blue-800 dark:text-indigo-200">Jurisdiction</TableHead>
                          <TableHead className="text-blue-800 dark:text-indigo-200">Annual Limit (μg/m³)</TableHead>
                          <TableHead className="text-blue-800 dark:text-indigo-200">Daily Limit (μg/m³)</TableHead>
                          <TableHead className="text-blue-800 dark:text-indigo-200">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regionalStandards.map((standard, idx) => (
                          <TableRow key={idx} className="hover:bg-blue-50 dark:hover:bg-indigo-900/50">
                            <TableCell className="text-blue-800 dark:text-indigo-200">{standard.jurisdiction}</TableCell>
                            <TableCell className="text-blue-800 dark:text-indigo-200">{standard.annual}</TableCell>
                            <TableCell className="text-blue-800 dark:text-indigo-200">{standard.daily ?? "—"}</TableCell>
                            <TableCell>
                              {selectedEntry.prediction! > (standard.daily ?? standard.annual) ? (
                                <span className="text-red-600 dark:text-red-400 font-medium">❌ Exceeds</span>
                              ) : (
                                <span className="text-green-600 dark:text-green-400 font-medium">✅ Within Limit</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-blue-600 dark:text-indigo-300 italic">No prediction data available.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-indigo-200 mb-2">📢 Recommendations</h3>
                  {selectedEntry.prediction !== null ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 dark:bg-indigo-900/50 border-l-4 border-blue-500 dark:border-indigo-500 rounded-2xl">
                        <h4 className="font-semibold text-blue-700 dark:text-indigo-300">📋 Compliance Status</h4>
                        <ul className="list-disc list-inside text-sm text-blue-600 dark:text-indigo-300 mt-1">
                          {regionalStandards.map((region) => (
                            <li key={region.jurisdiction}>
                              {region.jurisdiction}:{" "}
                              {selectedEntry.prediction! > (region.daily || 0) ? (
                                <span className="font-semibold text-red-600 dark:text-red-400">Non-Compliant</span>
                              ) : (
                                <span className="font-semibold text-green-600 dark:text-green-400">Compliant</span>
                              )}{" "}
                              (Limit: {region.daily || "N/A"} μg/m³)
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/50 border-l-4 border-green-600 dark:border-green-600 rounded-2xl">
                        <h4 className="font-semibold text-green-700 dark:text-green-300">✅ Recommended Mitigations</h4>
                        <ul className="list-disc list-inside text-sm text-blue-600 dark:text-indigo-300 mt-1">
                          <li>Switch to low-emission explosives like emulsion-based compounds.</li>
                          <li>Apply water spray or chemical dust suppressants during and after blasting.</li>
                          <li>Schedule blasting operations when wind is low and blowing away from population zones.</li>
                          <li>Use blast mats or coverings to reduce airborne particulate escape.</li>
                          <li>Improve haul road surfacing and truck loading practices to limit dust agitation.</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/50 border-l-4 border-orange-500 dark:border-orange-500 rounded-2xl">
                        <h4 className="font-semibold text-orange-700 dark:text-orange-300">⚙️ Operational Adjustments</h4>
                        <ul className="list-disc list-inside text-sm text-blue-600 dark:text-indigo-300 mt-1">
                          <li>Train staff on low-dust explosive charging techniques.</li>
                          <li>Use real-time meteorological sensors to time operations more effectively.</li>
                          <li>Install perimeter air quality sensors for compliance tracking and alerts.</li>
                          <li>Log all blast activities and emissions for future audits and forecasting.</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-blue-600 dark:text-indigo-300 italic">Run a prediction to generate recommendations.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-blue-600 dark:text-indigo-300 italic">No input data available for this entry.</p>
            )}
            <DialogFooter>
              <Button
                onClick={() => {
                  if (selectedEntry.input) {
                    setFormData(selectedEntry.input);
                    setPrediction(selectedEntry.prediction ?? null);
                    setDispersion(selectedEntry.dispersion ?? []);
                    toast.success("Loaded entry to form.");
                  } else {
                    toast.error("Cannot load: Invalid input data.");
                  }
                }}
                className="bg-blue-500 dark:bg-indigo-600 text-white dark:text-white hover:bg-blue-600 dark:hover:bg-indigo-700"
              >
                Load to Form
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageWrapper>
  );
}
