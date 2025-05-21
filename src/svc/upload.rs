use crate::{context::GraphQLContext, db::get_conn, models::Upload, schema::uploads};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct UploadSvc {}

impl UploadSvc {
    pub fn get(context: &GraphQLContext, upload_id: i32) -> Result<Upload> {
        uploads::table
            .filter(uploads::id.eq(upload_id))
            // .select(Upload::as_select())
            .first(&mut get_conn(context))
            .context("Could not find upload")
    }
    pub fn list(context: &GraphQLContext, limit: i32, offset: i32) -> Result<Vec<Upload>> {
        let limit: i64 = limit.into();
        let offset: i64 = offset.into();

        uploads::table
            .select(Upload::as_select())
            .order_by(uploads::id.asc())
            .limit(limit)
            .offset(offset)
            .load::<Upload>(&mut get_conn(context))
            .context("Could not load uploads")
    }
    pub fn create(context: &GraphQLContext, upload: &Upload) -> Result<Upload> {
        diesel::insert_into(uploads::table)
            .values(upload)
            .execute(&mut get_conn(context))
            .context("Could not update upload")?;

        Self::get(context, upload.id)
    }
    pub fn update(context: &GraphQLContext, upload: &Upload) -> Result<Upload> {
        diesel::update(uploads::table)
            .filter(uploads::id.eq(&upload.id))
            .set(upload)
            .execute(&mut get_conn(context))
            .context("Could not update upload")?;

        Self::get(context, upload.id)
    }
    pub fn delete(context: &GraphQLContext, upload_id: i32) -> Result<()> {
        diesel::delete(uploads::table)
            .filter(uploads::id.eq(upload_id))
            .execute(&mut get_conn(context))
            .context("Could not delete upload")?;

        Ok(())
    }
}
