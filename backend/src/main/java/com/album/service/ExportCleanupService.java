package com.album.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.stream.Stream;

/**
 * 导出产物定时清理（FR-64/RULE-23，D26）：每小时扫描 {basePath}/exports/，
 * 删除最后修改时间超过保留期（默认 48 小时，可配置）的 zip 产物与残留任务目录，
 * 覆盖生成后从未被状态查询的产物。与导出任务状态 TTL（24h，内存态）相互独立：
 * 状态过期不删文件，文件清理不依赖状态查询。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportCleanupService {

    private final StorageService storageService;

    @Value("${app.export.retention-hours:48}")
    private long retentionHours;

    /** 每小时整点执行（VER-96 判据：超期删除、保留期内不动、覆盖未查询产物） */
    @Scheduled(cron = "0 0 * * * *")
    public void cleanupExpiredExports() {
        Path exportsDir = storageService.getBasePath().resolve("exports");
        if (!Files.isDirectory(exportsDir)) {
            return;
        }
        Instant cutoff = Instant.now().minusSeconds(retentionHours * 3600);
        int deleted = 0;
        try (Stream<Path> entries = Files.list(exportsDir)) {
            for (Path entry : entries.filter(p -> !p.getFileName().toString().startsWith(".")).toList()) {
                try {
                    Instant lastModified = Files.getLastModifiedTime(entry).toInstant();
                    if (lastModified.isBefore(cutoff)) {
                        deleteRecursively(entry);
                        deleted++;
                    }
                } catch (IOException e) {
                    log.warn("导出产物清理失败，跳过: {}", entry, e);
                }
            }
        } catch (IOException e) {
            log.error("导出产物目录扫描失败: {}", exportsDir, e);
            return;
        }
        if (deleted > 0) {
            log.info("导出产物清理完成: 删除 {} 个超期条目（保留期 {}h）", deleted, retentionHours);
        }
    }

    private void deleteRecursively(Path path) throws IOException {
        if (Files.isDirectory(path)) {
            try (Stream<Path> children = Files.walk(path)) {
                children.sorted(Comparator.reverseOrder()).forEach(p -> {
                    try {
                        Files.delete(p);
                    } catch (IOException e) {
                        log.warn("导出产物删除失败: {}", p, e);
                    }
                });
            }
        } else {
            Files.delete(path);
        }
    }
}
