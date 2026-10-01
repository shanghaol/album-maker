package com.album.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final ExportAsyncService exportAsyncService;
    private final ExportTaskStatusManager taskStatusManager;

    public String createExportTask(List<Long> projectIds) {
        String taskId = UUID.randomUUID().toString();
        taskStatusManager.put(taskId, "PROCESSING");
        exportAsyncService.doExport(taskId, projectIds);
        return taskId;
    }

    public String getTaskStatus(String taskId) {
        return taskStatusManager.get(taskId);
    }
}