import express from "express";
import morgan from "morgan";
import chalk from "chalk";
import userRoute from "./route/userRoute.js"
import path from "path";
import { fileURLToPath } from "url";
// import helmet from "helmet";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// morgan 
morgan.token('body', (req, res) => JSON.stringify(res.locals.responseBody));
morgan.token('coloredStatus', (req, res) => {
  const status = res.statusCode;
  const color = status >= 500 ? 'red' : 
                status >= 400 ? 'yellow' : 
                status >= 300 ? 'cyan' : 
                status >= 200 ? 'green' : 'white';
  return chalk[color](status);
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

// static
app.use(express.static(path.join(__dirname, "..", "public", "static")))


// route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname,".." ,"public","home.html"))
})

app.use("/api/user", userRoute);

// 404 
app.use((req, res, next) => {
  res.status(404).send("Sorry, can't find that!");
});


// 500 internal server error
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Internal Server Error")
})

// start 
const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;