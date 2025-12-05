use juniper::{EmptySubscription, FieldError, FieldResult, RootNode};
use tracing::error;
use uuid::Uuid;

use crate::{
    context::GraphQLContext,
    models::{Upload, UploadInput},
    svc::UploadSvc,
};

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
