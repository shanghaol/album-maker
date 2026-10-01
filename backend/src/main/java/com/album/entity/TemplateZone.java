package com.album.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("template_zones")
public class TemplateZone {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long pageId;
    private String zoneType;
    /** 区域形状：RECT（默认，兼容旧数据）/ELLIPSE/POLYGON/COMPOUND（多形状加减组合） */
    private String shape;
    /** POLYGON/COMPOUND 的形状列表 JSON：[{"op":"add|subtract","shape":...,"points":[[x,y],...]}, ...] */
    private String shapesJson;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private Double rotation;
    private String placeholderText;
    private Integer sortOrder;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}