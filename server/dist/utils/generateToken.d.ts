import { IUserDocument } from "../models/user.model.js";
import { Response } from "express";
export declare const generateToken: (res: Response, user: IUserDocument) => string;
export declare const clearToken: (res: Response) => void;
//# sourceMappingURL=generateToken.d.ts.map