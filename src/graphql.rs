use juniper::{EmptySubscription, FieldError, FieldResult, GraphQLObject, RootNode};
use tracing::error;
use uuid::Uuid;

use crate::{
    context::GraphQLContext,
    models::{Upload, UploadInput},
    svc::UploadSvc,
};

#[derive(GraphQLObject)]
pub struct ScreensaverStatus {
    is_running: bool,
    current_index: i32,
    upload_count: i32,
    interval_seconds: i32,
}

pub struct Query;

#[juniper::graphql_object(context = GraphQLContext)]
impl Query {
    // Uploads
    pub async fn get_upload(context: &GraphQLContext, upload_uuid: Uuid) -> FieldResult<Upload> {
        graphql_translate_anyhow(UploadSvc::get(context, upload_uuid))
    }
    pub fn list_uploads(
        context: &GraphQLContext,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> FieldResult<Vec<Upload>> {
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);
        graphql_translate_anyhow(UploadSvc::list(context, limit, offset))
    }

    // Screensaver status
    pub async fn screensaver_status(context: &GraphQLContext) -> FieldResult<ScreensaverStatus> {
        if let Some(screensaver) = &context.screensaver {
            let state = screensaver.get_state().await;
            Ok(ScreensaverStatus {
                is_running: state.is_running,
                current_index: state.current_index as i32,
                upload_count: state.upload_count as i32,
                interval_seconds: state.interval_seconds as i32,
            })
        } else {
            Err(FieldError::new(
                "Screensaver service not available",
                juniper::Value::Null,
            ))
        }
    }
}

pub struct Mutation;

#[juniper::graphql_object(context = GraphQLContext)]
impl Mutation {
    // Uploads
    pub async fn create_upload(
        context: &GraphQLContext,
        upload: UploadInput,
    ) -> FieldResult<Upload> {
        graphql_translate_anyhow(UploadSvc::create(context, &upload.into()).await)
    }

    // Screensaver controls
    pub async fn pause_screensaver(context: &GraphQLContext) -> FieldResult<bool> {
        if let Some(screensaver) = &context.screensaver {
            graphql_translate_anyhow(screensaver.pause().await)?;
            Ok(true)
        } else {
            Err(FieldError::new(
                "Screensaver service not available",
                juniper::Value::Null,
            ))
        }
    }

    pub async fn resume_screensaver(context: &GraphQLContext) -> FieldResult<bool> {
        if let Some(screensaver) = &context.screensaver {
            graphql_translate_anyhow(screensaver.resume().await)?;
            Ok(true)
        } else {
            Err(FieldError::new(
                "Screensaver service not available",
                juniper::Value::Null,
            ))
        }
    }

    pub async fn next_image(context: &GraphQLContext) -> FieldResult<bool> {
        if let Some(screensaver) = &context.screensaver {
            graphql_translate_anyhow(screensaver.advance_to_next_image().await)?;
            Ok(true)
        } else {
            Err(FieldError::new(
                "Screensaver service not available",
                juniper::Value::Null,
            ))
        }
    }

    pub async fn previous_image(context: &GraphQLContext) -> FieldResult<bool> {
        if let Some(screensaver) = &context.screensaver {
            graphql_translate_anyhow(screensaver.go_to_previous_image().await)?;
            Ok(true)
        } else {
            Err(FieldError::new(
                "Screensaver service not available",
                juniper::Value::Null,
            ))
        }
    }

    pub async fn set_screensaver_interval(
        context: &GraphQLContext,
        seconds: i32,
    ) -> FieldResult<bool> {
        if let Some(screensaver) = &context.screensaver {
            if seconds <= 0 {
                return Err(FieldError::new(
                    "Interval must be positive",
                    juniper::Value::Null,
                ));
            }
            graphql_translate_anyhow(screensaver.set_interval(seconds as u64).await)?;
            Ok(true)
        } else {
            Err(FieldError::new(
                "Screensaver service not available",
                juniper::Value::Null,
            ))
        }
    }
}

pub type Schema = RootNode<Query, Mutation, EmptySubscription<GraphQLContext>>;
pub fn create_schema() -> Schema {
    Schema::new(Query, Mutation, EmptySubscription::new())
}

pub fn graphql_translate_anyhow<T>(res: anyhow::Result<T>) -> FieldResult<T> {
    match res {
        Ok(t) => Ok(t),
        Err(e) => {
            error!("Could not upload: {:?}", e);
            Err(FieldError::from(e))
        }
    }
}
