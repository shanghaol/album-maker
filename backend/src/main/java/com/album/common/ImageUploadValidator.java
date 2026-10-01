package com.album.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;

/**
 * 图片上传内容校验器（FR-62/D24）：扩展名白名单 + Content-Type + 魔数三层校验。
 * 用户端上传服务（FileController）与管理端直传通道（模板背景/封面/逐页背景/贴纸）共用，
 * 保证两条通道执行同等校验。
 */
@Slf4j
@Component
public class ImageUploadValidator {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".webp"
    );

    public void validate(MultipartFile file) {
        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isEmpty()) {
            throw BusinessException.badRequest("文件名不能为空");
        }
        int dotIndex = originalName.lastIndexOf(".");
        if (dotIndex < 0) {
            throw BusinessException.badRequest("文件缺少扩展名");
        }
        String ext = originalName.substring(dotIndex).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw BusinessException.badRequest("仅支持图片文件: JPG, PNG, GIF, WebP");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw BusinessException.badRequest("文件Content-Type不合法");
        }

        try {
            // readNBytes 保证读满12字节（单次 read 可能短读，导致 WebP 头校验失真）
            byte[] header = file.getInputStream().readNBytes(12);
            if (header.length < 4 || !isImageFile(header)) {
                throw BusinessException.badRequest("文件内容与图片类型不匹配");
            }
        } catch (IOException e) {
            throw BusinessException.badRequest("文件读取失败");
        }
    }

    private boolean isImageFile(byte[] header) {
        if (header.length < 4) return false;
        if ((header[0] & 0xFF) == 0xFF && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF) return true;
        if ((header[0] & 0xFF) == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47) return true;
        if (header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x38) return true;
        if (header.length >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46
                && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50) return true;
        return false;
    }
}
