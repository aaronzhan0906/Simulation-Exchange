import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";
// import helmet from "helmet";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware 
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));


// static
app.use(express.static(path.join(__dirname, "..", "public")))
app.use(express.static(path.join(__dirname, "..", "public", "static")))


// route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname,".." ,"public","home.html"))
})

import userRoute from "./route/userRoute.js"
import quote from "./route/quote.js"
app.use("/api/user", userRoute);
app.use("api/quote", quote)



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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
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