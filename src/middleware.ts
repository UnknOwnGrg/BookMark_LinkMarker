import type { Request , Response , NextFunction } from "express";
import { JWT_PASSWORD } from "./config.js";
import jwt, { type JwtPayload } from 'jsonwebtoken';


// In your middleware file
//It is also the another method for the extending the Request object in Ts
// interface AuthenticatedRequest extends Request {
//   user?: string;
// }

export const userMiddleware = (req : Request, res : Response , next: NextFunction) => {
    const token = req.headers["authorization"];

    if(!token) return res.status(401).send({error : "Invalid Token"}); 
    try {
        const decodedData = jwt.verify(token , JWT_PASSWORD as string) as JwtPayload;
        
        if (!decodedData.id) {
            return res.status(401).send({error: "Invalid token payload"});
        }
        
        req.userId = decodedData.id;      
        next();
    } catch (error) {
        return res.status(401).send({error: "Invalid or expired token"});
    }
};