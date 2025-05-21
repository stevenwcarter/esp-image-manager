// @generated automatically by Diesel CLI.

diesel::table! {
    uploads (id) {
        id -> Integer,
        message -> Nullable<Text>,
        data -> Binary,
        uploaded_at -> Nullable<Timestamp>,
    }
}
