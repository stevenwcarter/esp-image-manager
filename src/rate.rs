use crate::{
    context::GraphQLContext, db::get_conn, models::Rate, product::ProductSvc, schema::rate,
};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct RateSvc {}

impl RateSvc {
    pub fn list(context: &GraphQLContext) -> Result<Vec<Rate>> {
        let conn = &mut get_conn(context);

        rate::table
            .load::<Rate>(conn)
            .context("Could not load rates")
    }
    pub fn list_for_product(context: &GraphQLContext, product_id: &str) -> Result<Vec<Rate>> {
        let conn = &mut get_conn(context);

        rate::table
            .filter(rate::product_id.eq(product_id))
            .load::<Rate>(conn)
            .context("Could not load rates")
    }
    pub fn get(context: &GraphQLContext, rate_uuid: &str) -> Result<Rate> {
        let conn = &mut get_conn(context);

        rate::table
            .filter(rate::rate_id.eq(rate_uuid))
            .first(conn)
            .context("Could not find rate")
    }

    pub fn update(context: &GraphQLContext, rate: &Rate) -> Result<Rate> {
        ProductSvc::get(context, &rate.product_id).context("Product does not exist")?;

        let conn = &mut get_conn(context);

        diesel::replace_into(rate::table)
            .values(rate)
            .execute(conn)
            .context("Could not update rate")?;

        Self::get(context, rate.rate_id.as_str())
    }
    pub fn delete_for_product(context: &GraphQLContext, product_uuid: &str) -> Result<()> {
        let conn = &mut get_conn(context);

        diesel::delete(rate::table)
            .filter(rate::product_id.eq(product_uuid))
            .execute(conn)
            .context("could not delete rate")?;

        Ok(())
    }
    pub fn delete(context: &GraphQLContext, rate_uuid: &str) -> Result<()> {
        let conn = &mut get_conn(context);

        diesel::delete(rate::table)
            .filter(rate::rate_id.eq(rate_uuid))
            .execute(conn)
            .context("could not delete rate")?;

        Ok(())
    }
}
