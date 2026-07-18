import { NextFunction, Request, Response } from "express";
declare global {
    namespace Express {
        interface Request {
            id: string;
            admin: boolean;
            email: string;
        }
    }
}
export declare const isAuthenticated: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const isAdmin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=isAuthenticated.d.ts.map