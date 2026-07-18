import { UtensilsCrossed } from "lucide-react";

const Loading = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 flex items-center justify-center relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-orange-200/40 dark:bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 bg-amber-200/40 dark:bg-amber-500/10 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Spinner ring with icon */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full border-4 border-orange-100 dark:border-gray-800" />
          <div className="absolute h-24 w-24 rounded-full border-4 border-transparent border-t-orange-500 border-r-amber-500 animate-spin" />
          <div className="h-14 w-14 rounded-full bg-white dark:bg-gray-800 shadow-lg shadow-orange-500/20 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-orange-500" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            Getting things ready
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Just a moment...
          </p>
        </div>
      </div>
    </div>
  );
};

export default Loading;