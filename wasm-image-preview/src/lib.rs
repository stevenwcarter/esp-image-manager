use anyhow::{Context, Result};
use image::{
    DynamicImage, ImageBuffer, ImageReader, Luma,
    imageops::{self, FilterType::Triangle},
};
use std::io::Cursor;
use wasm_bindgen::prelude::*;
use web_sys::console;
use web_time::Instant;

const WIDTH: u32 = 128;
const HEIGHT: u32 = 64;
const THRESHOLD: f32 = 128.0;

// Helper to log errors to the browser console
fn log_err(msg: &str) {
    console::log_1(&msg.into());
}

fn resize_and_pad(mut img: DynamicImage) -> Result<DynamicImage> {
    let start = Instant::now();

    // 1. Rotation Check
    if img.height() > img.width() {
        img = img.rotate270();
    }

    // 2. Resize to Fit
    let resized = img.resize(WIDTH, HEIGHT, Triangle);

    // 3. Create Black Canvas
    let mut canvas: ImageBuffer<Luma<u8>, Vec<u8>> =
        ImageBuffer::from_pixel(WIDTH, HEIGHT, Luma([0u8]));

    // 4. Calculate Offsets
    let x_offset = (WIDTH - resized.width()) / 2;
    let y_offset = (HEIGHT - resized.height()) / 2;

    // 5. Overlay
    imageops::overlay(
        &mut canvas,
        &resized.to_luma8(),
        x_offset as i64,
        y_offset as i64,
    );

    console::log_1(&format!("Resize and padding took: {:?}", start.elapsed()).into());
    Ok(DynamicImage::ImageLuma8(canvas))
}

fn convert_format_sync(image_data: Vec<u8>) -> Result<Vec<u8>> {
    let start = Instant::now();

    let cursor = Cursor::new(image_data);
    let img = ImageReader::new(cursor).with_guessed_format()?.decode()?;
    let img = resize_and_pad(img).context("could not resize")?;

    let dither_start = Instant::now();
    let gray_img = img.to_luma8();

    // Convert to f32 for dithering calculations
    let mut pixels: Vec<f32> = gray_img.pixels().map(|p| p.0[0] as f32).collect();
    let get_idx = |x: u32, y: u32| -> usize { (y * WIDTH + x) as usize };

    // Floyd-Steinberg Dithering
    for y in 0..HEIGHT - 1 {
        // Changed start from 1 to 0 to catch top edge
        for x in 1..WIDTH - 1 {
            let idx = get_idx(x, y);
            let old_pixel = pixels[idx];
            let new_pixel = if old_pixel < THRESHOLD { 0.0 } else { 255.0 };

            pixels[idx] = new_pixel;
            let quant_error = old_pixel - new_pixel;

            let idx_right = get_idx(x + 1, y);
            pixels[idx_right] += quant_error * 7.0 / 16.0;

            let idx_bottom_left = get_idx(x - 1, y + 1);
            pixels[idx_bottom_left] += quant_error * 3.0 / 16.0;

            let idx_bottom = get_idx(x, y + 1);
            pixels[idx_bottom] += quant_error * 5.0 / 16.0;

            let idx_bottom_right = get_idx(x + 1, y + 1);
            pixels[idx_bottom_right] += quant_error * 1.0 / 16.0;
        }
    }

    console::log_1(&format!("Dithering took: {:?}", dither_start.elapsed()).into());

    // Bit Packing
    let mut packed_buffer: Vec<u8> = Vec::with_capacity((WIDTH as usize * HEIGHT as usize) / 8);
    let mut current_byte: u8 = 0;
    let mut bit_index: usize = 0;

    for pixel in pixels {
        let bit = if pixel < 128.0 { 1 } else { 0 }; // 1 for black (oled usually), 0 for off
        current_byte |= bit << (7 - bit_index);
        bit_index += 1;

        if bit_index == 8 {
            packed_buffer.push(current_byte);
            current_byte = 0;
            bit_index = 0;
        }
    }

    // Push trailing byte if exists (unlikely with 128x64 but good safety)
    if bit_index > 0 {
        packed_buffer.push(current_byte);
    }

    console::log_1(&format!("Total conversion took: {:?}", start.elapsed()).into());
    Ok(packed_buffer)
}

#[wasm_bindgen]
pub async fn preview(image_data: Vec<u8>) -> Option<Vec<u8>> {
    // We don't need spawn_blocking.
    // Since this is CPU bound and short, we just run it.
    // The `async` keyword here mostly serves to wrap the return in a JS Promise.

    match convert_format_sync(image_data) {
        Ok(image) => Some(image),
        Err(e) => {
            log_err(&format!("Error generating preview: {:?}", e));
            None
        }
    }
}
