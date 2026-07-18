import { Response } from "express";
import { IUserDocument } from "../models/user.model.js";
export declare const generateToken: (res: Response, user: IUserDocument) => string;
export declare const clearToken: (res: Response) => void;
//# sourceMappingURL=generateToken.d.ts.map