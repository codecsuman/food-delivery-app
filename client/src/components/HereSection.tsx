import { useState } from "react";
import { Input } from "./ui/input";
import { Search, Sparkles, Star, Clock3, Compass } from "lucide-react";
import { Button } from "./ui/button";
import HereImage from "@/assets/hero_pizza.png";
import { useNavigate } from "react-router-dom";

const HereSection = () => {
  const [searchText, setSearchText] = useState<string>("");
  const navigate = useNavigate();

  const handleSearch = () => {
    if (searchText.trim()) {
      navigate(`/search/${encodeURIComponent(searchText.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-orange-50/70 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-orange-200/40 dark:bg-orange-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 bg-amber-200/30 dark:bg-amber-500/10 rounded-full blur-3xl" />

      <div className="relative min-h-[80vh] flex flex-col md:flex-row max-w-7xl mx-auto px-4 md:px-10 py-10 md:py-20 items-center justify-center gap-10 md:gap-20">
        <div className="flex flex-col gap-8 md:w-[45%] w-full">
          <div className="flex flex-col gap-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              Fresh food, fast delivery
            </div>
            <h1 className="font-extrabold text-4xl md:text-5xl lg:text-6xl text-gray-900 dark:text-white leading-tight tracking-tight">
              Order Food{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                Anytime
              </span>{" "}
              & Anywhere
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Hey! Our delicious food is waiting for you. We are always near to you.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={searchText}
                placeholder="Search restaurant by name, city & country"
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-12 h-14 text-lg rounded-xl shadow-lg shadow-orange-500/5 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus-visible:ring-orange-500"
              />
              <Search className="text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!searchText.trim()}
              className="h-14 px-8 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-lg shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:shadow-none"
            >
              Search
            </Button>
            {/* Browse All Restaurants button */}
            <Button
              onClick={() => navigate("/search")}
              variant="outline"
              className="h-14 px-5 rounded-xl border-gray-200 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 transition-all"
              title="Browse all restaurants"
            >
              <Compass className="w-5 h-5" />
            </Button>
          </div>

          {/* Popular Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Popular:</span>
            {["Pizza", "Burger", "Biryani", "Momos", "Rolls"].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSearchText(tag);
                  navigate(`/search/${encodeURIComponent(tag)}`);
                }}
                className="text-sm px-3.5 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200 dark:hover:border-orange-500/30 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">4.8/5</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Customer rating</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <Clock3 className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">30 min</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Avg. delivery</p>
              </div>
            </div>
          </div>
        </div>

        <div className="md:w-[50%] w-full flex items-center justify-center relative">
          <div className="absolute w-72 h-72 bg-gradient-to-br from-orange-300/40 to-amber-300/30 dark:from-orange-500/10 dark:to-amber-500/10 rounded-full blur-2xl" />
          <img src={HereImage} alt="Delicious food" className="relative object-contain w-full max-h-[500px] rounded-2xl drop-shadow-2xl" />
        </div>
      </div>
    </div>
  );
};

export default HereSection;