import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string; // or whatever type your user ID is or in simple words Adding new custom Properties.
      //extending the Interface
    }
  }
}