import { Link, useParams } from "react-router-dom";
import FilterPage from "./FilterPage";
import { Input } from "./ui/input";
import { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Globe, MapPin, Search, SearchX, X } from "lucide-react";
import { Card, CardContent, CardFooter } from "./ui/card";
import { AspectRatio } from "./ui/aspect-ratio";
import { Skeleton } from "./ui/skeleton";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { Restaurant } from "@/types/restaurantType";

const SearchPage = () => {
  const params = useParams();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const {
    loading,
    searchedRestaurant,
    searchRestaurant,
    setAppliedFilter,
    appliedFilter,
    resetAppliedFilter,
  } = useRestaurantStore();

  // Track if initial search has been done
  const initialSearchDone = useRef(false);

  // Stable debounce ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger search when params.text, appliedFilter, OR searchQuery changes
  useEffect(() => {
    if (params.text) {
      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the search to avoid too many API calls
      debounceRef.current = setTimeout(() => {
       searchRestaurant(params.text ?? "", searchQuery, appliedFilter);
        initialSearchDone.current = true;
      }, 300);

      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }
  }, [params.text, appliedFilter, searchQuery, searchRestaurant]);

  // Handle search button click with immediate search
  const handleSearch = () => {
    if (params.text) {
      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      searchRestaurant(params.text, searchQuery, appliedFilter);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleRemoveFilter = (filter: string) => {
    setAppliedFilter(filter);
  };

  const handleClearAllFilters = () => {
    resetAppliedFilter();
    // Also clear search query and re-search
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          <FilterPage />
          <div className="flex-1">
            {/* Search Input */}
            <div className="flex items-center gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  value={searchQuery}
                  placeholder="Search by restaurant name, city, or cuisine..."
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-12 pl-11 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm focus-visible:ring-orange-500"
                />
                {/* Show clear button when searchQuery has text */}
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      if (params.text) {
                        searchRestaurant(params.text, "", appliedFilter);
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md shadow-orange-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching...
                  </span>
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {/* Results Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3 mb-6">
              <h1 className="font-semibold text-lg text-gray-900 dark:text-white">
                {searchedRestaurant?.data?.length || 0} Search Results Found
              </h1>

              {/* Active Filters */}
              {appliedFilter.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-gray-400 dark:text-gray-500">Filters:</span>
                  {appliedFilter.map((selectedFilter: string) => (
                    <div
                      key={selectedFilter}
                      className="relative inline-flex items-center max-w-full"
                    >
                      <Badge className="text-white bg-gradient-to-r from-orange-500 to-amber-500 border-none rounded-full hover:cursor-pointer pr-7 pl-3 py-1 whitespace-nowrap">
                        {selectedFilter}
                      </Badge>
                      <X
                        onClick={() => handleRemoveFilter(selectedFilter)}
                        size={13}
                        className="absolute text-white/90 right-2 hover:cursor-pointer hover:text-white"
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleClearAllFilters}
                    className="text-sm text-orange-500 hover:text-orange-600 font-medium underline underline-offset-2"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Restaurant Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <SearchPageSkeleton />
              ) : !loading && searchedRestaurant?.data?.length === 0 ? (
                <NoResultFound 
                  searchText={params.text || ""} 
                  searchQuery={searchQuery}
                  onClear={() => {
                    setSearchQuery("");
                    resetAppliedFilter();
                    if (params.text) {
                      searchRestaurant(params.text, "", []);
                    }
                  }}
                />
              ) : (
                searchedRestaurant?.data?.map((restaurant: Restaurant) => (
                  <Card
                    key={restaurant._id}
                    className="group bg-white dark:bg-gray-800 shadow-sm rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1 p-0"
                  >
                    <div className="relative overflow-hidden">
                      <AspectRatio ratio={16 / 9}>
                        <img
                          src={restaurant.imageUrl}
                          alt={restaurant.restaurantName}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </AspectRatio>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute top-3 left-3 bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {restaurant.estimatedDeliveryTime || restaurant.deliveryTime || 30} min
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 truncate">
                        {restaurant.restaurantName}
                      </h2>

                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                        <MapPin size={13} className="text-gray-400 shrink-0" />
                        <p className="text-sm truncate">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {restaurant.city}
                          </span>
                          , {restaurant.country}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-3">
                        <Globe size={13} className="text-gray-400 shrink-0" />
                        <p className="text-sm">
                          Delivery:{" "}
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            ₹{restaurant.deliveryPrice || 0}
                          </span>
                        </p>
                      </div>

                      {/* Show menus if available (for search by menu name) */}
                      {restaurant.menus && restaurant.menus.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Popular items:</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {restaurant.menus.slice(0, 3).map((menu: any) => (
                              <Badge
                                key={menu._id}
                                className="bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 font-medium px-2 py-0.5 rounded-full text-xs border-none"
                              >
                                {menu.name}
                              </Badge>
                            ))}
                            {restaurant.menus.length > 3 && (
                              <Badge className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full text-xs border-none">
                                +{restaurant.menus.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-1.5 flex-wrap">
                        {restaurant.cuisines.slice(0, 3).map((cuisine: string) => (
                          <Badge
                            key={cuisine}
                            className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium px-2.5 py-1 rounded-full text-xs border-none"
                          >
                            {cuisine}
                          </Badge>
                        ))}
                        {restaurant.cuisines.length > 3 && (
                          <Badge className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full text-xs border-none">
                            +{restaurant.cuisines.length - 3}
                          </Badge>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {restaurant.cuisines.length} cuisines
                      </span>
                      <Link to={`/restaurant/${restaurant._id}`}>
                        <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-sm h-9 px-4 rounded-full shadow-sm shadow-orange-500/20 transition-all">
                          View Menu
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;

// ======================= SKELETON LOADER =======================

const SearchPageSkeleton = () => {
  return (
    <>
      {[...Array(6)].map((_, index) => (
        <Card
          key={index}
          className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 p-0"
        >
          <div className="relative">
            <AspectRatio ratio={16 / 9}>
              <Skeleton className="w-full h-full" />
            </AspectRatio>
          </div>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-3/4 mb-3 rounded-lg" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Skeleton className="h-4 w-1/3 rounded" />
            </div>
            <div className="flex gap-1.5 mt-4 flex-wrap">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </CardContent>
          <CardFooter className="p-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </CardFooter>
        </Card>
      ))}
    </>
  );
};

// ======================= NO RESULTS =======================

const NoResultFound = ({ 
  searchText, 
  searchQuery,
  onClear 
}: { 
  searchText: string; 
  searchQuery: string;
  onClear: () => void;
}) => {
  return (
    <div className="col-span-full flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
      <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-5">
        <SearchX className="w-8 h-8 text-orange-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        No results found
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-2">
        We couldn't find any results for "{searchText}"
        {searchQuery && ` with "${searchQuery}"`}.
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
        Try searching with a different term, or check your spelling.
      </p>
      <div className="flex gap-3">
        <Button 
          onClick={onClear}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg shadow-md shadow-orange-500/20"
        >
          Clear Filters & Search
        </Button>
        <Link to="/">
          <Button 
            variant="outline"
            className="rounded-lg border-gray-200 dark:border-gray-600"
          >
            Go Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};