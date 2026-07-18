import { Request, Response } from "express";
export declare const createRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getRestaurantOrder: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateOrderStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const searchRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getSingleRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=restaurant.controller.d.ts.map