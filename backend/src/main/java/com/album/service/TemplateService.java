package com.album.service;

import com.album.common.BusinessException;
import com.album.common.ImageUploadValidator;
import com.album.dto.TemplateCreateRequest;
import com.album.dto.ZoneSaveRequest;
import com.album.entity.Template;
import com.album.entity.TemplatePage;
import com.album.entity.TemplateZone;
import com.album.mapper.TemplateMapper;
import com.album.mapper.TemplatePageMapper;
import com.album.mapper.TemplateZoneMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateService {

    /** 相册模板分类白名单，与用户端模板市场的筛选项保持一致 */
    private static final Set<String> ALBUM_CATEGORIES =
            Set.of("wedding", "travel", "family", "graduation", "other");

    /** 创意模板风格集（需求文档 SR-0），与相册分类解耦 */
    private static final Set<String> CREATIVE_STYLES =
            Set.of("minimal", "stripe", "polka", "halftone", "character");

    private static final Set<String> ALLOWED_TYPES = Set.of("ALBUM", "CREATIVE");

    /** 区域形状白名单：复合/多边形形状通过 shapes_json 携带几何，其余沿用 bbox 列 */
    private static final Set<String> ALLOWED_ZONE_SHAPES = Set.of("RECT", "ELLIPSE", "POLYGON", "COMPOUND");
    private static final Set<String> ALLOWED_SHAPE_OPS = Set.of("add", "subtract");

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    /**
     * 校验并归一区域形状：空值回退 RECT（兼容旧客户端/旧数据）；
     * POLYGON/COMPOUND 必须携带可解析的形状 op 数组，且坐标都在 0-1 范围内。
     */
    private String normalizeZoneShape(String shape, String shapesJson) {
        String normalized = (shape == null || shape.isBlank()) ? "RECT" : shape.trim().toUpperCase();
        if (!ALLOWED_ZONE_SHAPES.contains(normalized)) {
            throw BusinessException.badRequest("无效的区域形状: " + shape);
        }
        if ("POLYGON".equals(normalized) || "COMPOUND".equals(normalized)) {
            if (shapesJson == null || shapesJson.isBlank()) {
                throw BusinessException.badRequest("该形状需要 shapesJson 形状列表");
            }
            try {
                com.fasterxml.jackson.databind.JsonNode ops = objectMapper.readTree(shapesJson);
                if (!ops.isArray() || ops.isEmpty()) {
                    throw BusinessException.badRequest("shapesJson 必须为非空数组");
                }
                for (com.fasterxml.jackson.databind.JsonNode op : ops) {
                    String opName = op.path("op").asText("");
                    if (!ALLOWED_SHAPE_OPS.contains(opName)) {
                        throw BusinessException.badRequest("无效的形状操作: " + opName);
                    }
                    com.fasterxml.jackson.databind.JsonNode points = op.path("points");
                    if (points.isArray()) {
                        if (points.size() < 3 || points.size() > 500) {
                            throw BusinessException.badRequest("多边形顶点数须在 3-500 之间");
                        }
                        for (com.fasterxml.jackson.databind.JsonNode pt : points) {
                            double px = pt.path(0).asDouble(-1);
                            double py = pt.path(1).asDouble(-1);
                            if (px < 0 || px > 1 || py < 0 || py > 1) {
                                throw BusinessException.badRequest("多边形顶点坐标须在 0-1 之间");
                            }
                        }
                    }
                }
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                throw BusinessException.badRequest("shapesJson 不是合法 JSON");
            }
        }
        return normalized;
    }

    /**
     * 校验并归一分类：空值视为未分类（null），非白名单值拒绝。
     * 分类语义按模板类型分派：ALBUM→相册五分类，CREATIVE→创意风格集（需求 Q1）。
     */
    private String normalizeCategory(String type, String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        String trimmed = category.trim();
        Set<String> allowed = "CREATIVE".equals(type) ? CREATIVE_STYLES : ALBUM_CATEGORIES;
        if (!allowed.contains(trimmed)) {
            throw BusinessException.badRequest("无效的模板分类: " + trimmed);
        }
        return trimmed;
    }

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "ALBUM";
        }
        String trimmed = type.trim().toUpperCase();
        if (!ALLOWED_TYPES.contains(trimmed)) {
            throw BusinessException.badRequest("无效的模板类型: " + type);
        }
        return trimmed;
    }

    /**
     * 模板区域（template_zones）坐标语义：
     * x/y/width/height 均为 0-1 归一化值（相对页面宽高的百分比），
     * zoneType 为 PHOTO（用户上传照片，照片在区域内还可再偏移缩放）或 TEXT（占位文字）。
     * 编辑器与 H5 预览端按各自渲染尺寸将归一化坐标换算为实际像素，
     * 因此区域定义与页面实际像素尺寸（template_pages.width/height）解耦。
     * 保存区域采用"全删全插"策略（见 saveZones）。
     */

    private final TemplateMapper templateMapper;
    private final TemplatePageMapper templatePageMapper;
    private final TemplateZoneMapper templateZoneMapper;
    private final StorageService storageService;
    private final ImageUploadValidator imageUploadValidator;

    /**
     * 已发布模板列表：type 区分内容线（模板市场=ALBUM / 创意展示页=CREATIVE），缺省 ALBUM 保持旧客户端行为不变
     */
    public List<Template> listPublished(String category, String type) {
        LambdaQueryWrapper<Template> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Template::getStatus, "PUBLISHED");
        wrapper.eq(Template::getType, "CREATIVE".equals(type) ? "CREATIVE" : "ALBUM");
        if (category != null && !category.isEmpty()) {
            wrapper.eq(Template::getCategory, category);
        }
        wrapper.orderByDesc(Template::getCreatedAt);
        return templateMapper.selectList(wrapper);
    }

    public List<Template> listAll() {
        LambdaQueryWrapper<Template> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(Template::getCreatedAt);
        return templateMapper.selectList(wrapper);
    }

    public Template getById(Long id) {
        return templateMapper.selectById(id);
    }

    public List<TemplatePage> getPages(Long templateId) {
        LambdaQueryWrapper<TemplatePage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TemplatePage::getTemplateId, templateId)
                .orderByAsc(TemplatePage::getPageNumber);
        return templatePageMapper.selectList(wrapper);
    }

    public List<TemplateZone> getZones(Long pageId) {
        LambdaQueryWrapper<TemplateZone> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TemplateZone::getPageId, pageId)
                .orderByAsc(TemplateZone::getSortOrder);
        return templateZoneMapper.selectList(wrapper);
    }

    @Transactional
    public Template createTemplate(TemplateCreateRequest request) {
        String type = normalizeType(request.getType());
        Template template = new Template();
        template.setName(request.getName());
        template.setDescription(request.getDescription());
        template.setPageCount(request.getPageCount());
        template.setType(type);
        template.setCategory(normalizeCategory(type, request.getCategory()));
        template.setStatus("DRAFT");
        templateMapper.insert(template);

        if (request.getPages() != null) {
            for (TemplateCreateRequest.PageCreate pc : request.getPages()) {
                TemplatePage page = new TemplatePage();
                page.setTemplateId(template.getId());
                page.setPageNumber(pc.getPageNumber());
                page.setWidth(pc.getWidth());
                page.setHeight(pc.getHeight());
                templatePageMapper.insert(page);

                if (pc.getZones() != null) {
                    for (TemplateCreateRequest.ZoneCreate zc : pc.getZones()) {
                        TemplateZone zone = new TemplateZone();
                        zone.setPageId(page.getId());
                        zone.setZoneType(zc.getZoneType());
                        zone.setShape(normalizeZoneShape(zc.getShape(), zc.getShapesJson()));
                        zone.setShapesJson(zc.getShapesJson());
                        zone.setX(zc.getX());
                        zone.setY(zc.getY());
                        zone.setWidth(zc.getWidth());
                        zone.setHeight(zc.getHeight());
                        zone.setRotation(zc.getRotation() != null ? zc.getRotation() : 0.0);
                        zone.setPlaceholderText(zc.getPlaceholderText());
                        zone.setSortOrder(zc.getSortOrder());
                        templateZoneMapper.insert(zone);
                    }
                }
            }
        }
        return template;
    }

    @Transactional
    public Template createWithBackground(MultipartFile file, String name, String description, Integer pageCount, Integer width, Integer height, String category, String type) {
        imageUploadValidator.validate(file);
        String normalizedType = normalizeType(type);
        Template template = new Template();
        template.setName(name);
        template.setDescription(description);
        template.setPageCount(pageCount);
        template.setType(normalizedType);
        template.setCategory(normalizeCategory(normalizedType, category));
        template.setStatus("DRAFT");
        templateMapper.insert(template);

        String backgroundUrl = storageService.upload(file, "templates/" + template.getId());

        for (int i = 1; i <= pageCount; i++) {
            TemplatePage page = new TemplatePage();
            page.setTemplateId(template.getId());
            page.setPageNumber(i);
            page.setWidth(width != null ? width : 2480);
            page.setHeight(height != null ? height : 3508);
            if (i == 1) {
                page.setBackgroundUrl(backgroundUrl);
            }
            templatePageMapper.insert(page);
        }

        template.setCoverUrl(backgroundUrl);
        templateMapper.updateById(template);

        return template;
    }

    @Transactional
    public String uploadCover(Long templateId, MultipartFile file) {
        imageUploadValidator.validate(file);
        Template template = templateMapper.selectById(templateId);
        if (template == null) {
            throw BusinessException.notFound("模板不存在");
        }
        String url = storageService.upload(file, "templates/" + templateId);
        template.setCoverUrl(url);
        templateMapper.updateById(template);
        return url;
    }

    @Transactional
    public String uploadPageBackground(Long templateId, Integer pageNumber, MultipartFile file, Integer width, Integer height) {
        imageUploadValidator.validate(file);
        LambdaQueryWrapper<TemplatePage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TemplatePage::getTemplateId, templateId)
                .eq(TemplatePage::getPageNumber, pageNumber);
        TemplatePage page = templatePageMapper.selectOne(wrapper);
        if (page == null) {
            throw BusinessException.notFound("模板页不存在");
        }
        String url = storageService.upload(file, "templates/" + templateId);
        page.setBackgroundUrl(url);
        if (width != null && width > 0) page.setWidth(width);
        if (height != null && height > 0) page.setHeight(height);
        templatePageMapper.updateById(page);
        return url;
    }

    @Transactional
    public void saveZones(Long pageId, List<ZoneSaveRequest> zones) {
        LambdaQueryWrapper<TemplateZone> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TemplateZone::getPageId, pageId);
        templateZoneMapper.delete(wrapper);

        if (zones != null) {
            for (ZoneSaveRequest zc : zones) {
                TemplateZone zone = new TemplateZone();
                zone.setPageId(pageId);
                zone.setZoneType(zc.getZoneType());
                zone.setShape(normalizeZoneShape(zc.getShape(), zc.getShapesJson()));
                zone.setShapesJson(zc.getShapesJson());
                zone.setX(zc.getX());
                zone.setY(zc.getY());
                zone.setWidth(zc.getWidth());
                zone.setHeight(zc.getHeight());
                zone.setRotation(zc.getRotation() != null ? zc.getRotation() : 0.0);
                zone.setPlaceholderText(zc.getPlaceholderText());
                zone.setSortOrder(zc.getSortOrder() != null ? zc.getSortOrder() : 0);
                templateZoneMapper.insert(zone);
            }
        }
    }

    @Transactional
    public void updateCategory(Long id, String category) {
        Template template = templateMapper.selectById(id);
        if (template == null) {
            throw BusinessException.notFound("模板不存在");
        }
        // 分类白名单按模板类型分派（ALBUM→相册分类 / CREATIVE→创意风格集）
        template.setCategory(normalizeCategory(template.getType(), category));
        templateMapper.updateById(template);
    }

    @Transactional
    public void publishTemplate(Long id) {
        Template template = templateMapper.selectById(id);
        if (template == null) {
            throw BusinessException.notFound("模板不存在");
        }
        LambdaQueryWrapper<TemplatePage> pageWrapper = new LambdaQueryWrapper<>();
        pageWrapper.eq(TemplatePage::getTemplateId, id);
        if (templatePageMapper.selectCount(pageWrapper) == 0) {
            throw BusinessException.badRequest("请先上传模板页面");
        }
        template.setStatus("PUBLISHED");
        templateMapper.updateById(template);
    }

    /** 模板下架（FR-63/RULE-22）：仅 PUBLISHED→DISABLED；下架后用户端模板市场经 PUBLISHED 过滤自动不可见，存量项目不受影响 */
    @Transactional
    public void disableTemplate(Long id) {
        Template template = requireTemplate(id);
        if (!"PUBLISHED".equals(template.getStatus())) {
            throw BusinessException.badRequest("仅已发布模板可下架");
        }
        template.setStatus("DISABLED");
        templateMapper.updateById(template);
    }

    /** 模板恢复（FR-63/RULE-22）：仅 DISABLED→PUBLISHED；恢复需满足发布前置（至少 1 页） */
    @Transactional
    public void enableTemplate(Long id) {
        Template template = requireTemplate(id);
        if (!"DISABLED".equals(template.getStatus())) {
            throw BusinessException.badRequest("仅已下架模板可恢复");
        }
        LambdaQueryWrapper<TemplatePage> pageWrapper = new LambdaQueryWrapper<>();
        pageWrapper.eq(TemplatePage::getTemplateId, id);
        if (templatePageMapper.selectCount(pageWrapper) == 0) {
            throw BusinessException.badRequest("请先上传模板页面");
        }
        template.setStatus("PUBLISHED");
        templateMapper.updateById(template);
    }

    /** 保存图层档案（FR-53/D15）：PSD 分层模板页的图层元数据 JSON 全量覆盖 */
    @Transactional
    public void saveLayers(Long pageId, String layersJson) {
        TemplatePage page = templatePageMapper.selectById(pageId);
        if (page == null) {
            throw BusinessException.notFound("模板页不存在");
        }
        if (layersJson != null && layersJson.length() > 1024 * 1024) {
            throw BusinessException.badRequest("图层档案过大（≤1MB）");
        }
        page.setLayersJson(layersJson);
        templatePageMapper.updateById(page);
    }

    /** 上传图层 PNG（FR-52/IF-7）：图层资产落盘分层模板专属子目录，与用户端同等校验 */
    public String uploadLayerImage(Long pageId, MultipartFile file) {
        imageUploadValidator.validate(file);
        TemplatePage page = templatePageMapper.selectById(pageId);
        if (page == null) {
            throw BusinessException.notFound("模板页不存在");
        }
        return storageService.upload(file, "templates/layers/" + pageId);
    }

    private Template requireTemplate(Long id) {
        Template template = templateMapper.selectById(id);
        if (template == null) {
            throw BusinessException.notFound("模板不存在");
        }
        return template;
    }

    @Transactional
    public Template createFromPdf(MultipartFile file, String name, String description, int dpi, String category, String type) {
        if (dpi <= 0) dpi = 200;

        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            int pageCount = document.getNumberOfPages();
            if (pageCount <= 0) {
                throw BusinessException.badRequest("PDF文件无页面内容");
            }
            PDFRenderer renderer = new PDFRenderer(document);

            String normalizedType = normalizeType(type);
            Template template = new Template();
            template.setName(name);
            template.setDescription(description);
            template.setPageCount(pageCount);
            template.setType(normalizedType);
            template.setCategory(normalizeCategory(normalizedType, category));
            template.setStatus("DRAFT");
            templateMapper.insert(template);

            String firstPageUrl = null;
            for (int i = 0; i < pageCount; i++) {
                BufferedImage pageImage = renderer.renderImage(i, dpi / 72f);

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(pageImage, "JPEG", baos);
                byte[] imageBytes = baos.toByteArray();

                String subDir = "templates/" + template.getId();
                String imageUrl = storageService.upload(imageBytes, pageImage.getWidth(), pageImage.getHeight(),
                        "page_" + (i + 1) + ".jpg", subDir);

                if (i == 0) {
                    firstPageUrl = imageUrl;
                }

                TemplatePage page = new TemplatePage();
                page.setTemplateId(template.getId());
                page.setPageNumber(i + 1);
                page.setBackgroundUrl(imageUrl);
                page.setWidth(pageImage.getWidth());
                page.setHeight(pageImage.getHeight());
                templatePageMapper.insert(page);
            }

            template.setCoverUrl(firstPageUrl);
            templateMapper.updateById(template);

            log.info("PDF模板创建成功: id={}, name={}, pages={}, dpi={}", template.getId(), name, pageCount, dpi);
            return template;
        } catch (IOException e) {
            log.error("PDF解析失败: name={}", name, e);
            throw new BusinessException("PDF文件解析失败: " + e.getMessage());
        }
    }

    @Transactional
    public void deleteTemplate(Long id) {
        Template template = templateMapper.selectById(id);
        if (template == null) {
            return;
        }

        LambdaQueryWrapper<TemplatePage> pageWrapper = new LambdaQueryWrapper<>();
        pageWrapper.eq(TemplatePage::getTemplateId, id);
        List<TemplatePage> pages = templatePageMapper.selectList(pageWrapper);

        for (TemplatePage page : pages) {
            LambdaQueryWrapper<TemplateZone> zoneWrapper = new LambdaQueryWrapper<>();
            zoneWrapper.eq(TemplateZone::getPageId, page.getId());
            templateZoneMapper.delete(zoneWrapper);
            if (page.getBackgroundUrl() != null) {
                storageService.delete(page.getBackgroundUrl());
            }
        }
        templatePageMapper.delete(pageWrapper);

        if (template.getCoverUrl() != null) {
            storageService.delete(template.getCoverUrl());
        }
        templateMapper.deleteById(id);
    }
}