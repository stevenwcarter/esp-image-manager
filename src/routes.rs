use crate::api::api_routes;
use crate::context::GraphQLContext;
use crate::graphql::{create_schema, Schema};

use axum::extract::{Request, WebSocketUpgrade};
use axum::http::HeaderValue;
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::{get, on, MethodFilter};
use axum::{Extension, Router};
use juniper_axum::extract::JuniperRequest;
use juniper_axum::response::JuniperResponse;
use juniper_axum::{graphiql, playground, subscriptions};
use juniper_graphql_ws::ConnectionConfig;
use reqwest::{header, Method};
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

pub fn app(context: Arc<GraphQLContext>) -> Router {
    let qm_schema = create_schema();

    let cors = CorsLayer::new()
        .allow_methods([Method::GET])
        .allow_headers(Any)
        .allow_methods(Any)
        .allow_origin(Any);

    let middleware = ServiceBuilder::new()
        .layer(cors)
        .layer(CompressionLayer::new());
    let graphql_routes = Router::new()
        .route(
            "/",
            on(MethodFilter::GET.or(MethodFilter::POST), custom_graphql),
        )
        .route("/subscriptions", get(custom_subscriptions))
        .route(
            "/graphiql",
            get(graphiql("/graphql", "/graphql/subscriptions")),
        )
        .route(
            "/playground",
            get(playground("/graphql", "/graphql/subscriptions")),
        )
        .route("/test", get(root))
        .layer(Extension(context.clone()))
        .layer(Extension(Arc::new(qm_schema)));

    let site_router = Router::new()
        .nest_service(
            "/assets",
            ServiceBuilder::new().service(ServeDir::new("site/build/assets")),
        )
        .layer(middleware::from_fn(set_static_cache_control))
        .nest_service(
            "/",
            ServeDir::new("site/build").not_found_service(ServeFile::new("site/build/index.html")),
        );

    Router::new()
        .nest("/graphql", graphql_routes)
        .nest("/api/v1", api_routes(context.clone()))
        .nest("/", site_router)
        .layer(Extension(context.clone()))
        .layer(middleware)
}

async fn root() -> &'static str {
    "Hello world!"
}

#[axum::debug_handler]
async fn custom_subscriptions(
    Extension(schema): Extension<Arc<Schema>>,
    Extension(context): Extension<GraphQLContext>,
    ws: WebSocketUpgrade,
) -> Response {
    ws.protocols(["graphql-transport-ws", "graphql-ws"])
        .on_upgrade(move |socket| {
            let connection_config =
                ConnectionConfig::new(context.clone()).with_max_in_flight_operations(10);
            subscriptions::serve_ws(socket, schema, connection_config)
        })
}

#[axum::debug_handler]
async fn custom_graphql(
    Extension(schema): Extension<Arc<Schema>>,
    Extension(context): Extension<GraphQLContext>,
    JuniperRequest(request): JuniperRequest,
) -> JuniperResponse {
    JuniperResponse(request.execute(&*schema, &context).await)
}

async fn set_static_cache_control(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000"),
    );
    response
}
