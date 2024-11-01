// src/lib.rs

use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageBuffer, ExtendedColorType, ImageEncoder};
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use js_sys::Uint8Array;
use wee_alloc::WeeAlloc;

#[global_allocator]
static ALLOC: WeeAlloc = WeeAlloc::INIT;


/// Metadata about the image.
#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Metadata {
    width: u32,
    height: u32,
    channels: u8,
}

#[wasm_bindgen]
impl Metadata {
    /// Gets the width of the image.
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Gets the height of the image.
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Gets the number of channels in the image.
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u8 {
        self.channels
    }
}

/// Assembled image data including raw pixels and metadata.
#[wasm_bindgen]
pub struct AssembledImageData {
    data: Vec<u8>,
    metadata: Metadata,
}

#[wasm_bindgen]
impl AssembledImageData {
    /// Retrieves the raw image data as a Uint8Array.
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Uint8Array {
        // Transfer ownership of data to JS without copying
        Uint8Array::from(&self.data[..])
    }

    /// Retrieves the image metadata.
    #[wasm_bindgen(getter)]
    pub fn metadata(&self) -> Metadata {
        self.metadata.clone()
    }
}

/// Loads image data from PNG bytes, processes it, and returns assembled image data.
#[wasm_bindgen]
pub fn load_image_assembled(png_data: &[u8]) -> AssembledImageData {
    // Attempt to load the image from memory with specified format to speed up loading.
    let img = image::load_from_memory_with_format(png_data, image::ImageFormat::Png)
        .unwrap_or_else(|_| DynamicImage::new_rgb8(1, 1));
    let rgb_img = img.to_rgb8();

    // Construct Metadata.
    let metadata = Metadata {
        width: rgb_img.width(),
        height: rgb_img.height(),
        channels: 3, // RGB
    };

    // Assemble the image data.
    AssembledImageData {
        data: rgb_img.into_raw(),
        metadata,
    }
}

/// Writes image data to PNG bytes with specified configurations.
#[wasm_bindgen]
pub fn write_image_data(
    raw_data: Vec<u8>, // Take ownership to avoid cloning
    width: u32,
    height: u32,
    compression_level: u8,
) -> Uint8Array {
    // Create an ImageBuffer from the raw data without cloning
    let img_buffer = ImageBuffer::from_raw(width, height, raw_data)
        .expect("Failed to create ImageBuffer");

    let img = DynamicImage::ImageRgb8(img_buffer);

    // Initialize a buffer with a reasonable capacity
    let mut buffer = Vec::with_capacity((width * height * 3) as usize);

    // Determine the compression type based on the compression_level
    let compression = match compression_level {
        0..=3 => CompressionType::Fast,     // Fastest compression
        4..=6 => CompressionType::Default,  // Balanced compression
        7..=9 => CompressionType::Best,     // Highest compression
        _ => CompressionType::Fast,          // Default to fast if out of range
    };

    // Use a simpler filter type for faster encoding
    let png_encoder = PngEncoder::new_with_quality(&mut buffer, compression, FilterType::NoFilter);

    // Write the image to the buffer
    png_encoder
        .write_image(&img.to_rgb8(), width, height, ExtendedColorType::Rgb8)
        .expect("Failed to encode PNG");

    // Transfer ownership to JS without copying
    Uint8Array::from(&buffer[..])
}
