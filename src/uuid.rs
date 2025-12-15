use diesel::deserialize::{self, FromSql};
use diesel::serialize::{self, Output, ToSql};
use diesel::sql_types::Binary;
use diesel::sqlite::Sqlite;
use diesel::{AsExpression, FromSqlRow};
use std::fmt;
use std::fmt::{Display, Formatter};
use uuid::{self, Uuid};

#[derive(Debug, Clone, Copy, FromSqlRow, AsExpression, Hash, Eq, PartialEq)]
#[sql_type = "Binary"]
pub struct UUID(pub uuid::Uuid);

// Small function to easily initialize our uuid
impl UUID {
    pub fn random() -> Self {
        Self(uuid::Uuid::now_v7())
    }
}

// Allow easy conversion from UUID to the wanted uuid::Uuid
impl From<UUID> for uuid::Uuid {
    fn from(s: UUID) -> Self {
        s.0
    }
}
impl From<&Uuid> for UUID {
    fn from(s: &Uuid) -> Self {
        Self(*s)
    }
}

impl Display for UUID {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// Convert binary data from SQLite to a UUID
impl FromSql<Binary, Sqlite> for UUID {
    fn from_sql(bytes: diesel::backend::RawValue<'_, Sqlite>) -> deserialize::Result<Self> {
        let bytes = <*const [u8] as FromSql<Binary, Sqlite>>::from_sql(bytes)?;
        let bytes = unsafe { &*bytes };
        let uuid = uuid::Uuid::from_slice(bytes).map_err(|_| "Invalid UUID")?;
        Ok(UUID(uuid))
    }
}

// Convert UUID to binary data for SQLite
impl ToSql<Binary, Sqlite> for UUID {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Sqlite>) -> serialize::Result {
        <[u8] as ToSql<Binary, Sqlite>>::to_sql(self.0.as_bytes(), out)
    }
}
