// @generated automatically by Diesel CLI.

diesel::table! {
    uploads (uuid) {
        uuid -> Binary,
        message -> Nullable<Text>,
        data -> Binary,
        public -> Bool,
        uploaded_at -> Nullable<Timestamp>,
        name -> Nullable<Text>,
    }
}
