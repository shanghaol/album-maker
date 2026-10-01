package com.album.controller;

import com.album.common.BusinessException;
import com.album.common.Result;
import com.album.dto.SavePageRequest;
import com.album.entity.Project;
import com.album.entity.ProjectPage;
import com.album.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @PostMapping
    public Result<Project> create(@RequestBody Map<String, Object> body, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        Object templateIdObj = body.get("templateId");
        if (templateIdObj == null) {
            throw BusinessException.badRequest("模板ID不能为空");
        }
        Long templateId;
        try {
            templateId = ((Number) templateIdObj).longValue();
        } catch (ClassCastException e) {
            // templateId 为字符串等非数字类型时返回 400 而非 500
            throw BusinessException.badRequest("模板ID格式不正确");
        }
        String title = (String) body.get("title");
        if (title == null || title.trim().isEmpty()) {
            throw BusinessException.badRequest("项目标题不能为空");
        }
        if (title.length() > 100) {
            throw BusinessException.badRequest("项目标题不能超过100个字符");
        }
        return Result.success(projectService.createProject(userId, templateId, title));
    }

    @GetMapping("/current")
    public Result<Project> getCurrent(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return Result.success(projectService.getCurrentProject(userId));
    }

    @GetMapping
    public Result<List<Project>> list(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return Result.success(projectService.getMyProjects(userId));
    }

    @GetMapping("/{id}")
    public Result<Project> getById(@PathVariable Long id, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        Project project = projectService.getById(id);
        if (project == null) {
            throw BusinessException.notFound("项目不存在");
        }
        if (!project.getUserId().equals(userId)) {
            throw BusinessException.forbidden("无权访问该项目");
        }
        return Result.success(project);
    }

    @GetMapping("/{id}/pages")
    public Result<List<ProjectPage>> getPages(@PathVariable Long id, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        Project project = projectService.getById(id);
        if (project == null) {
            throw BusinessException.notFound("项目不存在");
        }
        if (!project.getUserId().equals(userId)) {
            throw BusinessException.forbidden("无权访问该项目");
        }
        return Result.success(projectService.getProjectPages(id));
    }

    @PostMapping("/{id}/pages")
    public Result<Void> savePage(@PathVariable Long id, @Valid @RequestBody SavePageRequest request, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        Project project = projectService.getById(id);
        if (project == null) {
            throw BusinessException.notFound("项目不存在");
        }
        if (!project.getUserId().equals(userId)) {
            throw BusinessException.forbidden("无权操作该项目");
        }
        projectService.savePage(id, request);
        return Result.success();
    }

    @PostMapping("/{id}/submit")
    public Result<Void> submit(@PathVariable Long id, @RequestBody Map<String, String> body, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        Project project = projectService.getById(id);
        if (project == null) {
            throw BusinessException.notFound("项目不存在");
        }
        if (!project.getUserId().equals(userId)) {
            throw BusinessException.forbidden("无权操作该项目");
        }
        projectService.submitProject(id, body.get("h5Url"));
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> abandon(@PathVariable Long id, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        projectService.abandonProject(id, userId);
        return Result.success();
    }

    /**
     * 重新编辑：从已提交作品复制出新草稿（创意单页迭代，需求 SR-14/FR-D6）
     */
    @PostMapping("/{id}/copy")
    public Result<Project> copy(@PathVariable Long id, Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return Result.success(projectService.copySubmittedProject(id, userId));
    }
}