use std::path::Path;

/// Normalize a file path for consistent processing
pub fn normalize_path(path: &str) -> String {
    let path = Path::new(path);
    
    // Convert to string, replacing backslashes on Windows
    let mut normalized = path.to_string_lossy().to_string();
    
    #[cfg(target_os = "windows")]
    {
        normalized = normalized.replace('\\', "/");
    }
    
    // Remove duplicate slashes
    while normalized.contains("//") {
        normalized = normalized.replace("//", "/");
    }
    
    // Remove trailing slash unless root
    if normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("/foo/bar"), "/foo/bar");
        assert_eq!(normalize_path("/foo//bar"), "/foo/bar");
        assert_eq!(normalize_path("/foo/bar/"), "/foo/bar");
        assert_eq!(normalize_path("/"), "/");
    }
    
    #[cfg(target_os = "windows")]
    #[test]
    fn test_normalize_windows_path() {
        assert_eq!(normalize_path("C:\\foo\\bar"), "C:/foo/bar");
        assert_eq!(normalize_path("C:\\foo\\\\bar"), "C:/foo/bar");
    }
}