package com.album.controller;

import com.album.common.BusinessException;
import com.album.common.ImageUploadValidator;
import com.album.service.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 文件上传安全校验测试（对应 MODIFICATION_LOG #3：魔数校验 readNBytes 修复）。
 * 直接 mock 控制器依赖的 StorageService 接口。
 */
@ExtendWith(MockitoExtension.class)
class FileControllerTest {

    @Mock
    private StorageService storageService;

    private FileController controller;

    @BeforeEach
    void setUp() {
        controller = new FileController(storageService, new ImageUploadValidator());
    }

    private MockMultipartFile file(String name, String contentType, byte[] content) {
        return new MockMultipartFile("file", name, contentType, content);
    }

    @Test
    void uploadValidJpegReturnsUrl() {
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3};
        when(storageService.upload(any(), eq("photos"))).thenReturn("/uploads/photos/x.jpg");
        var result = controller.upload(file("a.jpg", "image/jpeg", jpeg), "photos");
        assertEquals("/uploads/photos/x.jpg", result.getData());
    }

    @Test
    void uploadValidWebpHeaderAccepted() {
        // WebP 需要 12 字节头：RIFF....WEBP
        byte[] webp = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 1, 2};
        when(storageService.upload(any(), eq("photos"))).thenReturn("/uploads/photos/x.webp");
        var result = controller.upload(file("a.webp", "image/webp", webp), "photos");
        assertEquals("/uploads/photos/x.webp", result.getData());
    }

    @Test
    void uploadValidGifAndPngAccepted() {
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0, 0, 0, 0};
        byte[] gif = {'G', 'I', 'F', '8', 0, 0, 0, 0};
        when(storageService.upload(any(), eq("photos"))).thenReturn("/uploads/photos/x");
        assertNotNull(controller.upload(file("a.png", "image/png", png), "photos"));
        assertNotNull(controller.upload(file("a.gif", "image/gif", gif), "photos"));
    }

    @Test
    void uploadFakeImageContentRejected() {
        byte[] fake = "this is not an image at all!".getBytes();
        assertThrows(BusinessException.class,
                () -> controller.upload(file("a.png", "image/png", fake), "photos"));
        verify(storageService, never()).upload(any(), any());
    }

    @Test
    void uploadWrongContentTypeRejected() {
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0};
        assertThrows(BusinessException.class,
                () -> controller.upload(file("a.jpg", "application/pdf", jpeg), "photos"));
    }

    @Test
    void uploadDisallowedExtensionRejected() {
        assertThrows(BusinessException.class,
                () -> controller.upload(file("a.html", "image/html", "x".getBytes()), "photos"));
    }

    @Test
    void uploadPathTraversalRejected() {
        assertThrows(BusinessException.class,
                () -> controller.upload(file("a.png", "image/png", new byte[]{(byte) 0x89, 'P', 'N', 'G'}), "../etc"));
    }

    @Test
    void uploadDisallowedSubDirRejected() {
        assertThrows(BusinessException.class,
                () -> controller.upload(file("a.png", "image/png", new byte[]{(byte) 0x89, 'P', 'N', 'G'}), "secrets"));
    }
}
