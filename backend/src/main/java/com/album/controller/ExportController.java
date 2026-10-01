package com.album.controller;

import com.album.common.BusinessException;
import com.album.common.Result;
import com.album.dto.ExportRequest;
import com.album.entity.Project;
import com.album.service.ExportService;
import com.album.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/export")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;
    private final ProjectService projectService;

    @PostMapping
    public Result<Map<String, String>> export(@RequestBody ExportRequest request) {
        if (request.getProjectIds() == null || request.getProjectIds().isEmpty()) {
            throw BusinessException.badRequest("请选择要导出的项目");
        }
        for (Long projectId : request.getProjectIds()) {
            Project project = projectService.getById(projectId);
            if (project == null) {
                throw BusinessException.badRequest("项目不存在: " + projectId);
            }
        }
        String taskId = exportService.createExportTask(request.getProjectIds());
        return Result.success(Map.of("taskId", taskId));
    }

    @GetMapping("/status/{taskId}")
    public Result<Map<String, String>> status(@PathVariable String taskId) {
        String status = exportService.getTaskStatus(taskId);
        return Result.success(Map.of("status", status));
    }
}