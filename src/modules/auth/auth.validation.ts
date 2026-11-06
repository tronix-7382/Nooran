import {z} from "zod"

export const registerSchema = z.object({
    email: z.email("Invalid email address"),
    password: z.string("Password is required").min(6, "Password must be at least 6 characters long"),
    firstName: z.string("First name is required").min(1, "First name cannot be empty"),
    lastName: z.string("Last name is required").min(1, "Last name cannot be empty"),
    nationalId: z.string().optional()
})

export const loginSchema = z.object({
    email: z.email("Invalid email address"),
    password: z.string("Password is required").min(1, "Password cannot be empty")
})

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) }).strict();
export const logoutSchema = z.object({ refreshToken: z.string().min(1) }).strict();
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
}).strict();
export const forgotPasswordSchema = z.object({ email: z.email() }).strict();
export const resetPasswordSchema = z.object({
    token: z.string().min(20),
    newPassword: z.string().min(8),
}).strict();
export const sendPhoneCodeSchema = z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international phone format such as +989121234567."),
}).strict();
export const verifyPhoneCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
