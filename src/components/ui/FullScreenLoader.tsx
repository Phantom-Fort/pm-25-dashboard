// components/ui/fullscreen-loader.tsx

"use client";

import { Loader } from "lucide-react";

export default function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-500 flex flex-col items-center justify-center bg-white dark:bg-black">
      <Loader className="justify-center animate-spin text-blue-600" />
      <p className="mt-6 text-xl font-semibold text-gray-800 dark:text-white">
        Loading the dashboard...
      </p>
    </div>
  );
}
