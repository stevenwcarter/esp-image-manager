use crate::{
    context::GraphQLContext,
    db::get_conn,
    get_env_typed,
    models::{DisplayFormat, Upload},
    schema::uploads,
    uuid::UUID,
};
use anyhow::{Context, Result};
use cached::proc_macro::cached;
use diesel::prelude::*;
use image::{ImageBuffer, ImageEncoder, ImageReader, Luma};
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
            .filter(uploads::public.eq(true))
            .select(Upload::as_select())
            .order_by(uploads::uuid.desc())
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

        // Notify screensaver of new upload
        if let Some(screensaver) = &context.screensaver {
            if let Err(e) = screensaver.on_new_upload(upload).await {
                tracing::warn!("Failed to notify screensaver of new upload: {}", e);
            }
        }

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

// convert our bit-packed upload data to a PNG file using the Image crate. Each bit represents a pixel: 0 = white, 1 =
// black. The dimensions are 128x64 pixels.
#[cached]
pub async fn packed_to_png(data: Vec<u8>) -> Vec<u8> {
    let width = 128;
    let height = 64;
    let mut img = ImageBuffer::new(width, height);

    for (i, byte) in data.iter().enumerate() {
        for bit in 0..8 {
            let pixel_index = i * 8 + bit;
            if pixel_index >= (width * height) as usize {
                break;
            }
            let x = (pixel_index as u32) % width;
            let y = (pixel_index as u32) / width;
            let color = if (byte >> (7 - bit)) & 1 == 1 {
                Luma([0u8]) // black
            } else {
                Luma([255u8]) // white
            };
            img.put_pixel(x, y, color);
        }
    }

    let mut png_data: Vec<u8> = Vec::new();
    {
        let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
        encoder
            .write_image(
                &img,
                img.width(),
                img.height(),
                image::ExtendedColorType::L8,
            )
            .context("Could not encode PNG")
            .unwrap_or_default();
    }

    png_data
}

pub async fn push_upload_to_device(upload: &Upload) -> Result<()> {
    let client = Client::new();
    if upload.display.as_deref() == Some(DisplayFormat::RGB320x240.as_str()) {
        let data = ImageReader::new(std::io::Cursor::new(upload.data.clone()));
        let img = data
            .with_guessed_format()
            .context("Could not guess image format")?
            .decode()
            .context("Could not decode image")?;

        client
            .post(get_env_typed("ESP_RGB_ENDPOINT", "".to_owned()))
            .body(img.to_rgb8().into_raw())
            .send()
            .await
            .context("Could not send to RGB device")?;
    } else {
        if upload.data.len() > 1025 {
            anyhow::bail!("Upload data too large to push to device");
        }

        client
            .post(get_env_typed("ESP_ENDPOINT", "".to_owned()))
            .body(upload.data.clone())
            .send()
            .await
            .context("Could not send to device")?;
    }

    Ok(())
}
