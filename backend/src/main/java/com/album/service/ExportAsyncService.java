package com.album.service;

import com.album.entity.Project;
import com.album.entity.ProjectPage;
import com.album.mapper.ProjectMapper;
import com.album.mapper.ProjectPageMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportAsyncService {

    private final ProjectMapper projectMapper;
    private final ProjectPageMapper projectPageMapper;
    private final ObjectMapper objectMapper;
    private final StorageService storageService;
    private final ExportTaskStatusManager taskStatusManager;

    @Async
    public void doExport(String taskId, List<Long> projectIds) {
        try {
            String basePath = storageService.getBasePath().toAbsolutePath().toString();
            String exportDir = basePath + File.separator + "exports" + File.separator + taskId;
            Files.createDirectories(Paths.get(exportDir));

            for (Long projectId : projectIds) {
                Project project = projectMapper.selectById(projectId);
                if (project == null || !"SUBMITTED".equals(project.getStatus())) {
                    continue;
                }
                String rawTitle = project.getTitle();
                String safeTitle = (rawTitle == null ? "project-" + projectId : rawTitle).replaceAll("[\\\\/:*?\"<>|]", "_");
                String projectZipName = exportDir + File.separator + safeTitle + ".zip";
                try (ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(projectZipName))) {
                    LambdaQueryWrapper<ProjectPage> pageWrapper = new LambdaQueryWrapper<>();
                    pageWrapper.eq(ProjectPage::getProjectId, projectId)
                            .orderByAsc(ProjectPage::getPageNumber);
                    List<ProjectPage> pages = projectPageMapper.selectList(pageWrapper);

                    Set<String> addedFiles = new HashSet<>();
                    for (ProjectPage page : pages) {
                        String pageData = page.getPageData();
                        if (pageData == null) continue;
                        try {
                            JsonNode root = objectMapper.readTree(pageData);
                            addFilesFromNode(root, zos, addedFiles);
                        } catch (Exception e) {
                            log.error("解析页面数据失败: pageId={}", page.getId(), e);
                        }
                    }
                }
            }

            String finalZipName = basePath + File.separator + "exports" + File.separator
                    + taskId + ".zip";
            try (ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(finalZipName))) {
                File dir = new File(exportDir);
                File[] files = dir.listFiles();
                if (files != null) {
                    for (File file : files) {
                        try (FileInputStream fis = new FileInputStream(file)) {
                            ZipEntry entry = new ZipEntry(file.getName());
                            zos.putNextEntry(entry);
                            byte[] buffer = new byte[8192];
                            int len;
                            while ((len = fis.read(buffer)) > 0) {
                                zos.write(buffer, 0, len);
                            }
                            zos.closeEntry();
                        }
                    }
                }
            }
            // 打包完成后删除逐项目的中间 zip 目录，只保留最终 zip，避免磁盘空间被翻倍占用
            deleteDirectory(new File(exportDir));
            taskStatusManager.put(taskId, "/uploads/exports/" + taskId + ".zip");
        } catch (Exception e) {
            log.error("导出失败", e);
            taskStatusManager.put(taskId, "FAILED");
        }
    }

    private void deleteDirectory(File dir) {
        if (dir == null || !dir.exists()) return;
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    deleteDirectory(file);
                } else {
                    //noinspection ResultOfMethodCallIgnored
                    file.delete();
                }
            }
        }
        //noinspection ResultOfMethodCallIgnored
        dir.delete();
    }

    private void addFilesFromNode(JsonNode node, ZipOutputStream zos, Set<String> added) throws IOException {
        if (node.isObject()) {
            String imageUrl = node.has("imageUrl") ? node.get("imageUrl").asText() : null;
            String originalUrl = node.has("originalUrl") ? node.get("originalUrl").asText() : null;
            String stickerUrl = node.has("stickerUrl") ? node.get("stickerUrl").asText() : null;

            addFileToZip(imageUrl, zos, added);
            addFileToZip(originalUrl, zos, added);
            addFileToZip(stickerUrl, zos, added);

            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (field.getValue().isArray() || field.getValue().isObject()) {
                    addFilesFromNode(field.getValue(), zos, added);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                addFilesFromNode(item, zos, added);
            }
        }
    }

    private void addFileToZip(String url, ZipOutputStream zos, Set<String> added) throws IOException {
        if (url == null || url.isEmpty()) return;
        if (url.startsWith("/uploads/")) {
            String relativePath = url.substring(9);
            String fileName = relativePath.substring(relativePath.lastIndexOf('/') + 1);
            if (added.contains(fileName)) return;
            added.add(fileName);

            Path filePath = storageService.getBasePath().resolve(relativePath);
            if (Files.exists(filePath)) {
                ZipEntry entry = new ZipEntry(fileName);
                zos.putNextEntry(entry);
                Files.copy(filePath, zos);
                zos.closeEntry();
            }
        }
    }
}