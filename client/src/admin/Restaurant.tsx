import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RestaurantFormSchema,
  restaurantFromSchema,
} from "@/schema/restaurantSchema";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { ImageIcon, Loader2, Store, Upload, LocateFixed } from "lucide-react";
import { FormEvent, useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const DEFAULT_CENTER: [number, number] = [22.5726, 88.3639]; // Kolkata fallback

const Restaurant = () => {
  const [input, setInput] = useState<RestaurantFormSchema>({
    restaurantName: "",
    city: "",
    country: "",
    deliveryTime: 0,
    deliveryPrice: 0,
    cuisines: [],
    lat: 0,
    lng: 0,
    imageFile: undefined,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RestaurantFormSchema, string>>>({});
  const [previewImage, setPreviewImage] = useState<string>("");
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const hasFetched = useRef(false);

  // Map + draggable marker refs, replacing raw lat/lng number inputs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);

  const {
    loading,
    restaurant,
    updateRestaurant,
    createRestaurant,
    getRestaurant,
  } = useRestaurantStore();

  const changeEventHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setInput((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
    if (errors[name as keyof RestaurantFormSchema]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Keeps the marker + form state in sync whenever the pin moves,
  // whether from a drag, a map click, or "Use My Location".
  const setPinPosition = (lat: number, lng: number) => {
    setInput((prev) => ({ ...prev, lat, lng }));
    setErrors((prev) => ({ ...prev, lat: undefined, lng: undefined }));

    if (map.current && marker.current) {
      marker.current.setLatLng([lat, lng]);
      map.current.setView([lat, lng], 15);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrors((prev) => ({ ...prev, lat: "Geolocation is not supported by this browser" }));
      return;
    }

    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPinPosition(position.coords.latitude, position.coords.longitude);
        setFetchingLocation(false);
      },
      (err) => {
        setErrors((prev) => ({
          ...prev,
          lat:
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied. Drag the pin on the map instead."
              : "Could not fetch location. Drag the pin on the map instead.",
        }));
        setFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Initialize the map once, with a draggable marker the user can
  // move by hand, and a click-to-place shortcut on the map itself.
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const startLat = input.lat || DEFAULT_CENTER[0];
    const startLng = input.lng || DEFAULT_CENTER[1];

    map.current = L.map(mapContainer.current).setView([startLat, startLng], input.lat ? 15 : 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current);

    marker.current = L.marker([startLat, startLng], { draggable: true }).addTo(map.current);

    marker.current.on("dragend", () => {
      const pos = marker.current!.getLatLng();
      setPinPosition(pos.lat, pos.lng);
    });

    map.current.on("click", (e: L.LeafletMouseEvent) => {
      setPinPosition(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const result = restaurantFromSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors = result.error.formErrors.fieldErrors;
      setErrors(fieldErrors as Partial<Record<keyof RestaurantFormSchema, string>>);
      return;
    }

    setErrors({});

    const formData = new FormData();
    formData.append("restaurantName", input.restaurantName);
    formData.append("city", input.city);
    formData.append("country", input.country);
    formData.append("deliveryTime", input.deliveryTime.toString());
    formData.append("deliveryPrice", input.deliveryPrice.toString());
    formData.append("cuisines", JSON.stringify(input.cuisines));
    formData.append("lat", input.lat.toString());
    formData.append("lng", input.lng.toString());

    if (input.imageFile) {
      formData.append("imageFile", input.imageFile);
    }

    try {
      if (restaurant) {
        await updateRestaurant(formData);
      } else {
        await createRestaurant(formData);
      }
    } catch (error) {
      console.error("Restaurant submit error:", error);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchRestaurant = async () => {
      await getRestaurant();
      const fetchedRestaurant = useRestaurantStore.getState().restaurant;

      if (fetchedRestaurant) {
        const coords = (fetchedRestaurant as any)?.location?.coordinates;
        const hasCoords = Array.isArray(coords) && coords.length === 2;
        const lat = hasCoords ? coords[1] : 0;
        const lng = hasCoords ? coords[0] : 0;

        setInput({
          restaurantName: fetchedRestaurant.restaurantName || "",
          city: fetchedRestaurant.city || "",
          country: fetchedRestaurant.country || "",
          deliveryTime: fetchedRestaurant.deliveryTime || 0,
          deliveryPrice: fetchedRestaurant.deliveryPrice || 0,
          cuisines: fetchedRestaurant.cuisines || [],
          lat,
          lng,
          imageFile: undefined,
        });

        if (fetchedRestaurant.imageUrl) {
          setPreviewImage(fetchedRestaurant.imageUrl);
        }

        // Re-center the map + pin once existing coordinates load
        if (hasCoords) {
          setPinPosition(lat, lng);
        }
      }
    };

    fetchRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
            <Store className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="font-extrabold text-2xl md:text-3xl tracking-tight text-gray-900 dark:text-white">
              {restaurant ? "Update Restaurant" : "Add Restaurant"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {restaurant
                ? "Keep your restaurant details up to date"
                : "Set up your restaurant profile to start selling"}
            </p>
          </div>
        </div>

        <form
          onSubmit={submitHandler}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8"
        >
          <div className="grid md:grid-cols-2 gap-6">
            {/* Restaurant Name */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300 font-medium">
                Restaurant Name
              </Label>
              <Input
                type="text"
                name="restaurantName"
                value={input.restaurantName}
                onChange={changeEventHandler}
                placeholder="Enter restaurant name"
                className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
              />
              {errors.restaurantName && (
                <span className="text-xs text-red-500 font-medium">
                  {errors.restaurantName}
                </span>
              )}
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300 font-medium">City</Label>
              <Input
                type="text"
                name="city"
                value={input.city}
                onChange={changeEventHandler}
                placeholder="Enter city"
                className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
              />
              {errors.city && (
                <span className="text-xs text-red-500 font-medium">
                  {errors.city}
                </span>
              )}
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300 font-medium">Country</Label>
              <Input
                type="text"
                name="country"
                value={input.country}
                onChange={changeEventHandler}
                placeholder="Enter country"
                className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
              />
              {errors.country && (
                <span className="text-xs text-red-500 font-medium">
                  {errors.country}
                </span>
              )}
            </div>

            {/* Delivery Time */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300 font-medium">
                Delivery Time (minutes)
              </Label>
              <Input
                type="number"
                name="deliveryTime"
                value={input.deliveryTime}
                onChange={changeEventHandler}
                placeholder="e.g. 30"
                min={0}
                max={180}
                className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
              />
              {errors.deliveryTime && (
                <span className="text-xs text-red-500 font-medium">
                  {errors.deliveryTime}
                </span>
              )}
            </div>

            {/* Delivery Price */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300 font-medium">
                Delivery Price (₹)
              </Label>
              <Input
                type="number"
                name="deliveryPrice"
                value={input.deliveryPrice}
                onChange={changeEventHandler}
                placeholder="e.g. 40"
                min={0}
                className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
              />
            </div>

            {/* Cuisines */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300 font-medium">
                Cuisines (comma separated)
              </Label>
              <Input
                type="text"
                name="cuisines"
                value={input.cuisines.join(",")}
                onChange={(e) =>
                  setInput((prev) => ({
                    ...prev,
                    cuisines: e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                  }))
                }
                placeholder="e.g. Momos, Biryani, Pizza"
                className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
              />
              {input.cuisines.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {input.cuisines.map((c, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {errors.cuisines && (
                <span className="text-xs text-red-500 font-medium">
                  {errors.cuisines}
                </span>
              )}
            </div>

            {/* Restaurant Location — simple pin-drop map, no raw numbers */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-gray-700 dark:text-gray-300 font-medium">
                  Restaurant Location
                </Label>
                <Button
                  type="button"
                  size="sm"
                  onClick={useCurrentLocation}
                  disabled={fetchingLocation}
                  variant="outline"
                  className="h-9 border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  {fetchingLocation ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LocateFixed className="mr-2 h-3.5 w-3.5 text-orange-500" />
                  )}
                  Use My Location
                </Button>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                Tap "Use My Location", or just drag the pin to your restaurant's exact spot.
              </p>

              <div
                ref={mapContainer}
                className="h-64 w-full rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden"
              />

              {(errors.lat || errors.lng) && (
                <span className="text-xs text-red-500 font-medium">
                  {errors.lat || errors.lng}
                </span>
              )}
            </div>

            {/* Image Upload */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-gray-700 dark:text-gray-300 font-medium">
                Restaurant Banner
              </Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-full sm:w-36 h-24 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-300 dark:text-gray-500" />
                  )}
                </div>
                <div className="flex-1 w-full">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    name="imageFile"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setInput((prev) => ({ ...prev, imageFile: file }));
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setPreviewImage(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer file:text-orange-500 file:font-medium"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                    JPEG, PNG, or WEBP — recommended 16:9 banner image
                  </p>
                </div>
              </div>
              {/* FIX: errors.imageFile is a plain string now (same type as every
                  other field's error), so read it directly instead of `.name` */}
              {errors.imageFile && (
                <span className="text-xs text-red-500 font-medium">
                  {errors.imageFile}
                </span>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
            {loading ? (
              <Button disabled className="bg-orange-500 h-12 px-8 rounded-lg">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </Button>
            ) : (
              <Button
                type="submit"
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-12 px-8 text-white font-semibold rounded-lg shadow-md shadow-orange-500/20"
              >
                <Upload className="mr-2 h-4 w-4" />
                {restaurant ? "Update Restaurant" : "Add Restaurant"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Restaurant;