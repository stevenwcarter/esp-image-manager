use super::db::SqlitePool;
use crate::svc::ScreensaverSvc;
use std::sync::Arc;

#[derive(Clone)]
pub struct GraphQLContext {
    pub pool: SqlitePool,
    pub screensaver: Option<Arc<ScreensaverSvc>>,
}

impl juniper::Context for GraphQLContext {}
