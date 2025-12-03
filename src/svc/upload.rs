use crate::{context::GraphQLContext, db::get_conn, models::Upload, schema::uploads, uuid::UUID};
use anyhow::{Context, Result};
use diesel::prelude::*;
use uuid::Uuid;

pub struct UploadSvc {}

impl UploadSvc {
    pub fn get(context: &GraphQLContext, upload_uuid: Uuid) -> Result<Upload> {
        uploads::table
            .filter(uploads::uuid.eq(UUID::from(&upload_uuid)))
            // .select(Upload::as_select())
            .first(&mut get_conn(context))
            .context("Could not find upload")
    }
    pub fn list(context: &GraphQLContext, limit: i32, offset: i32) -> Result<Vec<Upload>> {
        let limit: i64 = limit.into();
        let offset: i64 = offset.into();

        uploads::table
            .select(Upload::as_select())
            .order_by(uploads::uuid.asc())
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

        Self::get(context, upload.uuid.into())
    }
    pub fn update(context: &GraphQLContext, upload: &Upload) -> Result<Upload> {
        diesel::update(uploads::table)
            .filter(uploads::uuid.eq(&upload.uuid))
            .set(upload)
            .execute(&mut get_conn(context))
            .context("Could not update upload")?;

        Self::get(context, upload.uuid.into())
    }
    pub fn delete(context: &GraphQLContext, upload_uuid: Uuid) -> Result<()> {
        diesel::delete(uploads::table)
            .filter(uploads::uuid.eq(UUID::from(&upload_uuid)))
            .execute(&mut get_conn(context))
            .context("Could not delete upload")?;

        Ok(())
    }
}
