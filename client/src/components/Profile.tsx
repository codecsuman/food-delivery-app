import { Loader2, LocateIcon, Mail, MapPin, MapPinnedIcon, Plus, Phone, UserCircle2, Store, Trash2, Star, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { FormEvent, useRef, useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { useUserStore } from "@/store/useUserStore";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { Link } from "react-router-dom";

const Profile = () => {
  const { user, updateProfile, loading } = useUserStore();
  const { restaurants, getUserRestaurants, deleteRestaurant, loading: restaurantLoading } = useRestaurantStore();
  const imageRef = useRef<HTMLInputElement | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [profileData, setProfileData] = useState({
    fullname: "",
    email: "",
    contact: "",
    address: "",
    city: "",
    country: "",
    profilePicture: "",
  });

  const [selectedProfilePicture, setSelectedProfilePicture] = useState<string>("");

  useEffect(() => {
    getUserRestaurants();
  }, [getUserRestaurants]);

  useEffect(() => {
    if (user) {
      setProfileData({
        fullname: user.fullname || "",
        email: user.email || "",
        contact: user.contact ? String(user.contact) : "",
        address: user.address || "",
        city: user.city || "",
        country: user.country || "",
        profilePicture: user.profilePicture || "",
      });
      setSelectedProfilePicture(user.profilePicture || "");
    }
  }, [user]);

  const fileChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setSelectedProfilePicture(result);
        setProfileData((prev) => ({ ...prev, profilePicture: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const changeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const updateProfileHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: any = {};
    if (profileData.fullname !== user?.fullname) payload.fullname = profileData.fullname;
    if (profileData.contact !== String(user?.contact || "")) payload.contact = profileData.contact;
    if (profileData.address !== user?.address) payload.address = profileData.address;
    if (profileData.city !== user?.city) payload.city = profileData.city;
    if (profileData.country !== user?.country) payload.country = profileData.country;
    if (profileData.profilePicture !== user?.profilePicture) payload.profilePicture = profileData.profilePicture;

    if (Object.keys(payload).length === 0) return;

    await updateProfile(payload);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <form onSubmit={updateProfileHandler} className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
            <UserCircle2 className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Profile Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your personal information</p>
          </div>
        </div>

        {/* Profile Picture & Name */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8 pb-8 border-b border-gray-100 dark:border-gray-700">
          <div className="relative shrink-0">
            <Avatar className="w-28 h-28 border-4 border-white dark:border-gray-800 ring-2 ring-orange-500 shadow-lg">
              <AvatarImage src={selectedProfilePicture} />
              <AvatarFallback className="bg-orange-100 text-orange-600 text-2xl font-bold">
                {getInitials(profileData.fullname || "User")}
              </AvatarFallback>
            </Avatar>
            <input ref={imageRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={fileChangeHandler} />
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              className="absolute bottom-0 right-0 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white p-2 rounded-full shadow-lg shadow-orange-500/30 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 w-full">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</Label>
            <Input
              type="text"
              name="fullname"
              value={profileData.fullname}
              onChange={changeHandler}
              placeholder="Your full name"
              className="mt-1.5 h-12 text-xl font-semibold bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
            />
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
              <Mail className="w-4 h-4 text-gray-400" /> Email
            </Label>
            <Input disabled name="email" value={profileData.email} className="h-12 bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed rounded-lg" />
            <p className="text-xs text-gray-400 dark:text-gray-500">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
              <Phone className="w-4 h-4 text-gray-400" /> Phone Number
            </Label>
            <Input type="tel" name="contact" value={profileData.contact} onChange={changeHandler} placeholder="10-digit phone number" maxLength={10} className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
              <LocateIcon className="w-4 h-4 text-gray-400" /> Address
            </Label>
            <Input name="address" value={profileData.address} onChange={changeHandler} placeholder="Street address" className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
              <MapPin className="w-4 h-4 text-gray-400" /> City
            </Label>
            <Input name="city" value={profileData.city} onChange={changeHandler} placeholder="Your city" className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
              <MapPinnedIcon className="w-4 h-4 text-gray-400" /> Country
            </Label>
            <Input name="country" value={profileData.country} onChange={changeHandler} placeholder="Your country" className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-gray-700">
          <Button type="submit" disabled={loading} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 h-11 rounded-lg shadow-md shadow-orange-500/20 transition-all disabled:opacity-50">
            {loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Updating...</> : "Update Profile"}
          </Button>
        </div>
      </form>

      {/* Restaurants Added Section */}
      <div className="max-w-4xl mx-auto mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
            <Store className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">Restaurants Added</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {restaurants.length} {restaurants.length === 1 ? "restaurant" : "restaurants"} registered
            </p>
          </div>
        </div>

        {restaurants.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No restaurants added yet. <Link to="/admin/restaurant" className="text-orange-500 hover:underline">Add one now</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {restaurants.map((restaurant) => (
              <div key={restaurant._id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                <img src={restaurant.imageUrl} alt={restaurant.restaurantName} className="w-16 h-16 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{restaurant.restaurantName}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{restaurant.city}, {restaurant.country}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-gray-600 dark:text-gray-300">{restaurant.rating || 0} ({restaurant.ratingCount || 0} reviews)</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteRestaurant(restaurant._id)}
                  disabled={restaurantLoading}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-green-500/30 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Profile updated successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;