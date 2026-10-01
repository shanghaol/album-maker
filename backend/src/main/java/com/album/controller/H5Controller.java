package com.album.controller;

import com.album.entity.Project;
import com.album.entity.ProjectPage;
import com.album.entity.Template;
import com.album.entity.TemplatePage;
import com.album.entity.TemplateZone;
import com.album.service.ProjectService;
import com.album.service.TemplateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.ArrayList;
import java.util.List;

@Controller
@RequiredArgsConstructor
public class H5Controller {

    private final ProjectService projectService;
    private final TemplateService templateService;
    private final ObjectMapper objectMapper;

    @GetMapping("/api/h5/projects/{projectId}")
    public String preview(@PathVariable Long projectId, Model model) throws Exception {
        Project project = projectService.getById(projectId);
        if (project == null) {
            model.addAttribute("errorMsg", "项目不存在");
            return "error";
        }
        if (!"SUBMITTED".equals(project.getStatus())) {
            model.addAttribute("errorMsg", "项目未提交，无法预览");
            return "error";
        }
        Template template = templateService.getById(project.getTemplateId());
        List<ProjectPage> projectPages = projectService.getProjectPages(projectId);
        List<TemplatePage> templatePages = templateService.getPages(project.getTemplateId());

        List<TemplateZone> allZones = new ArrayList<>();
        for (TemplatePage tp : templatePages) {
            List<TemplateZone> zones = templateService.getZones(tp.getId());
            allZones.addAll(zones);
        }

        model.addAttribute("project", project);
        model.addAttribute("template", template);
        model.addAttribute("projectPagesJson", safeJson(objectMapper.writeValueAsString(projectPages)));
        model.addAttribute("templatePagesJson", safeJson(objectMapper.writeValueAsString(templatePages)));
        model.addAttribute("allZonesJson", safeJson(objectMapper.writeValueAsString(allZones)));
        // OG 分享卡片图（FR-E2/P3）：取第一张有缩略图的页面
        String ogImage = projectPages.stream()
                .map(ProjectPage::getPreviewUrl)
                .filter(u -> u != null && !u.isBlank())
                .findFirst()
                .orElse(null);
        model.addAttribute("ogImage", ogImage);
        return "h5-preview";
    }

    private String safeJson(String json) {
        return json.replace("</", "<\\/")
                   .replace("\u2028", "\\u2028")
                   .replace("\u2029", "\\u2029");
    }
}