package com.album.controller;

import com.album.common.BusinessException;
import com.album.common.ImageUploadValidator;
import com.album.common.Result;
import com.album.service.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Set;

@Slf4j
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final StorageService storageService;
    private final ImageUploadValidator imageUploadValidator;

    private static final Set<String> ALLOWED_SUB_DIR_PREFIXES = Set.of(
            "photos", "stickers", "templates", "stickers/system", "stickers/user"
    );

    @PostMapping("/upload")
    public Result<String> upload(@RequestParam("file") MultipartFile file,
                                 @RequestParam("subDir") String subDir) {
        if (subDir == null || subDir.contains("..")) {
            throw BusinessException.badRequest("非法的存储路径");
        }
        boolean allowed = ALLOWED_SUB_DIR_PREFIXES.stream().anyMatch(subDir::startsWith);
        if (!allowed) {
            throw BusinessException.badRequest("非法的存储路径，仅允许: " + ALLOWED_SUB_DIR_PREFIXES);
        }

        imageUploadValidator.validate(file);

        try {
            return Result.success(storageService.upload(file, subDir));
        } catch (BusinessException e) {
            throw e;
        } catch (SecurityException e) {
            throw BusinessException.badRequest("非法的存储路径");
        } catch (Exception e) {
            log.error("文件上传失败", e);
            throw BusinessException.badRequest("文件上传失败，请重试");
        }
    }
}