"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth/AuthContext";
import { LogOut, Menu, X, AirVent, Moon, Sun, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import Link from "next/link";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (!user.displayName) {
      router.push("/profile");
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Signed out successfully.");
      router.push("/login");
    } finally {}
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const isDashboard = pathname === "/dashboard";

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 dark:border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
  <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 text-blue-800 dark:text-indigo-200">
    {/* Sidebar (if not on dashboard) */}
    {!isDashboard && (
      <aside
        className={`z-50 h-screen w-64 lg:w-1/6 bg-white dark:bg-gray-800 text-blue-800 dark:text-indigo-200 shadow-md flex flex-col transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:static`}
      >
          <div className="p-6 border-b border-blue-200 dark:border-indigo-700">
            <div className="flex items-center space-x-2">
              <AirVent className="w-8 h-8 text-blue-500 dark:text-indigo-500" />
              <h1 className="text-2xl font-bold tracking-tight text-blue-800 dark:text-indigo-200">
                PM<sub className="text-base">2.5</sub> Dashboard
              </h1>
            </div>
            <p className="mt-1 text-xs text-blue-600 dark:text-indigo-300">{currentTime} (Africa/Lagos)</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center space-x-2 p-2 rounded-2xl text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50 bg-blue-50 dark:bg-indigo-900/50"
              onClick={() => setIsSidebarOpen(false)}
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/profile"
              className="flex items-center space-x-2 p-2 rounded-2xl text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50 bg-blue-50 dark:bg-indigo-900/50"
              onClick={() => setIsSidebarOpen(false)}
            >
              <span>Profile</span>
            </Link>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full flex items-center justify-start space-x-2 p-2 rounded-2xl text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50 bg-blue-50 dark:bg-indigo-900/50"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </Button>
          </nav>

          <div className="p-4 border-t border-blue-200 dark:border-indigo-700 text-sm text-blue-800 dark:text-indigo-200">
            <p className="font-semibold">Current User: {user?.displayName || "User"}</p>
            <p className="truncate">{user?.email || "Not Available"}</p>
            <Button
              variant="outline"
              className="mt-2 w-full border-blue-200 dark:border-indigo-700 text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50 flex items-center justify-center"
              onClick={() => {
                router.push("/profile");
                setIsSidebarOpen(false);
              }}
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
        </aside>
      )}

      {/* Mobile Sidebar Toggle (if not on dashboard) */}
    {!isDashboard && (
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-blue-800 dark:text-indigo-200 hover:bg-blue-100 dark:hover:bg-indigo-800/50"
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>
    )}

    {/* Main content */}
    <main className="flex-1 w-full p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {children}
    </main>

    {/* Overlay for mobile sidebar */}
    {!isDashboard && isSidebarOpen && (
      <div
        className="fixed inset-0 bg-black/50 md:hidden z-40"
        onClick={toggleSidebar}
      />
    )}
  </div>
);
}

