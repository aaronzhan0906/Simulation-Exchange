import express from "express";
import morgan from "morgan";
import userRoute from "../src/route/userRoute.js"
// import helmet from "helmet";


const app = express();

// middleware 
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// route
app.use("api/users", userRoute);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Internal Server Error")
})

// start 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;