package com.album.controller;

import com.album.common.Result;
import com.album.dto.TemplateCreateRequest;
import com.album.dto.ZoneSaveRequest;
import com.album.entity.Template;
import com.album.service.TemplateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin/templates")
@RequiredArgsConstructor
public class AdminTemplateController {

    private final TemplateService templateService;

    @GetMapping
    public Result<List<Template>> listAll() {
        return Result.success(templateService.listAll());
    }

    @PostMapping
    public Result<Template> create(@Valid @RequestBody TemplateCreateRequest request) {
        return Result.success(templateService.createTemplate(request));
    }

    @PostMapping("/create")
    public Result<Template> createWithBackground(@RequestParam("file") MultipartFile file,
                                                  @RequestParam("name") String name,
                                                  @RequestParam(value = "description", required = false) String description,
                                                  @RequestParam("pageCount") Integer pageCount,
                                                  @RequestParam("width") Integer width,
                                                  @RequestParam("height") Integer height,
                                                  @RequestParam(value = "category", required = false) String category,
                                                  @RequestParam(value = "type", required = false) String type) {
        return Result.success(templateService.createWithBackground(file, name, description, pageCount, width, height, category, type));
    }

    @PostMapping("/pdf")
    public Result<Template> createFromPdf(@RequestParam("file") MultipartFile file,
                                           @RequestParam("name") String name,
                                           @RequestParam(value = "description", required = false) String description,
                                           @RequestParam(value = "dpi", defaultValue = "200") int dpi,
                                           @RequestParam(value = "category", required = false) String category,
                                           @RequestParam(value = "type", required = false) String type) {
        return Result.success(templateService.createFromPdf(file, name, description, dpi, category, type));
    }

    @PutMapping("/{id}/category")
    public Result<Void> updateCategory(@PathVariable Long id,
                                       @RequestParam(value = "category", required = false) String category) {
        templateService.updateCategory(id, category);
        return Result.success();
    }

    @PostMapping("/{id}/cover")
    public Result<String> uploadCover(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        return Result.success(templateService.uploadCover(id, file));
    }

    @PostMapping("/{id}/pages/{pageNumber}/background")
    public Result<String> uploadPageBackground(@PathVariable Long id,
                                                @PathVariable Integer pageNumber,
                                                @RequestParam("file") MultipartFile file,
                                                @RequestParam(required = false) Integer width,
                                                @RequestParam(required = false) Integer height) {
        return Result.success(templateService.uploadPageBackground(id, pageNumber, file, width, height));
    }

    @PutMapping("/pages/{pageId}/zones")
    public Result<Void> saveZones(@PathVariable Long pageId, @RequestBody List<ZoneSaveRequest> zones) {
        templateService.saveZones(pageId, zones);
        return Result.success();
    }

    /** 保存图层档案（FR-53/D15）：PSD 分层模板页的图层元数据 JSON 全量覆盖 */
    @PutMapping("/pages/{pageId}/layers")
    public Result<Void> saveLayers(@PathVariable Long pageId, @RequestBody String layersJson) {
        templateService.saveLayers(pageId, layersJson);
        return Result.success();
    }

    /** 上传图层 PNG（FR-52/IF-7）：返回图层访问 URL */
    @PostMapping("/pages/{pageId}/layers/images")
    public Result<String> uploadLayerImage(@PathVariable Long pageId, @RequestParam("file") MultipartFile file) {
        return Result.success(templateService.uploadLayerImage(pageId, file));
    }

    @PutMapping("/{id}/publish")
    public Result<Void> publish(@PathVariable Long id) {
        templateService.publishTemplate(id);
        return Result.success();
    }

    @PutMapping("/{id}/disable")
    public Result<Void> disable(@PathVariable Long id) {
        templateService.disableTemplate(id);
        return Result.success();
    }

    @PutMapping("/{id}/enable")
    public Result<Void> enable(@PathVariable Long id) {
        templateService.enableTemplate(id);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        templateService.deleteTemplate(id);
        return Result.success();
    }
}