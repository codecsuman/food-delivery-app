import mongoose, { Document } from "mongoose";
export interface IRestaurant {
    user: mongoose.Schema.Types.ObjectId;
    restaurantName: string;
    city: string;
    country: string;
    deliveryTime: number;
    deliveryPrice: number;
    cuisines: string[];
    imageUrl: string;
    imagePublicId?: string;
    menus: mongoose.Schema.Types.ObjectId[];
}
export interface IRestaurantDocument extends IRestaurant, Document {
    createdAt: Date;
    updatedAt: Date;
}
export declare const Restaurant: mongoose.Model<IRestaurantDocument, {}, {}, {}, mongoose.Document<unknown, {}, IRestaurantDocument, {}, {}> & IRestaurantDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=restaurant.model.d.ts.map