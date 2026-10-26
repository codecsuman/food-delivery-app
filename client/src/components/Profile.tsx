import { Loader2, Mail, Phone, UserCircle2, Store, Trash2, Star, CheckCircle, MapPin as MapPinIcon, ArrowRight, Target, Plus, LocateFixed } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { FormEvent, useRef, useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { useUserStore } from "@/store/useUserStore";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { Link } from "react-router-dom";
import AddressPicker from "./AddressPicker";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { getImageUrl, handleImageError } from "@/lib/placeholder";

const Profile = () => {
  const { user, updateProfile, loading } = useUserStore();
  const { restaurants, getUserRestaurants, deleteRestaurant, loading: restaurantLoading } = useRestaurantStore();
  const imageRef = useRef<HTMLInputElement | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [useMapPicker, setUseMapPicker] = useState(false);

  const [profileData, setProfileData] = useState({
    fullname: "",
    email: "",
    contact: "",
    alternateContact: "",
    address: "",
    pincode: "",
    city: "",
    state: "",
    country: "",
    latitude: null as number | null,
    longitude: null as number | null,
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
        alternateContact: user.alternateContact ? String(user.alternateContact) : "",
        address: user.address || "",
        pincode: user.pincode || "",
        city: user.city || "",
        state: user.state || "",
        country: user.country || "",
        latitude: typeof user.latitude === "number" ? user.latitude : null,
        longitude: typeof user.longitude === "number" ? user.longitude : null,
        profilePicture: user.profilePicture || "",
      });
      setSelectedProfilePicture(user.profilePicture || "");
    }
  }, [user]);

  // Use the reusable hook for current location
  const { fetchLocation, loading: locationLoading, error: locationError } = useCurrentLocation();

  const handleUseMyLocation = async () => {
    const location = await fetchLocation();
    if (location) {
      const [longitude, latitude] = location.coordinates;
      setProfileData((prev) => ({
        ...prev,
        address: location.formattedAddress || location.address || prev.address,
        // The GPS fix is the new source of truth. Never keep the old city/
        // state/pincode when the reverse geocoder cannot fill a field —
        // that is what produced addresses with a pincode from a previous
        // location.
        pincode: location.pincode || "",
        city: location.city || "",
        state: location.state || "",
        country: location.country || "",
        latitude,
        longitude,
      }));
    }
  };

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
    setProfileData((prev) => {
      // Editing any part of the address invalidates a previously captured
      // GPS/map pin, so clear it instead of saving a location that no longer
      // matches the text the customer just typed.
      const addressField = ["address", "pincode", "city", "state", "country"].includes(name);
      return {
        ...prev,
        [name]: value,
        ...(addressField ? { latitude: null, longitude: null } : {}),
      };
    });
  };

  const updateProfileHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: any = {};
    if (profileData.fullname !== (user?.fullname || "")) payload.fullname = profileData.fullname;
    if (profileData.contact !== String(user?.contact || "")) payload.contact = profileData.contact;
    if (profileData.alternateContact !== String(user?.alternateContact || "")) payload.alternateContact = profileData.alternateContact;
    if (profileData.address !== (user?.address || "")) payload.address = profileData.address;
    if (profileData.pincode !== (user?.pincode || "")) payload.pincode = profileData.pincode;
    if (profileData.city !== (user?.city || "")) payload.city = profileData.city;
    if (profileData.state !== (user?.state || "")) payload.state = profileData.state;
    if (profileData.country !== (user?.country || "")) payload.country = profileData.country;
    const savedLatitude = typeof user?.latitude === "number" ? user.latitude : null;
    const savedLongitude = typeof user?.longitude === "number" ? user.longitude : null;
    if (profileData.latitude !== savedLatitude || profileData.longitude !== savedLongitude) {
      payload.latitude = profileData.latitude;
      payload.longitude = profileData.longitude;
    }
    if (profileData.profilePicture !== user?.profilePicture) payload.profilePicture = profileData.profilePicture;

    if (Object.keys(payload).length === 0) return;

    const updated = await updateProfile(payload);
    if (updated) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
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
              <Phone className="w-4 h-4 text-gray-400" /> Alternate Phone (Optional)
            </Label>
            <Input type="tel" name="alternateContact" value={profileData.alternateContact} onChange={changeHandler} placeholder="Alternate 10-digit phone number" maxLength={10} className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
          </div>
          
          {/* Address Section with Map Picker */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                <MapPinIcon className="w-4 h-4 text-gray-400" /> Address
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setUseMapPicker(!useMapPicker)}
                className="h-9 text-xs gap-1"
              >
                {useMapPicker ? (
                  <>
                    <Target className="w-3.5 h-3.5" />
                    Use Manual Input
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    Use Map Picker
                  </>
                )}
              </Button>
            </div>
            
            {useMapPicker ? (
              <AddressPicker
                onAddressSelect={(data) => {
                  setProfileData((prev) => ({
                    ...prev,
                    address: data.address,
                    pincode: data.pincode,
                    city: data.city || data.formattedAddress.split(",").slice(-3, -2)[0]?.trim() || prev.city,
                    state: data.state || prev.state,
                    country: data.country || data.formattedAddress.split(",").pop()?.trim() || prev.country,
                    latitude: data.coordinates[1],
                    longitude: data.coordinates[0],
                  }));
                  setUseMapPicker(false);
                }}
                initialAddress={profileData.address}
                initialPincode={profileData.pincode}
                initialCoordinates={
                  profileData.latitude !== null && profileData.longitude !== null
                    ? [profileData.longitude, profileData.latitude]
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Street Address</Label>
                  <Input name="address" value={profileData.address} onChange={changeHandler} placeholder="Enter your street address" className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
                </div>
                
                {/* Use My Location Button - Auto-fills City, Pincode, Country */}
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Quick Fill Location</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseMyLocation}
                    disabled={locationLoading}
                    className="w-full h-12 gap-2 justify-start bg-white dark:bg-gray-800 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                  >
                    {locationLoading ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Detecting location...
                      </>
                    ) : (
                      <>
                        <LocateFixed className="mr-2 w-4 h-4 text-orange-500" />
                        Use My Location (Auto-fill City, Pincode, Country)
                      </>
                    )}
                  </Button>
                  {locationError && <p className="text-sm text-red-500">{locationError}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300 font-medium">Pincode</Label>
                    <Input 
                      type="text" 
                      name="pincode" 
                      value={profileData.pincode} 
                      onChange={async (e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setProfileData((prev) => ({ ...prev, pincode: value, latitude: null, longitude: null }));
                        
                        // Auto-fetch city/state from pincode when 6 digits entered
                        if (value.length === 6) {
                          try {
                            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
                            const res = await fetch(`${API_BASE_URL}/map/pincode/${value}`);
                            const data = await res.json();
                            if (data.success) {
                              setProfileData((prev) => ({
                                ...prev,
                                city: data.city || "",
                                state: data.state || "",
                                country: data.country || "",
                              }));
                            }
                          } catch (err) {
                            console.warn("Pincode lookup failed:", err);
                          }
                        }
                      }} 
                      placeholder="6-digit pincode (auto-fills city/state)" 
                      maxLength={6} 
                      className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300 font-medium">City</Label>
                    <Input name="city" value={profileData.city} onChange={changeHandler} placeholder="City" className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300 font-medium">State</Label>
                    <Input name="state" value={profileData.state} onChange={changeHandler} placeholder="State" className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300 font-medium">Country</Label>
                    <Input name="country" value={profileData.country} onChange={changeHandler} placeholder="Country" className="h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500" />
                  </div>
                </div>
              </div>
            )}
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
                <img src={getImageUrl(restaurant.imageUrl)} onError={handleImageError} alt={restaurant.restaurantName} className="w-16 h-16 rounded-xl object-cover" />
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