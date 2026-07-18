import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RestaurantFormSchema,
  restaurantFromSchema,
} from "@/schema/restaurantSchema";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { ImageIcon, Loader2, Store, Upload } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

const Restaurant = () => {
  const [input, setInput] = useState<RestaurantFormSchema>({
    restaurantName: "",
    city: "",
    country: "",
    deliveryTime: 0,
    deliveryPrice: 0,
    cuisines: [],
    imageFile: undefined,
  });
  const [errors, setErrors] = useState<Partial<RestaurantFormSchema>>({});
  const [previewImage, setPreviewImage] = useState<string>("");

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

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const result = restaurantFromSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors = result.error.formErrors.fieldErrors;
      setErrors(fieldErrors as Partial<RestaurantFormSchema>);
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
    const fetchRestaurant = async () => {
      await getRestaurant();
      const fetchedRestaurant = useRestaurantStore.getState().restaurant;

      if (fetchedRestaurant) {
        setInput({
          restaurantName: fetchedRestaurant.restaurantName || "",
          city: fetchedRestaurant.city || "",
          country: fetchedRestaurant.country || "",
          deliveryTime: fetchedRestaurant.deliveryTime || 0,
          deliveryPrice: fetchedRestaurant.deliveryPrice || 0,
          cuisines: fetchedRestaurant.cuisines || [],
          imageFile: undefined,
        });

        if (fetchedRestaurant.imageUrl) {
          setPreviewImage(fetchedRestaurant.imageUrl);
        }
      }
    };

    fetchRestaurant();
  }, [getRestaurant]);

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
              {errors.imageFile?.name && (
                <span className="text-xs text-red-500 font-medium">
                  {errors.imageFile.name}
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