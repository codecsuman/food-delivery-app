import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMenuStore } from "@/store/useMenuStore";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Flame, IndianRupee } from "lucide-react";

const FeaturedMenus = () => {
  const { menus, loading, getAllMenus } = useMenuStore();

  useEffect(() => {
    getAllMenus();
  }, [getAllMenus]);

  if (!loading && menus.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-10 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Freshly Added Dishes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            New from restaurants near you
          </p>
        </div>
      </div>

      {/* Cards Grid / Scroll */}
      <div className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:overflow-visible scrollbar-hide snap-x snap-mandatory">
        {loading
          ? [...Array(4)].map((_, i) => (
              <Skeleton
                key={i}
                className="h-72 w-56 md:w-full shrink-0 rounded-2xl snap-start"
              />
            ))
          : menus.map((item) => (
              <Link
                key={item._id}
                to={`/restaurant/${item.restaurant}`}
                className="shrink-0 w-56 md:w-auto snap-start"
              >
                <Card className="group bg-white dark:bg-gray-800 shadow-sm rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1 p-0 h-full flex flex-col w-full">
                  {/* Image */}
                  <div className="relative overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder-food.png";
                      }}
                    />
                    {/* Price Badge */}
                    <div className="absolute top-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400 flex items-center gap-0.5">
                        <IndianRupee className="w-3 h-3" />
                        {item.price}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {item.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 flex-1">
                      {item.description}
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-xs text-orange-500 font-medium group-hover:underline">
                        View Restaurant →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>
    </section>
  );
};

export default FeaturedMenus;