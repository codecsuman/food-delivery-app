import axios from "axios";
import { toast } from "sonner";
import { create } from "zustand";

const API_END_POINT = `${import.meta.env.VITE_API_BASE_URL}/menu`;
axios.defaults.withCredentials = true;

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

type MenuItem = {
  _id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  restaurant: string;
};

type MenuState = {
  loading: boolean;
  menu: MenuItem | null;
  menus: MenuItem[];
  createMenu: (formData: FormData) => Promise<MenuItem | null>;
  editMenu: (menuId: string, formData: FormData) => Promise<MenuItem | null>;
  deleteMenu: (menuId: string) => Promise<boolean>;
  getAllMenus: () => Promise<void>;
};

export const useMenuStore = create<MenuState>((set) => ({
  loading: false,
  menu: null,
  menus: [],

  createMenu: async (formData: FormData) => {
    try {
      set({ loading: true });
      const response = await axios.post(`${API_END_POINT}/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        toast.success(response.data.message);
        const newMenu = response.data.menu;
        set({ menu: newMenu });
        return newMenu;
      }
      return null;
    } catch (error: any) {
      toast.error(getErrorMessage(error));
      return null;
    } finally {
      set({ loading: false });
    }
  },

  editMenu: async (menuId: string, formData: FormData) => {
    try {
      set({ loading: true });
      const response = await axios.put(`${API_END_POINT}/${menuId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        toast.success(response.data.message);
        const updatedMenu = response.data.menu;
        set({ menu: updatedMenu });
        return updatedMenu;
      }
      return null;
    } catch (error: any) {
      toast.error(getErrorMessage(error));
      return null;
    } finally {
      set({ loading: false });
    }
  },

  deleteMenu: async (menuId: string) => {
    try {
      set({ loading: true });
      const response = await axios.delete(`${API_END_POINT}/${menuId}`);

      if (response.data.success) {
        toast.success(response.data.message);
        set((state) => ({
          menus: state.menus.filter((m) => m._id !== menuId),
        }));
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      set({ loading: false });
    }
  },

  getAllMenus: async () => {
    try {
      set({ loading: true });
      const response = await axios.get(`${API_END_POINT}/`);
      if (response.data.success) {
        set({ menus: response.data.menus || [] });
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ loading: false });
    }
  },
}));
