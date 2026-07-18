import { useRestaurantStore } from "@/store/useRestaurantStore";
import AvailableMenu from "./AvailableMenu";
import { Badge } from "./ui/badge";
import { Timer, MapPin, Globe, Star, UtensilsCrossed } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Skeleton } from "./ui/skeleton";

const RestaurantDetail = () => {
  const params = useParams();
  const { singleRestaurant, getSingleRestaurant, loading } = useRestaurantStore();

  useEffect(() => {
    if (params.id) {
      getSingleRestaurant(params.id);
    }
  }, [params.id, getSingleRestaurant]);

  if (loading || !singleRestaurant) {
    return <RestaurantDetailSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      {/* Hero Image */}
      <div className="relative w-full h-56 md:h-80 lg:h-96">
        <img
          src={singleRestaurant.imageUrl}
          alt={singleRestaurant.restaurantName}
          className="object-cover w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-6 left-4 md:bottom-10 md:left-8 right-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              4.8
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tight drop-shadow-sm">
            {singleRestaurant.restaurantName}
          </h1>
          <div className="flex items-center gap-2 text-white/90">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">
              {singleRestaurant.city}, {singleRestaurant.country}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Info Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 -mt-10 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            {/* Cuisines */}
            <div className="flex flex-wrap gap-2">
              {singleRestaurant.cuisines.map((cuisine: string) => (
                <Badge
                  key={cuisine}
                  className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 px-3 py-1 rounded-full font-medium border-none"
                >
                  {cuisine}
                </Badge>
              ))}
            </div>

            {/* Delivery Info */}
            <div className="flex items-center gap-4 md:gap-6 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Timer className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                    {singleRestaurant.deliveryTime} mins
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Delivery time</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                    ₹{singleRestaurant.deliveryPrice || 0}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Delivery fee</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Section */}
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
            Menu
          </h2>
          {singleRestaurant.menus && singleRestaurant.menus.length > 0 ? (
            <AvailableMenu menus={singleRestaurant.menus} />
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
              <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4">
                <UtensilsCrossed className="h-7 w-7 text-orange-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                No menu items available yet
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Check back soon for new dishes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;

// ======================= SKELETON LOADER =======================

const RestaurantDetailSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <div className="relative w-full h-56 md:h-80 lg:h-96">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 -mt-10 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-6">
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-48 mb-6 rounded-lg" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
};