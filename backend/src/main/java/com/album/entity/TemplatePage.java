package com.album.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("template_pages")
public class TemplatePage {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long templateId;
    private Integer pageNumber;
    private String backgroundUrl;
    private Integer width;
    private Integer height;
    /** 图层档案（FR-53/D15）：PSD 分层模板的图层元数据 JSON（每层 URL/名称/位置/尺寸/层叠/不透明度/可见性） */
    private String layersJson;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}