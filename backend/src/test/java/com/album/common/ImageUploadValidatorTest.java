package com.album.common;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 图片上传校验器测试（FR-62）：扩展名白名单、Content-Type、魔数三层判据。
 */
class ImageUploadValidatorTest {

    private ImageUploadValidator validator;

    // 1x1 PNG 完整头（8 字节签名）
    private static final byte[] PNG_HEADER = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D
    };

    @BeforeEach
    void setUp() {
        validator = new ImageUploadValidator();
    }

    @Test
    void acceptsValidPng() {
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", PNG_HEADER);
        assertDoesNotThrow(() -> validator.validate(file));
    }

    @Test
    void rejectsExtensionNotInWhitelist() {
        MockMultipartFile file = new MockMultipartFile("file", "evil.exe", "image/png", PNG_HEADER);
        BusinessException e = assertThrows(BusinessException.class, () -> validator.validate(file));
        assertEquals(400, e.getCode());
    }

    @Test
    void rejectsMissingExtension() {
        MockMultipartFile file = new MockMultipartFile("file", "noext", "image/png", PNG_HEADER);
        assertThrows(BusinessException.class, () -> validator.validate(file));
    }

    @Test
    void rejectsNonImageContentType() {
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "application/octet-stream", PNG_HEADER);
        assertThrows(BusinessException.class, () -> validator.validate(file));
    }

    @Test
    void rejectsMagicNumberMismatch() {
        // 扩展名与 Content-Type 合法，但内容非图片（伪装文件，VER-94 判据）
        byte[] fake = "not-an-image-but-long-enough".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", fake);
        BusinessException e = assertThrows(BusinessException.class, () -> validator.validate(file));
        assertEquals(400, e.getCode());
    }

    @Test
    void rejectsEmptyFilename() {
        MockMultipartFile file = new MockMultipartFile("file", "", "image/png", PNG_HEADER);
        assertThrows(BusinessException.class, () -> validator.validate(file));
    }
}
