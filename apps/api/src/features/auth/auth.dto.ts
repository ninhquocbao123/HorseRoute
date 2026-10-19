import { z } from "zod";
import { loginSchema, registerSchema } from "./auth.validation";
export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
