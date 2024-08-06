import dotenv from "dotenv";
dotenv.config();

const config = {
    env: process.env.NODE_ENV,
    port: process.env.PORT,

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
    ssl: {
        key: process.env.SSL_KEY_PATH,
        cert: process.env.SSL_CERT_PATH,
    },

    // Kafka 
    kafka: {
        clientId: process.env.KAFKA_CLIENT_ID,
        brokers: process.env.KAFKA_BROKERS.split(','), 
        groupId: process.env.KAFKA_GROUP_ID,
    },

    // snowflake
    snowflake: {
        instanceId: process.env.SNOWFLAKE_INSTANCE_ID,
        customEpoch: process.env.SNOWFLAKE_CUSTOM_EPOCH,
    },
};

export default config;