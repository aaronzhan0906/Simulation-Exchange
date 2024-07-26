import express from "express";
import morgan from "morgan";
import userRoute from "../src/route/userRoute.js"
import path from "path";
import { fileURLToPath } from "url";
// import helmet from "helmet";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware 
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static
app.get(express.static(path.join(__dirname, "static")))

// route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname,"..","public","home.html"))
})

app.use("api/users", userRoute);


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