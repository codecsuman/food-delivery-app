import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, UtensilsCrossed, Pencil } from "lucide-react";
import React, { FormEvent, useState } from "react";
import EditMenu from "./EditMenu";
import { MenuFormSchema, menuSchema } from "@/schema/menuSchema";
import { useMenuStore } from "@/store/useMenuStore";
import { useRestaurantStore } from "@/store/useRestaurantStore";

const AddMenu = () => {
  const [input, setInput] = useState<MenuFormSchema>({
    name: "",
    description: "",
    price: 0,
    image: undefined,
  });
  const [open, setOpen] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [selectedMenu, setSelectedMenu] = useState<any>(null);
  const [error, setError] = useState<Partial<MenuFormSchema>>({});
  const [previewImage, setPreviewImage] = useState<string>("");

  const { loading, createMenu } = useMenuStore();
  const { restaurant, addMenuToRestaurant, removeMenuFromRestaurant } = useRestaurantStore();

  const changeEventHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setInput((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
    if (error[name as keyof MenuFormSchema]) {
      setError((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const result = menuSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors = result.error.formErrors.fieldErrors;
      setError(fieldErrors as Partial<MenuFormSchema>);
      return;
    }

    setError({});

    const formData = new FormData();
    formData.append("name", input.name);
    formData.append("description", input.description);
    formData.append("price", input.price.toString());
    if (input.image) {
      formData.append("image", input.image);
    }

    try {
      const newMenu = await createMenu(formData);

      if (newMenu) {
        addMenuToRestaurant(newMenu);
        setOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error("Create menu error:", error);
    }
  };

  const resetForm = () => {
    setInput({ name: "", description: "", price: 0, image: undefined });
    setPreviewImage("");
    setError({});
  };

  const handleDeleteMenu = async (menuId: string) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return;

    try {
      // await deleteMenu(menuId);
      removeMenuFromRestaurant(menuId);
    } catch (error) {
      console.error("Delete menu error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="font-extrabold text-3xl tracking-tight text-gray-900 dark:text-white">
              Menu Items
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage the dishes your customers can order
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 rounded-xl px-5">
                <Plus className="mr-2 h-4 w-4" />
                Add Menu
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-800 rounded-2xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-white text-xl">
                  Add New Menu Item
                </DialogTitle>
                <DialogDescription className="text-gray-500 dark:text-gray-400">
                  Create a menu item for your restaurant.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={submitHandler} className="space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Name</Label>
                  <Input
                    type="text"
                    name="name"
                    value={input.name}
                    onChange={changeEventHandler}
                    placeholder="e.g. Chicken Biryani"
                    className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
                  />
                  {error.name && (
                    <span className="text-xs font-medium text-red-500">
                      {error.name}
                    </span>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Description</Label>
                  <Input
                    type="text"
                    name="description"
                    value={input.description}
                    onChange={changeEventHandler}
                    placeholder="Brief description"
                    className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
                  />
                  {error.description && (
                    <span className="text-xs font-medium text-red-500">
                      {error.description}
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Price (₹)</Label>
                  <Input
                    type="number"
                    name="price"
                    value={input.price}
                    onChange={changeEventHandler}
                    placeholder="Enter price"
                    min={0}
                    className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
                  />
                  {error.price && (
                    <span className="text-xs font-medium text-red-500">
                      {error.price}
                    </span>
                  )}
                </div>

                {/* Image */}
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Menu Image</Label>
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm"
                    />
                  )}
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    name="image"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setInput((prev) => ({ ...prev, image: file }));
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setPreviewImage(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer file:text-orange-500 file:font-medium"
                  />
                  {error.image?.name && (
                    <span className="text-xs font-medium text-red-500">
                      {error.image.name}
                    </span>
                  )}
                </div>

                <DialogFooter className="mt-6">
                  {loading ? (
                    <Button disabled className="bg-orange-500 rounded-lg w-full">
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Please wait
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg w-full shadow-md shadow-orange-500/20"
                    >
                      Add Menu Item
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Menu List */}
        {restaurant?.menus?.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
            <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4">
              <UtensilsCrossed className="h-7 w-7 text-orange-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              No menu items yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Add your first dish to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {restaurant?.menus.map((menu: any) => (
              <div
                key={menu._id}
                className="group flex flex-col md:flex-row md:items-center gap-5 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg border border-gray-100 dark:border-gray-700 transition-all duration-200 hover:-translate-y-0.5"
              >
                <img
                  src={menu.image}
                  alt={menu.name}
                  className="md:h-24 md:w-24 h-40 w-full object-cover rounded-xl ring-1 ring-black/5"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white truncate">
                    {menu.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {menu.description}
                  </p>
                  <p className="text-md font-bold mt-2 bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent inline-block">
                    ₹{menu.price}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    onClick={() => {
                      setSelectedMenu(menu);
                      setEditOpen(true);
                    }}
                    size="sm"
                    className="bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 dark:text-orange-400 rounded-lg shadow-none"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeleteMenu(menu._id)}
                    size="sm"
                    variant="destructive"
                    className="rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 shadow-none"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <EditMenu
          selectedMenu={selectedMenu}
          editOpen={editOpen}
          setEditOpen={setEditOpen}
        />
      </div>
    </div>
  );
};

export default AddMenu;