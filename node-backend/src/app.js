import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import chalk from "chalk";
import path from "path";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { WebSocketServer } from 'ws';
// import helmet from "helmet";
import kafkaProducer from "./services/kafkaProducer.js";
import kafkaConsumer from "./services/kafkaConsumer.js";


// path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// app, server, wss
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// health 
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK" });
  });

// middleware 
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// kafka
kafkaProducer.init();
kafkaConsumer.init();
process.on('SIGINT', async () => {
    try {
        await kafkaProducer.disconnect();
        console.log('Server gracefully shut down');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// static
app.use(express.static(path.join(__dirname,"..", "..", "public")))
// html 
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname,"..",".." ,"public","home.html"))
})
app.get("/trade", (req, res) => {
    res.sendFile(path.join(__dirname,"..",".." ,"public","trade.html"))
})
app.get("/wallet", (req, res) => {
    res.sendFile(path.join(__dirname,"..",".." ,"public","wallet.html"))
})
app.get("/history", (req, res) => {
    res.sendFile(path.join(__dirname,"..",".." ,"public","history.html"))
})
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname,"..",".." ,"public","login.html"))
})
app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname,"..", ".." ,"public","signup.html"))
})

// route
import userRoute from "./routes/userRoute.js";
import quoteRoute from "./routes/quoteRoute.js";
import walletRoute from "./routes/walletRoute.js";
import tradeRoute from "./routes/tradeRoute.js";
import historyRoute from "./routes/historyRoute.js";
app.use("/api/user", userRoute);
app.use("/api/quote", quoteRoute);
app.use("/api/wallet", walletRoute);
app.use("/api/trade", tradeRoute);
app.use("/api/history", historyRoute);



// 404 
app.use((req, res, next) => {
    res.status(404).json({
        error: true,
        message: "Route not found"
    });
});


// 500 internal server error
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
});


// start 
export default app;

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    wss.on("connection",(ws, req) => {
        console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);

        ws.on("message", (message) => {
            console.log("Received", message.toString());
        })

        ws.on("close", (code, reason) => {
            console.log(`WebSocket disconnected: ${code}- ${reason}`)
        });

        ws.send(JSON.stringify({type:"welcome", message: "Welcome to the WebSocket server!"}));
    })

    wss.on("error", (error) => {
        console.error("WebSocket server error:", error)
    })
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


export { server, wss };