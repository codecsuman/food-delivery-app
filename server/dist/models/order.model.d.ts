import mongoose, { Document } from "mongoose";
type DeliveryDetails = {
    email: string;
    name: string;
    address: string;
    city: string;
};
type CartItems = {
    menuId: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
};
export type OrderStatus = "pending" | "confirmed" | "preparing" | "outfordelivery" | "delivered" | "payment_failed";
export interface IOrder extends Document {
    user: mongoose.Schema.Types.ObjectId;
    restaurant: mongoose.Schema.Types.ObjectId;
    deliveryDetails: DeliveryDetails;
    cartItems: CartItems[];
    totalAmount: number;
    status: OrderStatus;
    paymentIntentId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Order: mongoose.Model<IOrder, {}, {}, {}, mongoose.Document<unknown, {}, IOrder, {}, {}> & IOrder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export {};
//# sourceMappingURL=order.model.d.ts.map