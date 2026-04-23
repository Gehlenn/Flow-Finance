/**
 * Express type extensions
 * Adds custom properties to Express Request
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        displayName?: string;
      };
      app: {
        locals: {
          db: FirebaseFirestore.Firestore;
          [key: string]: any;
        };
      };
    }
  }
}

export {};
