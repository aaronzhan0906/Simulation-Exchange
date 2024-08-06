import { Snowflake } from "nodejs-snowflake";

const snowflake = new Snowflake({
    instance_id: parseInt(process.env.SNOWFLAKE_INSTANCE_ID),
    custom_epoch: parseInt(process.env.SNOWFLAKE_CUSTOM_EPOCH)
});

export function generateSnowflakeId() {
    return snowflake.getUniqueID();
}