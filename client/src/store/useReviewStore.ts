import { create } from "zustand";
import axios from "axios";
import { toast } from "sonner";
import { isValidObjectId } from "@/lib/validation";
import { API_BASE_URL } from "@/lib/api";

const API_END_POINT = `${API_BASE_URL}/review`;
axios.defaults.withCredentials = true;

// Prevent a slow response for restaurant A from overwriting the reviews of
// restaurant B after the user navigates between detail pages.
let latestReviewsRequestId = 0;
const inFlightReviewRequests = new Map<string, Promise<void>>();

type Review = {
  _id: string;
  user: string;
  restaurant: string;
  menuItem?: string;
  rating: number;
  comment: string;
  userName: string;
  userImage?: string;
  createdAt: string;
};

type ReviewState = {
  loading: boolean;
  reviews: Review[];
  /** Human-readable reason the review list could not be loaded. */
  reviewsError: string | null;
  addReview: (data: {
    restaurantId: string;
    menuItemId?: string;
    rating: number;
    comment: string;
    userName?: string;
    userImage?: string;
  }) => Promise<boolean>;
  getReviewsByRestaurant: (restaurantId: string) => Promise<void>;
  getUserReviews: () => Promise<void>;
  deleteReview: (id: string) => Promise<boolean>;
};

const getErrorMessage = (error: any): string =>
  error?.response?.data?.message ||
  error?.message ||
  "Could not load reviews. Please try again.";

export const useReviewStore = create<ReviewState>((set) => ({
  loading: false,
  reviews: [],
  reviewsError: null,

  addReview: async (data) => {
    try {
      set({ loading: true });
      const response = await axios.post(`${API_END_POINT}/`, data);
      if (response.data.success) {
        toast.success(response.data.message);
        set((state) => ({
          reviews: [response.data.review, ...state.reviews],
        }));
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to add review");
      return false;
    } finally {
      set({ loading: false });
    }
  },

  getReviewsByRestaurant: async (restaurantId) => {
    // Don't call the API with an id the backend will reject. A malformed id
    // is a client-side error, not a "no reviews yet" empty state.
    if (!isValidObjectId(restaurantId)) {
      set({
        reviews: [],
        reviewsError:
          "Reviews cannot be loaded because this restaurant link is invalid.",
        loading: false,
      });
      return;
    }

    const existingRequest = inFlightReviewRequests.get(restaurantId);
    if (existingRequest) return existingRequest;

    const requestId = ++latestReviewsRequestId;

    const request = (async () => {
      try {
        set({ loading: true, reviews: [], reviewsError: null });
        const response = await axios.get(
          `${API_END_POINT}/restaurant/${restaurantId}`,
        );

        if (requestId !== latestReviewsRequestId) return;

        if (response.data.success) {
          set({ reviews: response.data.reviews || [], reviewsError: null });
        } else {
          set({ reviews: [], reviewsError: "Could not load reviews." });
        }
      } catch (error: any) {
        if (requestId === latestReviewsRequestId) {
          const status = error?.response?.status;
          set({
            reviews: [],
            reviewsError:
              status === 400
                ? "This restaurant id is invalid, so reviews cannot be loaded."
                : getErrorMessage(error),
          });
        }
      } finally {
        if (requestId === latestReviewsRequestId) {
          set({ loading: false });
        }
      }
    })().finally(() => {
      inFlightReviewRequests.delete(restaurantId);
    });

    inFlightReviewRequests.set(restaurantId, request);
    return request;
  },

  getUserReviews: async () => {
    try {
      set({ loading: true });
      const response = await axios.get(`${API_END_POINT}/my-reviews`);
      if (response.data.success) {
        set({ reviews: response.data.reviews || [] });
      }
    } catch {
      // Get user reviews error - silent
    } finally {
      set({ loading: false });
    }
  },

  deleteReview: async (id) => {
    try {
      set({ loading: true });
      const response = await axios.delete(`${API_END_POINT}/${id}`);
      if (response.data.success) {
        toast.success(response.data.message);
        set((state) => ({
          reviews: state.reviews.filter((r) => r._id !== id),
        }));
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete review");
      return false;
    } finally {
      set({ loading: false });
    }
  },
}));
