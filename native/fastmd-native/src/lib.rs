use napi::bindgen_prelude::*;
use napi_derive::napi;
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::{fs, path::Path};

fn mtime_ms(meta: &fs::Metadata) -> i128 {
  #[allow(unused_mut)]
  let mut ms: i128 = 0;
  if let Ok(m) = meta.modified() {
    if let Ok(d) = m.duration_since(std::time::UNIX_EPOCH) {
      ms = d.as_millis() as i128;
    }
  }
  ms
}

#[napi]
pub fn deps_digest(paths: Vec<String>) -> String {
  // Stat in parallel
  let mut records: Vec<(String, u64, i128)> = paths
    .par_iter()
    .map(|p| {
      let path = Path::new(&p);
      match fs::metadata(path) {
        Ok(meta) => (p.clone(), meta.len(), mtime_ms(&meta)),
        Err(_) => (p.clone(), 0, 0),
      }
    })
    .collect();

  // Stable order by path
  records.par_sort_unstable_by(|a, b| a.0.cmp(&b.0));

  // Stable concatenation: path|size|mtimeMs\n
  let mut hasher = Sha256::new();
  for (p, sz, mt) in records {
    hasher.update(p.as_bytes());
    hasher.update(b"|");
    hasher.update(sz.to_string().as_bytes());
    hasher.update(b"|");
    hasher.update(mt.to_string().as_bytes());
    hasher.update(b"\n");
  }
  format!("{:x}", hasher.finalize())
}

