use anyhow::{Context, Result};
use image::{
    DynamicImage, ImageBuffer, ImageReader, Luma,
    imageops::{self, FilterType::Triangle},
};
use std::io::Cursor;
use wasm_bindgen::prelude::*;
use web_sys::console;

const WIDTH: u32 = 128;
const HEIGHT: u32 = 64;
const THRESHOLD: f32 = 128.0;

// Import the `window.alert` function from the Web.
#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

// Export a `greet` function from Rust to JavaScript, that alerts a
// hello message.
#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&format!("Hello, {}!", name));
}

fn resize_and_pad(mut img: DynamicImage) -> Result<DynamicImage> {
    // 1. Rotation Check
    // If height > width, it is a portrait image.
    // Rotate -90 degrees (270 clockwise) to make it landscape.
    if img.height() > img.width() {
        img = img.rotate270();
    }

    // 2. Resize to Fit
    // .resize() scales the image down until it fits ENTIRELY within the bounds.
    // It preserves the aspect ratio and does NOT crop.
    let resized = img.resize(WIDTH, HEIGHT, Triangle);

    // 3. Create a Black Canvas
    // We create a new Luma8 buffer filled with 0 (Black).
    // Note: We force Luma8 here because "black" is ambiguous in RGBA
    // without defining alpha, and your end goal is monochrome.
    let mut canvas: ImageBuffer<Luma<u8>, Vec<u8>> =
        ImageBuffer::from_pixel(WIDTH, HEIGHT, Luma([0u8]));

    // 4. Calculate Centering Offsets
    // These defaults to 0 if the dimension matches perfectly.
    let x_offset = (WIDTH - resized.width()) / 2;
    let y_offset = (HEIGHT - resized.height()) / 2;

    // 5. Overlay
    // We overlay the resized image onto the black canvas.
    // We convert resized to luma8 ensures the pixel types match the canvas.
    imageops::overlay(
        &mut canvas,
        &resized.to_luma8(),
        x_offset as i64,
        y_offset as i64,
    );

    // Return as DynamicImage to maintain compatibility with the rest of your pipeline
    Ok(DynamicImage::ImageLuma8(canvas))
}

#[wasm_bindgen]
pub fn preview(image_data: Vec<u8>) -> Vec<u8> {
    match convert_format(image_data) {
        Ok(image) => image,
        Err(e) => {
            let message = format!("Error generating preview: {:?}", e);
            console::log_1(&message.as_str().into());
            Vec::new()
        }
    }
}

fn convert_format(image_data: Vec<u8>) -> Result<Vec<u8>> {
    let cursor = Cursor::new(image_data);
    let img = ImageReader::new(cursor).with_guessed_format()?.decode()?;
    let img = resize_and_pad(img).context("could not resize")?;

    let gray_img = img.to_luma8();

    let mut pixels: Vec<f32> = gray_img.pixels().map(|p| p.0[0] as f32).collect();

    let get_idx = |x: u32, y: u32| -> usize { (y * WIDTH + x) as usize };

    for y in 0..HEIGHT {
        for x in 0..WIDTH {
            let idx = get_idx(x, y);
            let old_pixel = pixels[idx];

            let new_pixel = if old_pixel < THRESHOLD { 0.0 } else { 255.0 };

            pixels[idx] = new_pixel;

            let quant_error = old_pixel - new_pixel;

            if x + 1 < WIDTH {
                let idx_right = get_idx(x + 1, y);
                pixels[idx_right] += quant_error * 7.0 / 16.0;
            }
            if x > 0 && y + 1 < HEIGHT {
                let idx_bottom_left = get_idx(x - 1, y + 1);
                pixels[idx_bottom_left] += quant_error * 3.0 / 16.0;
            }
            if y + 1 < HEIGHT {
                let idx_bottom = get_idx(x, y + 1);
                pixels[idx_bottom] += quant_error * 5.0 / 16.0;
            }
            if x + 1 < WIDTH && y + 1 < HEIGHT {
                let idx_bottom_right = get_idx(x + 1, y + 1);
                pixels[idx_bottom_right] += quant_error * 1.0 / 16.0;
            }
        }
    }

    let mut packed_buffer: Vec<u8> = Vec::with_capacity((WIDTH as usize * HEIGHT as usize) / 8);

    let mut current_byte: u8 = 0;
    let mut bit_index: usize = 0;

    for pixel in pixels {
        let bit = if pixel < 128.0 { 1 } else { 0 };
        current_byte |= bit << (7 - bit_index);
        bit_index += 1;

        if bit_index == 8 {
            packed_buffer.push(current_byte);
            current_byte = 0;
            bit_index = 0;
        }
    }

    Ok(packed_buffer)
}
