use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub(crate) struct RawPdfImage {
    pub(crate) file_path: PathBuf,
    pub(crate) width: u32,
    pub(crate) height: u32,
}

impl RawPdfImage {
    pub(crate) fn area(&self) -> u64 {
        self.width as u64 * self.height as u64
    }
}

pub(crate) fn extract_pdf_images(pdf_path: &Path, output_dir: &Path) -> Vec<RawPdfImage> {
    use lopdf::Object;
    let doc = match lopdf::Document::load(pdf_path) {
        Ok(doc) => doc,
        Err(_) => return Vec::new(),
    };
    let soft_mask_oids = collect_soft_mask_oids(&doc);
    let mut image_oids = doc
        .objects
        .iter()
        .filter_map(|(oid, object)| {
            if soft_mask_oids.contains(oid) {
                return None;
            }
            if let Object::Stream(stream) = object {
                let is_image = stream
                    .dict
                    .get(b"Subtype")
                    .map(|item| matches!(item, Object::Name(name) if name.as_slice() == b"Image"))
                    .unwrap_or(false);
                let is_mask = stream
                    .dict
                    .get(b"ImageMask")
                    .map(|item| matches!(item, Object::Boolean(true)))
                    .unwrap_or(false);
                (is_image && !is_mask).then_some(*oid)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    image_oids.sort();

    let mut results = Vec::new();
    for (scanned, oid) in image_oids.into_iter().enumerate() {
        if scanned >= 500 || results.len() >= 40 {
            break;
        }
        let stream = match doc.objects.get(&oid) {
            Some(Object::Stream(stream)) => stream,
            _ => continue,
        };
        let width = match stream.dict.get(b"Width") {
            Ok(Object::Integer(n)) => *n as u32,
            _ => 0,
        };
        let height = match stream.dict.get(b"Height") {
            Ok(Object::Integer(n)) => *n as u32,
            _ => 0,
        };
        if width < 120 || height < 120 {
            continue;
        }

        if stream_has_filter(stream, b"DCTDecode") {
            let file_path = output_dir.join(format!("embedded_{scanned:03}.jpg"));
            if std::fs::write(&file_path, &stream.content).is_ok() {
                results.push(RawPdfImage {
                    file_path,
                    width,
                    height,
                });
            }
            continue;
        }

        if !stream_has_filter(stream, b"FlateDecode") {
            continue;
        }
        let bits = match stream.dict.get(b"BitsPerComponent") {
            Ok(Object::Integer(n)) => *n as u32,
            _ => 8,
        };
        if bits != 8 {
            continue;
        }
        let channels = colorspace_channels(stream, &doc);
        if channels != 1 && channels != 3 {
            continue;
        }
        let raw = match zlib_decompress(&stream.content) {
            Some(value) => value,
            None => continue,
        };
        let predictor = match stream.dict.get(b"DecodeParms") {
            Ok(Object::Dictionary(dict)) => match dict.get(b"Predictor") {
                Ok(Object::Integer(n)) => *n,
                _ => 1,
            },
            _ => 1,
        };
        let pixels = if predictor >= 10 {
            apply_png_predictor(&raw, width, channels)
        } else {
            raw
        };
        let expected = (width * height * channels) as usize;
        if pixels.len() < expected {
            continue;
        }
        let pixel_data = pixels[..expected].to_vec();
        let file_path = output_dir.join(format!("embedded_{scanned:03}.png"));
        let saved = if channels == 1 {
            image::GrayImage::from_raw(width, height, pixel_data)
                .map(|image| image.save(&file_path).is_ok())
                .unwrap_or(false)
        } else {
            image::RgbImage::from_raw(width, height, pixel_data)
                .map(|image| image.save(&file_path).is_ok())
                .unwrap_or(false)
        };
        if saved {
            results.push(RawPdfImage {
                file_path,
                width,
                height,
            });
        }
    }

    results
}

pub(crate) fn is_likely_paper_figure_image(image: &RawPdfImage) -> bool {
    if image.width < 160 || image.height < 120 {
        return false;
    }
    if image.area() < 45_000 {
        return false;
    }
    let aspect = image.width as f32 / image.height as f32;
    aspect > 0.22 && aspect < 5.2
}

fn collect_soft_mask_oids(doc: &lopdf::Document) -> HashSet<lopdf::ObjectId> {
    use lopdf::Object;
    doc.objects
        .values()
        .filter_map(|object| {
            let Object::Stream(stream) = object else {
                return None;
            };
            match stream.dict.get(b"SMask") {
                Ok(Object::Reference(reference)) => Some(*reference),
                _ => None,
            }
        })
        .collect()
}

fn stream_has_filter(stream: &lopdf::Stream, filter_name: &[u8]) -> bool {
    use lopdf::Object;
    match stream.dict.get(b"Filter") {
        Ok(Object::Name(name)) => name.as_slice() == filter_name,
        Ok(Object::Array(filters)) => filters
            .iter()
            .any(|item| matches!(item, Object::Name(name) if name.as_slice() == filter_name)),
        _ => false,
    }
}

fn colorspace_channels(stream: &lopdf::Stream, doc: &lopdf::Document) -> u32 {
    stream
        .dict
        .get(b"ColorSpace")
        .map(|object| colorspace_object_channels(object, doc))
        .unwrap_or(0)
}

fn colorspace_object_channels(object: &lopdf::Object, doc: &lopdf::Document) -> u32 {
    use lopdf::Object;
    match object {
        Object::Name(name) => match name.as_slice() {
            b"DeviceRGB" | b"CalRGB" => 3,
            b"DeviceGray" | b"CalGray" => 1,
            _ => 0,
        },
        Object::Reference(reference) => doc
            .get_object(*reference)
            .ok()
            .map(|object| colorspace_object_channels(object, doc))
            .unwrap_or(0),
        Object::Array(items) => match items.first() {
            Some(Object::Name(name)) if name.as_slice() == b"ICCBased" => {
                let n = items
                    .get(1)
                    .and_then(|item| match item {
                        Object::Reference(reference) => Some(*reference),
                        _ => None,
                    })
                    .and_then(|reference| doc.get_object(reference).ok())
                    .and_then(|object| match object {
                        Object::Stream(stream) => Some(stream.dict.clone()),
                        _ => None,
                    })
                    .and_then(|dict| dict.get(b"N").ok().cloned())
                    .and_then(|item| match item {
                        Object::Integer(n) => Some(n as u32),
                        _ => None,
                    })
                    .unwrap_or(3);
                if n == 1 || n == 3 {
                    n
                } else {
                    0
                }
            }
            Some(Object::Name(name)) if name.as_slice() == b"CalRGB" => 3,
            Some(Object::Name(name)) if name.as_slice() == b"CalGray" => 1,
            _ => 0,
        },
        _ => 0,
    }
}

fn paeth_predictor(a: u8, b: u8, c: u8) -> u8 {
    let (a, b, c) = (a as i32, b as i32, c as i32);
    let p = a + b - c;
    let pa = (p - a).abs();
    let pb = (p - b).abs();
    let pc = (p - c).abs();
    if pa <= pb && pa <= pc {
        a as u8
    } else if pb <= pc {
        b as u8
    } else {
        c as u8
    }
}

fn apply_png_predictor(data: &[u8], width: u32, channels: u32) -> Vec<u8> {
    let stride = (width * channels) as usize;
    let row_bytes = stride + 1;
    let num_rows = data.len() / row_bytes;
    let mut out = Vec::with_capacity(num_rows * stride);
    let mut prev = vec![0u8; stride];

    for row_index in 0..num_rows {
        let base = row_index * row_bytes;
        if base + row_bytes > data.len() {
            break;
        }
        let filter = data[base];
        let source = &data[base + 1..base + row_bytes];
        let mut row = vec![0u8; stride];

        for index in 0..stride {
            let left = if index >= channels as usize {
                row[index - channels as usize]
            } else {
                0
            };
            let up = prev[index];
            let up_left = if index >= channels as usize {
                prev[index - channels as usize]
            } else {
                0
            };
            row[index] = match filter {
                0 => source[index],
                1 => source[index].wrapping_add(left),
                2 => source[index].wrapping_add(up),
                3 => source[index].wrapping_add(((left as u16 + up as u16) / 2) as u8),
                4 => source[index].wrapping_add(paeth_predictor(left, up, up_left)),
                _ => source[index],
            };
        }
        out.extend_from_slice(&row);
        prev = row;
    }

    out
}

fn zlib_decompress(data: &[u8]) -> Option<Vec<u8>> {
    use flate2::read::ZlibDecoder;
    use std::io::Read;
    let mut decoder = ZlibDecoder::new(data);
    let mut out = Vec::new();
    decoder.read_to_end(&mut out).ok()?;
    Some(out)
}
