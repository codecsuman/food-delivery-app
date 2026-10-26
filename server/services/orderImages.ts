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
 * When the menu itself is gone, the snapshot URL points at a deleted Cloudinary
 * asset, so blank it — the client then renders its inline placeholder and the
 * browser never requests the dead file (no more console 404).
 */
export const refreshOrderItemImages = async <T extends OrderWithItems>(
  orders: T[],
): Promise<T[]> => {
  try {
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
        if (!item?.menuId || !Types.ObjectId.isValid(item.menuId)) continue;

        const image = currentImage.get(item.menuId);
        if (image) {
          if (image !== item.image) item.image = image;
        } else if (item.image) {
          item.image = "";
        }
      }
    }

    return orders;
  } catch {
    // Cosmetic cleanup only — never let it fail an order-history request.
    return orders;
  }
};
