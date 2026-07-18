import mongoose, { Document } from "mongoose";
export interface IMenu {
    name: string;
    description: string;
    price: number;
    image: string;
    imagePublicId?: string;
    restaurant: mongoose.Schema.Types.ObjectId;
}
export interface IMenuDocument extends IMenu, Document {
    createdAt: Date;
    updatedAt: Date;
}
export declare const Menu: mongoose.Model<IMenuDocument, {}, {}, {}, mongoose.Document<unknown, {}, IMenuDocument, {}, {}> & IMenuDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=menu.model.d.ts.map