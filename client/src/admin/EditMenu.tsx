import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MenuFormSchema, menuSchema } from "@/schema/menuSchema";
import { useMenuStore } from "@/store/useMenuStore";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { MenuItem } from "@/types/restaurantType";
import { Loader2 } from "lucide-react";
import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useState,
} from "react";

const EditMenu = ({
  selectedMenu,
  editOpen,
  setEditOpen,
}: {
  selectedMenu: MenuItem | null;
  editOpen: boolean;
  setEditOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const [input, setInput] = useState<MenuFormSchema>({
    name: "",
    description: "",
    price: 0,
    image: undefined,
  });
  const [error, setError] = useState<Partial<MenuFormSchema>>({});
  const [previewImage, setPreviewImage] = useState<string>("");

  const { loading, editMenu } = useMenuStore();
  const { updateMenuToRestaurant } = useRestaurantStore();

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
      const updatedMenu = await editMenu(selectedMenu?._id!, formData);

      if (updatedMenu) {
        updateMenuToRestaurant(updatedMenu);
        setEditOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error("Edit menu error:", error);
    }
  };

  const resetForm = () => {
    setInput({ name: "", description: "", price: 0, image: undefined });
    setPreviewImage("");
    setError({});
  };

  useEffect(() => {
    if (selectedMenu) {
      setInput({
        name: selectedMenu.name || "",
        description: selectedMenu.description || "",
        price: selectedMenu.price || 0,
        image: undefined,
      });
      setPreviewImage(selectedMenu.image || "");
    }
  }, [selectedMenu]);

  return (
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="bg-white dark:bg-gray-800 rounded-2xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white text-xl">
            Edit Menu
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            Update your menu item to keep your offerings fresh.
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
              placeholder="Enter menu name"
              className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
            />
            {error.name && (
              <span className="text-xs font-medium text-red-500">{error.name}</span>
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
              placeholder="Enter menu description"
              className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
            />
            {error.description && (
              <span className="text-xs font-medium text-red-500">{error.description}</span>
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
              placeholder="Enter menu price"
              min={0}
              className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-orange-500"
            />
            {error.price && (
              <span className="text-xs font-medium text-red-500">{error.price}</span>
            )}
          </div>

          {/* Image */}
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-gray-300 font-medium">Menu Image</Label>
            {previewImage && (
              <img
                src={previewImage}
                alt="Current"
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
              <span className="text-xs font-medium text-red-500">{error.image.name}</span>
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
                Update Menu
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMenu;