import { create } from "zustand";
import axios from "axios";
import { toast } from "sonner";

const API_END_POINT = `${import.meta.env.VITE_API_BASE_URL}/review`;
axios.defaults.withCredentials = true;

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

export const useReviewStore = create<ReviewState>((set) => ({
  loading: false,
  reviews: [],

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
    try {
      set({ loading: true });
      const response = await axios.get(
        `${API_END_POINT}/restaurant/${restaurantId}`,
      );
      if (response.data.success) {
        set({ reviews: response.data.reviews || [] });
      }
    } catch (error: any) {
      console.error("Get reviews error:", error);
    } finally {
      set({ loading: false });
    }
  },

  getUserReviews: async () => {
    try {
      set({ loading: true });
      const response = await axios.get(`${API_END_POINT}/my-reviews`);
      if (response.data.success) {
        set({ reviews: response.data.reviews || [] });
      }
    } catch (error: any) {
      console.error("Get user reviews error:", error);
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
