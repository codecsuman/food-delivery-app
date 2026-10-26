import { Types } from "mongoose";
import { Menu } from "../models/menu.model.js";

type OrderWithItems = {
  cartItems?: Array<{ menuId?: string; image?: string }>;
};

/**
 * Orders snapshot the menu image URL at checkout time.
 *
 * When an owner later replaces a menu photo, Cloudinary deletes the old asset
 * (or the menu itself is removed). The order keeps the dead URL forever, so the
 * dashboard and the customer receipt render a broken image and the browser logs
 * a `404` for every visit.
 *
 * Repoint each item at the menu's current image when that menu still exists.
 * Deleted menus keep their snapshot — the client shows the shared placeholder.
 */
export const refreshOrderItemImages = async <T extends OrderWithItems>(
  orders: T[],
): Promise<T[]> => {
  const menuIds = new Set<string>();

  for (const order of orders) {
    for (const item of order.cartItems ?? []) {
      if (item?.menuId && item.image && Types.ObjectId.isValid(item.menuId)) {
        menuIds.add(item.menuId);
      }
    }
  }

  if (menuIds.size === 0) return orders;

  const menus = await Menu.find({ _id: { $in: [...menuIds] } }).select(
    "_id image",
  );
  const currentImage = new Map(
    menus.map((menu) => [menu._id.toString(), menu.image]),
  );

  for (const order of orders) {
    for (const item of order.cartItems ?? []) {
      const image = item.menuId ? currentImage.get(item.menuId) : undefined;
      if (image && image !== item.image) {
        item.image = image;
      }
    }
  }

  return orders;
};
