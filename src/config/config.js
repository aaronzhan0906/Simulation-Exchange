import dotenv from "dotenv";
dotenv.config();

const config = {
    server: {
        port: process.env.PORT,
    },

    database:{
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    },

    jwt: {
        accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
        refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
        accessTokenLife: process.env.ACCESS_TOKEN_LIFE ,
        refreshTokenLife: process.env.REFRESH_TOKEN_LIFE ,
    },
    
}

export default config;