package com.album.controller;

import com.album.common.BusinessException;
import com.album.common.Result;
import com.album.entity.Project;
import com.album.entity.ProjectPage;
import com.album.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/projects")
@RequiredArgsConstructor
public class AdminProjectController {

    private final ProjectService projectService;

    @GetMapping
    public Result<List<Project>> listSubmitted(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return Result.success(projectService.searchProjects(keyword, status));
    }

    @GetMapping("/{id}")
    public Result<Project> getById(@PathVariable Long id) {
        Project project = projectService.getById(id);
        if (project == null) {
            throw BusinessException.notFound("项目不存在");
        }
        return Result.success(project);
    }

    @GetMapping("/{id}/pages")
    public Result<List<ProjectPage>> getPages(@PathVariable Long id) {
        return Result.success(projectService.getProjectPages(id));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        projectService.deleteProject(id);
        return Result.success();
    }
}