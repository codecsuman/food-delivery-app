import { Request, Response } from "express";
type CheckoutSessionRequest = {
    cartItems: {
        menuId: string;
        name: string;
        image: string;
        price: number;
        quantity: number;
    }[];
    deliveryDetails: {
        name: string;
        email: string;
        address: string;
        city: string;
    };
    restaurantId: string;
};
export declare const getOrders: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createCheckoutSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const stripeWebhook: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createLineItems: (checkoutSessionRequest: CheckoutSessionRequest, menuItems: any[]) => any[];
export declare const getOrderBySessionId: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export {};
//# sourceMappingURL=order.controller.d.ts.map