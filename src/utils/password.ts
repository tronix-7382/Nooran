import bcrypt from 'bcrypt';

export const hashPassword = async (plainPassword: string): Promise<string> => {
    const salt= 10;
    return bcrypt.hash(plainPassword, salt);
}

export const comparePassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
    return bcrypt.compare(plainPassword, hashedPassword);
}