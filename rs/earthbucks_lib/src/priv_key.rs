use crate::buf::EbxBuf;
use crate::error::EbxError;
use crate::hash;
use earthbucks_secp256k1::secp256k1;

#[derive(Clone, Debug)]
pub struct PrivKey {
    pub buf: [u8; 32],
}

impl PrivKey {
    pub fn new(priv_key: [u8; 32]) -> Self {
        PrivKey { buf: priv_key }
    }

    pub fn from_random() -> Self {
        loop {
            let key_data: [u8; 32] = EbxBuf::from_random();
            if secp256k1::private_key_verify(&key_data) {
                return PrivKey::new(key_data);
            }
        }
    }

    pub fn to_pub_key_buffer(&self) -> Result<[u8; 33], EbxError> {
        // let secret_key = SecretKey::from_slice(&self.buf);
        if !secp256k1::private_key_verify(&self.buf) {
            return Err(EbxError::InvalidKeyError { source: None });
        }
        let public_key_res = secp256k1::public_key_create(&self.buf);
        if public_key_res.is_err() {
            return Err(EbxError::InvalidKeyError { source: None });
        }
        let public_key = public_key_res.unwrap();
        let pub_key_buf: [u8; 33] = public_key.try_into().unwrap();
        Ok(pub_key_buf)
    }

    pub fn to_pub_key_hex(&self) -> Result<String, EbxError> {
        let pub_key_buf = self.to_pub_key_buffer()?;
        Ok(pub_key_buf.to_strict_hex())
    }

    pub fn from_buffer(buffer: &[u8; 32]) -> Self {
        let mut priv_key = [0u8; 32];
        priv_key.copy_from_slice(buffer);
        PrivKey::new(priv_key)
    }

    pub fn from_buf(vec: Vec<u8>) -> Result<Self, EbxError> {
        if vec.len() > 32 {
            return Err(EbxError::TooMuchDataError { source: None });
        }
        if vec.len() < 32 {
            return Err(EbxError::NotEnoughDataError { source: None });
        }
        let mut priv_key = [0u8; 32];
        priv_key.copy_from_slice(&vec);
        Ok(PrivKey::new(priv_key))
    }

    pub fn to_strict_hex(&self) -> String {
        self.buf.to_strict_hex()
    }

    pub fn from_strict_hex(hex: &str) -> Result<Self, EbxError> {
        let priv_key_vec: Vec<u8> = Vec::<u8>::from_strict_hex(hex)?;
        PrivKey::from_buf(priv_key_vec)
    }

    pub fn to_strict_str(&self) -> String {
        let check_buf = hash::blake3_hash(&self.buf);
        let check_sum: [u8; 4] = check_buf[0..4].try_into().unwrap();
        let check_hex = check_sum.to_strict_hex();
        "ebxprv".to_string() + &check_hex + &self.buf.to_base58()
    }

    pub fn from_strict_str(s: &str) -> Result<Self, EbxError> {
        if !s.starts_with("ebxprv") {
            return Err(EbxError::InvalidEncodingError { source: None });
        }
        let check_sum: [u8; 4] = <[u8; 4]>::from_strict_hex(&s[6..14])?;
        let buf = Vec::<u8>::from_base58(&s[14..])
            .map_err(|_| EbxError::InvalidEncodingError { source: None })?;
        let check_buf = hash::blake3_hash(&buf);
        let expected_check_sum = &check_buf[0..4];
        if check_sum != expected_check_sum {
            return Err(EbxError::InvalidChecksumError { source: None });
        }
        PrivKey::from_buf(buf)
    }

    pub fn is_valid_string_fmt(s: &str) -> bool {
        let res = Self::from_strict_str(s);
        res.is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_random() {
        let priv_key = PrivKey::from_random();
        println!("priv_key: {}", priv_key.to_strict_str());
    }

    #[test]
    fn test_to_pub_key_buf() {
        let priv_key = PrivKey::from_random();
        let pub_key_buf = priv_key.to_pub_key_buffer().unwrap();
        println!("pub_key_buf: {}", pub_key_buf.to_strict_hex());
    }

    #[test]
    fn test_to_strict_hex() {
        let priv_key = PrivKey::from_random();
        let hex = priv_key.to_strict_str();
        println!("hex: {}", hex);
    }

    #[test]
    fn test_from_strict_hex() {
        let priv_key = PrivKey::from_random();
        let hex = priv_key.to_strict_hex();
        let priv_key2 = PrivKey::from_strict_hex(&hex).unwrap();
        assert_eq!(priv_key.buf, priv_key2.buf);
    }

    #[test]
    fn test_to_string() {
        let priv_key = PrivKey::from_random();
        let s = priv_key.to_strict_str();
        println!("s: {}", s);
    }

    #[test]
    fn test_from_strict_str() {
        let priv_key = PrivKey::from_random();
        let s = priv_key.to_strict_str();
        let priv_key2 = PrivKey::from_strict_str(&s).unwrap();
        assert_eq!(priv_key.buf, priv_key2.buf);
    }

    #[test]
    fn test_from_slice() {
        let priv_key = PrivKey::from_random();
        let priv_key2 = PrivKey::new(priv_key.buf);
        assert_eq!(priv_key.buf, priv_key2.buf);
    }

    #[test]
    fn test_from_slice_invalid() {
        let priv_key = PrivKey::from_random();
        let mut priv_key2 = priv_key.buf;
        priv_key2[0] = priv_key2[0].wrapping_add(1);
        assert!(PrivKey::new(priv_key2).buf != priv_key.buf);
    }

    #[test]
    fn test_this_priv_key_vec() {
        let priv_key = PrivKey::from_strict_hex(
            "2ef930fed143c0b92b485c29aaaba97d09cab882baafdb9ea1e55dec252cd09f",
        )
        .unwrap();
        let pub_key_buf = priv_key.to_pub_key_buffer().unwrap();
        let pub_key_hex = pub_key_buf.to_strict_hex();
        assert_eq!(
            pub_key_hex,
            "03f9bd9639017196c2558c96272d0ea9511cd61157185c98ae3109a28af058db7b"
        );
    }

    #[test]
    fn test_to_from_strict_str_format() {
        assert!(PrivKey::is_valid_string_fmt(
            "ebxprv786752b8GxmUZuZzYKihcmUv88T1K88Q7KNm1WjHCAWx2rNGRjxJ"
        ));
        assert!(!PrivKey::is_valid_string_fmt(
            "ebxpr786752b8GxmUZuZzYKihcmUv88T1K88Q7KNm1WjHCAWx2rNGRjxJ"
        ));
        assert!(!PrivKey::is_valid_string_fmt(
            "ebxprv786752b8GxmUZuZzYKihcmUv88T1K88Q7KNm1WjHCAWx2rNGRjx"
        ));

        let str = "ebxprv786752b8GxmUZuZzYKihcmUv88T1K88Q7KNm1WjHCAWx2rNGRjxJ";
        let priv_key = PrivKey::from_strict_str(str).unwrap();
        assert_eq!(priv_key.to_strict_str(), str);
    }
}
