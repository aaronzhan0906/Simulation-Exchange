import "express-async-errors";
import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import chalk from "chalk";
import path from "path";
import { createServer } from "http";
import { fileURLToPath } from "url";
import pino from "pino";
import pinoPretty from "pino-pretty";
import kafkaProducer from "./services/kafkaProducer.js";
import kafkaConsumer from "./services/kafkaConsumer.js";
import WebSocketService from "./services/websocketService.js";
import MarketMakerService from "./services/marketMakerService.js";
import favicon from "serve-favicon";
// helmet


const pretty = pinoPretty({
    colorize: true, 
    translateTime: true, 
});

const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
}, pretty);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));



app.use(favicon(path.join(__dirname, "..", "public", "favicon.ico")));
app.use(express.static(path.join(__dirname, "..", "..", "frontend")));

// html routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "frontend", "home.html"));
});

app.get("/wallet", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "frontend", "wallet.html"));
});

app.get("/history", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "frontend", "history.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "frontend", "login.html"));
});

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "frontend", "signup.html"));
});

// /trade/:pair 
app.get("/trade/:pair", (req, res) => {
    const { pair } = req.params;
    logger.info("Trading pair:", pair);
    res.sendFile(path.join(__dirname, "..", "..", "frontend", "trade.html"));
});

import homeRoute from "./routes/homeRoute.js";
import userRoute from "./routes/userRoute.js";
import walletRoute from "./routes/walletRoute.js";
import tradeRoute from "./routes/tradeRoute.js";
import historyRoute from "./routes/historyRoute.js";
import quoteService from "./services/quoteService.js";
// API routes
app.use("/api/home", homeRoute);
app.use("/api/user", userRoute);
app.use("/api/wallet", walletRoute);
app.use("/api/trade", tradeRoute);
app.use("/api/history", historyRoute);
app.use("/api/quote", quoteService);

// 404 handler
app.use((req, res) => {
    logger.warn({path: req.path}, "Route not found");
    res.status(404).json({
        error: true,
        message: "Route not found"
    });
});

// 500 // Custom error handling middleware
app.use((err, req, res, next) => {
    logger.error({
        err,
        path: req.path,
        message: err.message,
        stack: err.stack
    }, "An error occurred");

    res.status(500).json({
        error: true,
        message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
    });
});

// Morgan setup
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
      res.locals.responseBody = body;
      return originalJson.call(this, body);
    };
    next();
});

morgan.token("body", (req, res) => res.locals.responseBody ? JSON.stringify(res.locals.responseBody) : "No response body");
morgan.token("coloredStatus", (req, res) => {
    const status = res.statusCode;
    const colors = {
        5: chalk.bgRed,
        4: chalk.bgYellow,
        3: chalk.bgCyan,
        2: chalk.bgGreen
    };
    return (colors[Math.floor(status / 100)] || chalk.white)(status);
});

app.use(morgan((tokens, req, res) => {
    return [
        chalk.blue(tokens.method(req, res)),
        chalk.yellow(tokens.url(req, res)),
        tokens["coloredStatus"](req, res),
        chalk.green(tokens["response-time"](req, res) + " ms"),
        chalk.magenta("-"),
        chalk.cyan(tokens.body(req, res))
    ].join(" ");
}));

// Initialization function
export const initServices = () => {
    logger.info("Initializing services...");
    kafkaProducer.init();
    kafkaConsumer.init();
    WebSocketService.init(server);
    MarketMakerService.startPeriodicCleanup();
};

// Graceful shutdown function
export const gracefulShutdown = () => {
    return new Promise((resolve) => {
        WebSocketService.close();
        server.close(() => {
            logger.info("Server closed");
            resolve();
        });
    });
};

export { app, server, logger };