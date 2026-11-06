import "dotenv/config";
import { SystemRole } from "../src/generated/prisma/index.js";
import prisma from "../src/lib/prisma.js";
import { hashPassword } from "../src/utils/password.js";

const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME;
const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME;

try {
  if (!email || !password || !firstName || !lastName || password.length < 12) {
    throw new Error(
      "Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (12+ chars), BOOTSTRAP_ADMIN_FIRST_NAME and BOOTSTRAP_ADMIN_LAST_NAME.",
    );
  }
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing)
    throw new Error(
      "Bootstrap admin email already exists; refusing to overwrite an account.",
    );
  await prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      firstName,
      lastName,
      systemRole: SystemRole.ADMIN,
    },
  });
  process.stdout.write(
    "Initial admin created. Remove bootstrap credentials from the environment.\n",
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Admin bootstrap failed"}\n`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
