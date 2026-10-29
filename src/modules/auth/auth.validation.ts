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