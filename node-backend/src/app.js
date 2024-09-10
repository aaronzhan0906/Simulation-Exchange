import "express-async-errors";
import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import chalk from "chalk";
import path from "path";
import { createServer } from "http";
import { fileURLToPath } from "url";
import kafkaProducer from "./services/kafkaProducer.js";
import kafkaConsumer from "./services/kafkaConsumer.js";
import WebSocketService from "./services/websocketService.js";

// import helmet from "helmet";

// path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// app, server, wss
const app = express();
const server = createServer(app);


// middleware 
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// kafka init
kafkaProducer.init();
kafkaConsumer.init();

// websocket init
WebSocketService.init(server);


// static
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
    console.log("Trading pair:", pair);
    res.sendFile(path.join(__dirname, "..", "..", "frontend", "trade.html"));
});


// route
import homeRoute from "./routes/homeRoute.js";
import userRoute from "./routes/userRoute.js";
import walletRoute from "./routes/walletRoute.js";
import tradeRoute from "./routes/tradeRoute.js";
import historyRoute from "./routes/historyRoute.js";
app.use("/api/home", homeRoute);
app.use("/api/user", userRoute);
app.use("/api/wallet", walletRoute);
app.use("/api/trade", tradeRoute);
app.use("/api/history", historyRoute);


import quoteService from "./services/quoteService.js";
app.use("/api/quote", quoteService);



// 404 
app.use((req, res, next) => {
    res.status(404).json({
        error: true,
        message: "Route not found"
    });
});


// 500 // Custom error handling middleware
app.use((err, req, res, next) => {
    console.error(`Error occurred at path: ${req.path}`);
    console.error(`Error message: ${err.message}`);
    console.error(`Error stack: ${err.stack}`);
    
    res.status(500).json({
      error: true,
      message: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
    });
});


// start 
export default app;

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// close server gracefully
process.on("SIGINT", () => {
    WebSocketService.close();
    server.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});

// morgan 
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
      res.locals.responseBody = body;
      return originalJson.call(this, body);
    };
    next();
});

morgan.token("body", (req, res) => {
    if (res.locals.responseBody) {
      return JSON.stringify(res.locals.responseBody);
    }
    return "No response body";
});

morgan.token("coloredStatus", (req, res) => {
    const status = res.statusCode;
    let color;
    if (status >= 500) color = chalk.bgRed;
    else if (status >= 400) color = chalk.bgYellow;
    else if (status >= 300) color = chalk.bgCyan;
    else if (status >= 200) color = chalk.bgGreen;
    else color = chalk.white;
    
    return color(status);
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


export { app, server };
