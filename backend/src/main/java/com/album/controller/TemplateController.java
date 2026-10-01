package com.album.controller;

import com.album.common.BusinessException;
import com.album.common.Result;
import com.album.entity.Template;
import com.album.entity.TemplatePage;
import com.album.entity.TemplateZone;
import com.album.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;

    @GetMapping
    public Result<List<Template>> list(@RequestParam(required = false) String category,
                                       @RequestParam(required = false) String type) {
        // type 区分内容线：模板市场（默认）= ALBUM；创意展示页 = CREATIVE
        return Result.success(templateService.listPublished(category, type));
    }

    @GetMapping("/{id}")
    public Result<Template> getById(@PathVariable Long id) {
        Template template = templateService.getById(id);
        if (template == null) {
            throw BusinessException.notFound("模板不存在");
        }
        return Result.success(template);
    }

    @GetMapping("/{id}/pages")
    public Result<List<TemplatePage>> getPages(@PathVariable Long id) {
        Template template = templateService.getById(id);
        if (template == null) {
            throw BusinessException.notFound("模板不存在");
        }
        return Result.success(templateService.getPages(id));
    }

    @GetMapping("/pages/{pageId}/zones")
    public Result<List<TemplateZone>> getZones(@PathVariable Long pageId) {
        return Result.success(templateService.getZones(pageId));
    }
}