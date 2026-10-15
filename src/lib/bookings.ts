import "server-only";
import type { Prisma } from "@prisma/client";

export const bookingInclude = {
  project: { select: { id: true, name: true, color: true } },
  participants: {
    select: { userId: true, user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.BookingInclude;
