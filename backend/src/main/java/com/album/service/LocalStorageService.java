package com.album.service;

import com.album.common.BusinessException;
import com.album.config.StorageProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Slf4j
public class LocalStorageService implements StorageService {

    private final Path basePath;
    private final String urlPrefix;

    public LocalStorageService(StorageProperties properties) {
        StorageProperties.LocalConfig local = properties.getLocal();
        this.urlPrefix = local.getUrlPrefix();
        try {
            this.basePath = Paths.get(local.getBasePath()).toAbsolutePath().normalize();
            Files.createDirectories(basePath);
            log.info("本地存储初始化完成，根目录: {}", basePath);
        } catch (IOException e) {
            throw new BusinessException(500, "无法创建存储目录: " + local.getBasePath());
        }
    }

    @Override
    public String upload(MultipartFile file, String subDir) {
        try {
            if (subDir.contains("..")) {
                throw new SecurityException("路径遍历攻击已阻止: " + subDir);
            }
            Path dirPath = basePath.resolve(subDir).normalize();
            if (!dirPath.startsWith(basePath)) {
                throw new SecurityException("路径遍历攻击已阻止: 解析路径超出basePath");
            }
            Files.createDirectories(dirPath);

            String originalName = file.getOriginalFilename();
            String ext = "";
            if (originalName != null && originalName.contains(".")) {
                ext = originalName.substring(originalName.lastIndexOf("."));
            }
            String fileName = UUID.randomUUID().toString() + ext;
            Path filePath = dirPath.resolve(fileName);
            file.transferTo(filePath.toFile());

            log.info("文件上传成功: {}", filePath);
            return urlPrefix + subDir + "/" + fileName;
        } catch (IOException e) {
            log.error("文件上传失败", e);
            throw BusinessException.badRequest("文件上传失败，请重试");
        }
    }

    @Override
    public String upload(byte[] data, int width, int height, String fileName, String subDir) {
        try {
            if (subDir.contains("..")) {
                throw new SecurityException("路径遍历攻击已阻止: " + subDir);
            }
            Path dirPath = basePath.resolve(subDir).normalize();
            if (!dirPath.startsWith(basePath)) {
                throw new SecurityException("路径遍历攻击已阻止: 解析路径超出basePath");
            }
            Files.createDirectories(dirPath);

            String ext = "";
            if (fileName != null && fileName.contains(".")) {
                ext = fileName.substring(fileName.lastIndexOf("."));
            }
            String newFileName = UUID.randomUUID().toString() + ext;
            Path filePath = dirPath.resolve(newFileName);
            Files.write(filePath, data);

            log.info("文件上传成功(字节数组): {} ({}x{}px)", filePath, width, height);
            return urlPrefix + subDir + "/" + newFileName;
        } catch (IOException e) {
            log.error("文件上传失败", e);
            throw BusinessException.badRequest("文件上传失败，请重试");
        }
    }

    @Override
    public void delete(String fileUrl) {
        try {
            if (fileUrl == null || !fileUrl.startsWith(urlPrefix)) {
                log.warn("文件URL为空或格式不匹配，跳过删除: {}", fileUrl);
                return;
            }
            String relativePath = fileUrl.substring(urlPrefix.length());
            if (relativePath.contains("..")) {
                log.warn("检测到路径遍历尝试，跳过删除: {}", fileUrl);
                return;
            }
            Path filePath = basePath.resolve(relativePath).normalize();
            // 与 upload 的防护对齐：规范化后必须仍位于存储根目录内
            if (!filePath.startsWith(basePath)) {
                log.warn("解析路径超出存储根目录，跳过删除: {}", fileUrl);
                return;
            }
            Files.deleteIfExists(filePath);
            log.info("文件已删除: {}", filePath);
        } catch (IOException e) {
            log.error("文件删除失败: {}", fileUrl, e);
        }
    }

    @Override
    public Path getBasePath() {
        return basePath;
    }
}