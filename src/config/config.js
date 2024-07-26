import dotenv from "dotenv";
dotenv.config();

const config = {
    server: {
        port: process.env.PORT,
    },

    database: {
        host: process.env.MYSQL_HOST,      
        port: process.env.MYSQL_PORT,      
        user: process.env.MYSQL_USER,      
        password: process.env.MYSQL_PASSWORD, 
        database: process.env.MYSQL_DATABASE, 
    },

    jwt: {
        accessTokenSecret: process.env.JWT_ACCESS_SECRET,  
        refreshTokenSecret: process.env.JWT_REFRESH_SECRET, 
        accessTokenLife: process.env.ACCESS_TOKEN_EXPIRY,   
        refreshTokenLife: process.env.REFRESH_TOKEN_EXPIRY,
    },
}

export default config;