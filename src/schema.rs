// @generated automatically by Diesel CLI.

diesel::table! {
    config (key) {
        key -> Nullable<Text>,
        value -> Text,
    }
}

diesel::table! {
    uploads (uuid) {
        uuid -> Binary,
        message -> Nullable<Text>,
        data -> Binary,
        public -> Bool,
        uploaded_at -> Nullable<Timestamp>,
        name -> Nullable<Text>,
        display -> Nullable<Text>,
    }
}

diesel::allow_tables_to_appear_in_same_query!(config, uploads,);
