import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('invalid email'),
  password: z.string().min(1, 'password is required'),
  userId: z.string().min(1, 'userId must not be empty').optional(),
});

export const FirebaseSessionSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});
