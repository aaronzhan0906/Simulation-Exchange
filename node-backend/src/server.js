import { server, logger, initServices, gracefulShutdown } from './app.js';

const PORT = process.env.PORT || 3000;

initServices();

server.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});

process.on("SIGINT", async () => {
    logger.info("Start to Shutting down gracefully...");
    await gracefulShutdown();
    logger.info("Shutting down gracefully.");
    process.exit(0);
}); 