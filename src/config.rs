use crate::context::GraphQLContext;
use crate::db::get_conn;
use crate::schema::config;
use diesel::prelude::*;
use std::str::FromStr;

#[derive(Queryable, Insertable, Selectable, Debug)]
#[diesel(table_name = config)]
pub struct Config {
    pub key: Option<String>,
    pub value: String,
}

#[derive(Insertable)]
#[diesel(table_name = config)]
pub struct NewConfig<'a> {
    pub key: &'a str,
    pub value: &'a str,
}

pub struct ConfigSvc;

impl ConfigSvc {
    /// Get a configuration value by key, returning the provided default if not found
    pub async fn get_config_value(
        ctx: &GraphQLContext,
        key: &str,
        default_value: &str,
    ) -> Result<String, diesel::result::Error> {
        let mut conn = get_conn(ctx);

        let result = config::table
            .filter(config::key.eq(key))
            .first::<Config>(&mut conn)
            .optional()?;

        Ok(result
            .map(|config| config.value)
            .unwrap_or_else(|| default_value.to_owned()))
    }

    /// Set a configuration value
    pub async fn set_config_value(
        ctx: &GraphQLContext,
        key: &str,
        value: &str,
    ) -> Result<(), diesel::result::Error> {
        let mut conn = get_conn(ctx);

        let new_config = NewConfig { key, value };

        diesel::insert_into(config::table)
            .values(&new_config)
            .on_conflict(config::key)
            .do_update()
            .set(config::value.eq(value))
            .execute(&mut conn)?;

        Ok(())
    }

    /// Get screensaver interval in seconds, defaults to 120 seconds
    pub async fn get_screensaver_interval(
        ctx: &GraphQLContext,
    ) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        let value = Self::get_config_value(ctx, "screensaver.interval", "120").await?;
        let seconds = u64::from_str(&value)?;
        Ok(seconds)
    }

    /// Set screensaver interval in seconds
    pub async fn set_screensaver_interval(
        ctx: &GraphQLContext,
        seconds: u64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Self::set_config_value(ctx, "screensaver.interval", &seconds.to_string()).await?;
        Ok(())
    }
}

