use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use sha2::{Digest, Sha256};

type Aes256CbcEnc = cbc::Encryptor<aes::Aes256>;
type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

fn derive_key_iv(password: &str) -> ([u8; 32], [u8; 16]) {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let key_hash = hasher.finalize();

    let mut key = [0u8; 32];
    key.copy_from_slice(&key_hash);

    let mut iv_hasher = Sha256::new();
    iv_hasher.update(password.as_bytes());
    iv_hasher.update(b"bark_iv");
    let iv_result = iv_hasher.finalize();

    let mut iv = [0u8; 16];
    iv.copy_from_slice(&iv_result[..16]);

    (key, iv)
}

pub fn encrypt(plaintext: &str, password: &str) -> Result<String> {
    let (key, iv) = derive_key_iv(password);
    let encryptor = Aes256CbcEnc::new(&key.into(), &iv.into());
    let mut buf = plaintext.as_bytes().to_vec();
    let ct_len = encryptor
        .encrypt_padded_mut::<Pkcs7>(&mut buf, plaintext.len())
        .map_err(|e| anyhow::anyhow!("Encryption padding failed: {:?}", e))?
        .len();
    Ok(BASE64.encode(&buf[..ct_len]))
}

pub fn decrypt(ciphertext_b64: &str, password: &str) -> Result<String> {
    let (key, iv) = derive_key_iv(password);
    let mut ciphertext = BASE64
        .decode(ciphertext_b64)
        .context("Invalid base64 ciphertext")?;
    let decryptor = Aes256CbcDec::new(&key.into(), &iv.into());
    let pt = decryptor
        .decrypt_padded_mut::<Pkcs7>(&mut ciphertext)
        .map_err(|e| anyhow::anyhow!("Decryption failed: {:?}", e))?;
    String::from_utf8(pt.to_vec()).context("Invalid UTF-8 in decrypted text")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = "test_password_123";
        let plaintext = "Hello, Bark!";
        let encrypted = encrypt(plaintext, key).unwrap();
        let decrypted = decrypt(&encrypted, key).unwrap();
        assert_eq!(plaintext, decrypted);
    }
}
