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

#[cfg(test)]
mod tests {
  use super::*;
  use std::{fs, io::Write};

  fn sha256_hex(s: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(s.as_bytes());
    format!("{:x}", hasher.finalize())
  }

  fn tmp_dir() -> std::path::PathBuf {
    let base = std::env::temp_dir();
    let name = format!(
      "fastmd-native-tests-{}-{}",
      std::process::id(),
      rand_suffix()
    );
    let dir = base.join(name);
    let _ = fs::create_dir_all(&dir);
    dir
  }

  fn rand_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ns = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .unwrap_or_default()
      .as_nanos();
    format!("{}", ns)
  }

  #[test]
  fn digest_includes_missing_and_existing_files() {
    let dir = tmp_dir();
    let a = dir.join("a.md");
    // create file a
    {
      let mut f = fs::File::create(&a).expect("create a");
      let _ = f.write_all(b"# a\n");
    }
    // gather expected lines
    let meta_a = fs::metadata(&a).expect("meta a");
    let p_a = a.to_string_lossy().to_string();
    let line_a = format!("{}|{}|{}\n", p_a, meta_a.len(), mtime_ms(&meta_a));
    // missing path
    let missing = dir.join("missing.md");
    let p_m = missing.to_string_lossy().to_string();
    let line_m = format!("{}|0|0\n", p_m);
    // sort by path
    let mut lines = vec![line_a, line_m];
    lines.sort();
    let expected = sha256_hex(&lines.concat());
    // call
    let got = deps_digest(vec![p_m.clone(), p_a.clone()]);
    assert_eq!(got, expected);
  }

  #[test]
  fn digest_is_order_invariant() {
    let dir = tmp_dir();
    let a = dir.join("a.md");
    let b = dir.join("b.mdx");
    {
      let mut f = fs::File::create(&a).unwrap();
      let _ = f.write_all(b"# a\n");
    }
    {
      let mut f = fs::File::create(&b).unwrap();
      let _ = f.write_all(b"# b\n");
    }
    let p_a = a.to_string_lossy().to_string();
    let p_b = b.to_string_lossy().to_string();
    let d1 = deps_digest(vec![p_a.clone(), p_b.clone()]);
    let d2 = deps_digest(vec![p_b, p_a]);
    assert_eq!(d1, d2);
  }
}
