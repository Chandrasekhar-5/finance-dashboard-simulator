import { env } from "node:process";
import app from "./app.js";
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();
const PORT = env.PORT || 5000;


const server = app.listen(PORT, () => {
    console.log(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
});


const shutdown = async (signal: string) => {
    console.log(`\n ${signal} recieved. Shutting down gracefully...`);


    server.close(async () => {
        console.log('HTTP server closed');
        await prisma.$disconnect();
        console.log('Database connection closed');
        process.exit(0);
    });
}

process.on('SIGINT', () => { shutdown('SIGINT') });
process.on('SIGTERM', () => { shutdown('SIGTERM') });