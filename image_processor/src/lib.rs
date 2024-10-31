// src/lib.rs

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use image::{DynamicImage, ImageBuffer, ExtendedColorType, ImageEncoder};
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use serde_wasm_bindgen::to_value;

#[derive(Serialize, Deserialize)]
pub struct Metadata {
    width: u32,
    height: u32,
    channels: u8,
}

#[derive(Serialize, Deserialize)]
pub struct OutputInfo {
    width: u32,
    height: u32,
    channels: u8,
}

#[derive(Serialize, Deserialize)]
pub struct IAssembledImageData {
    data: Vec<u8>,
    info: OutputInfo,
    meta: Metadata,
}

#[wasm_bindgen]
pub fn load_image_raw(png_data: &[u8]) -> Vec<u8> {
    let img = image::load_from_memory(png_data).unwrap_or_else(|_| DynamicImage::new_rgb8(1,1));
    let rgb_img = img.to_rgb8();
    rgb_img.into_raw()
}

#[wasm_bindgen]
pub fn get_image_metadata(png_data: &[u8]) -> JsValue {
    // Load the image from the input bytes
    let img = image::load_from_memory(png_data).unwrap_or_else(|_| DynamicImage::new_rgb8(1,1));

    // Remove alpha channel by converting to RGB
    let rgb_img = img.to_rgb8();

    // Get metadata
    let metadata = Metadata {
        width: rgb_img.width(),
        height: rgb_img.height(),
        channels: 3, // RGB
    };
    to_value(&metadata).unwrap()
}

#[wasm_bindgen]
pub fn write_image_data(
    raw_data: &[u8],
    width: u32,
    height: u32,
    compression_level: u8,
    adaptive_filtering: bool,
) -> Vec<u8> {
    let img_buffer = ImageBuffer::from_raw(width, height, raw_data.to_vec())
        .expect("Failed to create ImageBuffer");

    let img = DynamicImage::ImageRgb8(img_buffer);

    // Encode as PNG with specified configuration
    let mut buffer = Vec::new();

    let compression = match compression_level {
        0..=3 => CompressionType::Fast,
        4..=6 => CompressionType::Default,
        7..=9 => CompressionType::Best,
        _ => CompressionType::Default, // Fallback for unexpected values
    };

    let png_encoder = PngEncoder::new_with_quality(
        &mut buffer,
        compression,
        if adaptive_filtering { FilterType::Adaptive } else { FilterType::NoFilter },
    );

    png_encoder.write_image(
        &img.to_rgb8(),
        width,
        height,
        ExtendedColorType::Rgb8,
    ).expect("Failed to encode PNG");

    buffer
}
