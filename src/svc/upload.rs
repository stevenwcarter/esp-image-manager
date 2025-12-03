use crate::{
    context::GraphQLContext, db::get_conn, get_env_typed, models::Upload, schema::uploads,
    uuid::UUID,
};
use anyhow::{Context, Result};
use diesel::prelude::*;
use reqwest::Client;
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
    pub async fn create(context: &GraphQLContext, upload: &Upload) -> Result<Upload> {
        diesel::insert_into(uploads::table)
            .values(upload)
            .execute(&mut get_conn(context))
            .context("Could not update upload")?;

        push_upload_to_device(upload).await?;

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

pub async fn push_upload_to_device(upload: &Upload) -> Result<()> {
    let client = Client::new();
    if upload.data.len() > 1025 {
        anyhow::bail!("Upload data too large to push to device");
    }

    client
        .post(get_env_typed("ESP_ENDPOINT", "".to_owned()))
        .body(upload.data.clone())
        .send()
        .await
        .context("Could not send to device")?;

    Ok(())
}
