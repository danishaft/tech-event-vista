import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const register = async () => {
	// This if statement is important, read here: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
	// Don't run in worker process - worker has its own Prisma instance
	if (
		process.env.NEXT_RUNTIME === "nodejs" &&
		process.env.CREATE_WORKER !== "true"
	) {
		// Vercel Cron Jobs will handle daily scraping at 6 AM
		// No need for in-memory scheduler - Vercel handles it externally

		// Graceful shutdown - use shared Prisma instance from lib/prisma.ts
		const { prisma } = await import("./lib/prisma");

		process.on("SIGTERM", () => {
			prisma.$disconnect();
		});

		process.on("SIGINT", () => {
			prisma.$disconnect();
		});
	}
};
