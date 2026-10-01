package com.album.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * 导出产物定时清理测试（FR-64/VER-96）：超期删除、保留期内不动、
 * 覆盖从未被状态查询的产物、残留任务目录递归删除。
 */
@ExtendWith(MockitoExtension.class)
class ExportCleanupServiceTest {

    @Mock
    private StorageService storageService;

    private ExportCleanupService cleanupService;

    @TempDir
    Path basePath;

    @BeforeEach
    void setUp() {
        cleanupService = new ExportCleanupService(storageService);
        ReflectionTestUtils.setField(cleanupService, "retentionHours", 48L);
        when(storageService.getBasePath()).thenReturn(basePath);
    }

    @Test
    void deletesExpiredZipAndStaleTaskDirButKeepsFresh() throws IOException {
        Path exports = Files.createDirectories(basePath.resolve("exports"));

        // 超期 zip（含从未被状态查询的产物）
        Path expiredZip = exports.resolve("old-task.zip");
        Files.write(expiredZip, "zip".getBytes());
        setLastModifiedDaysAgo(expiredZip, 3);

        // 超期残留任务目录（内含文件）
        Path staleDir = Files.createDirectories(exports.resolve("old-task"));
        Files.write(staleDir.resolve("相册.zip"), "zip".getBytes());
        setLastModifiedDaysAgo(staleDir, 3);

        // 保留期内的产物（1 天前，不动）
        Path freshZip = exports.resolve("fresh-task.zip");
        Files.write(freshZip, "zip".getBytes());
        setLastModifiedDaysAgo(freshZip, 1);

        cleanupService.cleanupExpiredExports();

        assertFalse(Files.exists(expiredZip), "超期 zip 应被删除");
        assertFalse(Files.exists(staleDir), "超期任务目录应被递归删除");
        assertTrue(Files.exists(freshZip), "保留期内的产物不应被删除");
    }

    @Test
    void noOpWhenExportsDirMissing() {
        // 目录不存在时静默返回（部署初期场景）
        cleanupService.cleanupExpiredExports();
    }

    private void setLastModifiedDaysAgo(Path path, long days) throws IOException {
        Files.setLastModifiedTime(path,
                java.nio.file.attribute.FileTime.from(Instant.now().minus(days, ChronoUnit.DAYS)));
    }
}
