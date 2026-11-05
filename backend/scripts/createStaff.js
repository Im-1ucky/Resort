import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

const staffAccounts = [
  {
    name: "Reservations Staff",
    email: process.env.RESERVATIONS_EMAIL?.trim().toLowerCase(),
    password: process.env.RESERVATIONS_PASSWORD,
    role: "RESERVATIONS",
  },
  {
    name: "Sales Staff",
    email: process.env.SALES_EMAIL?.trim().toLowerCase(),
    password: process.env.SALES_PASSWORD,
    role: "SALES",
  },
];

async function main() {
  for (const account of staffAccounts) {
    if (!account.email || !account.password) {
      throw new Error(`Missing credentials for ${account.role}`);
    }

    if (account.password.length < 12) {
      throw new Error(`${account.role} password must be at least 12 characters`);
    }

    const existing = await prisma.user.findUnique({
      where: { email: account.email },
    });

    if (existing) {
      throw new Error(`User already exists: ${account.email}`);
    }

    const passwordHash = await bcrypt.hash(account.password, 12);

    const user = await prisma.user.create({
      data: {
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    console.log("Created staff account:", user);
  }
}

main()
  .catch((error) => {
    console.error("Staff account creation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
