package com.album.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class TemplateCreateRequest {
    @NotBlank(message = "模板名称不能为空")
    private String name;
    private String description;
    @NotNull(message = "页数不能为空")
    @Min(value = 1, message = "页数至少为1")
    private Integer pageCount;
    /** 模板分类：ALBUM→相册五分类；CREATIVE→创意风格集，空为未分类 */
    private String category;
    /** 模板类型：ALBUM（默认）/CREATIVE */
    private String type;
    @Valid
    private List<PageCreate> pages;

    @Data
    public static class PageCreate {
        @NotNull(message = "页码不能为空")
        @Min(value = 1, message = "页码至少为1")
        private Integer pageNumber;
        @NotNull(message = "页面宽度不能为空")
        @Min(value = 1, message = "页面宽度至少为1")
        private Integer width;
        @NotNull(message = "页面高度不能为空")
        @Min(value = 1, message = "页面高度至少为1")
        private Integer height;
        @Valid
        private List<ZoneCreate> zones;
    }

    @Data
    public static class ZoneCreate {
        @NotBlank(message = "区域类型不能为空")
        private String zoneType;
        private String shape;
        private String shapesJson;
        @NotNull(message = "x坐标不能为空")
        private Double x;
        @NotNull(message = "y坐标不能为空")
        private Double y;
        @NotNull(message = "宽度不能为空")
        private Double width;
        @NotNull(message = "高度不能为空")
        private Double height;
        private Double rotation;
        private String placeholderText;
        private Integer sortOrder;
    }
}