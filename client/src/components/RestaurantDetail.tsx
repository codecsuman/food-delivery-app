import { useRestaurantStore } from "@/store/useRestaurantStore";
import { useReviewStore } from "@/store/useReviewStore";
import { useUserStore } from "@/store/useUserStore";
import AvailableMenu from "./AvailableMenu";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Timer, MapPin, Globe, Star, UtensilsCrossed, MessageSquare, Send, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Skeleton } from "./ui/skeleton";

const RestaurantDetail = () => {
  const params = useParams();
  const { singleRestaurant, getSingleRestaurant, loading } = useRestaurantStore();
  const { reviews, getReviewsByRestaurant, addReview, loading: reviewLoading } = useReviewStore();
  const { user } = useUserStore();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    if (params.id) {
      getSingleRestaurant(params.id);
      getReviewsByRestaurant(params.id);
    }
  }, [params.id, getSingleRestaurant, getReviewsByRestaurant]);

  const handleSubmitReview = async () => {
    if (!rating || !comment.trim() || !params.id) return;
    const success = await addReview({
      restaurantId: params.id,
      rating,
      comment: comment.trim(),
      userName: user?.fullname || "Anonymous",
      userImage: user?.profilePicture || "",
    });
    if (success) {
      setRating(0);
      setComment("");
      getReviewsByRestaurant(params.id);
    }
  };

  if (loading || !singleRestaurant) {
    return <RestaurantDetailSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <div className="relative w-full h-56 md:h-80 lg:h-96">
        <img src={singleRestaurant.imageUrl} alt={singleRestaurant.restaurantName} className="object-cover w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-6 left-4 md:bottom-10 md:left-8 right-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {singleRestaurant.rating || 0} ({singleRestaurant.ratingCount || 0} reviews)
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tight drop-shadow-sm">{singleRestaurant.restaurantName}</h1>
          <div className="flex items-center gap-2 text-white/90">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">{singleRestaurant.city}, {singleRestaurant.country}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 -mt-10 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex flex-wrap gap-2">
              {singleRestaurant.cuisines.map((cuisine: string) => (
                <Badge key={cuisine} className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 px-3 py-1 rounded-full font-medium border-none">
                  {cuisine}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-4 md:gap-6 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Timer className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{singleRestaurant.deliveryTime} mins</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Delivery time</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">₹{singleRestaurant.deliveryPrice || 0}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Delivery fee</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">Menu</h2>
          {singleRestaurant.menus && singleRestaurant.menus.length > 0 ? (
            <AvailableMenu
              menus={singleRestaurant.menus}
              restaurant={singleRestaurant}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
              <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4">
                <UtensilsCrossed className="h-7 w-7 text-orange-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">No menu items available yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Check back soon for new dishes</p>
            </div>
          )}
        </div>

        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Customer Reviews</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Write a Review</h3>
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star className={`w-7 h-7 ${star <= (hoverRating || rating) ? "text-amber-400 fill-amber-400" : "text-gray-300 dark:text-gray-600"}`} />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{rating > 0 ? `${rating}/5` : "Select rating"}</span>
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this restaurant..."
              className="mb-4 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg resize-none"
              rows={3}
            />
            <Button
              onClick={handleSubmitReview}
              disabled={!rating || !comment.trim() || reviewLoading}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg shadow-md shadow-orange-500/20"
            >
              <Send className="w-4 h-4 mr-2" />
              {reviewLoading ? "Submitting..." : "Submit Review"}
            </Button>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              No reviews yet. Be the first to review!
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <div key={review._id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center overflow-hidden">
                      {review.user?.profilePicture ? (
                        <img src={review.user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {review.user?.fullname || review.userName || "Anonymous"}
                      </p>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;

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