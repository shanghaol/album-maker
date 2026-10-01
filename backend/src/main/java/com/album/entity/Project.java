package com.album.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("projects")
public class Project {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long templateId;
    private String title;
    private String status;
    /** 来源项目（重新编辑副本的溯源，FR-F7；NULL=原创） */
    private Long sourceId;
    private LocalDateTime submittedAt;
    private String h5Url;
    /** 关联模板类型（列表返回用，非表字段）：ALBUM/CREATIVE */
    @TableField(exist = false)
    private String templateType;
    /** 首页缩略图（列表返回用，取自第一页 project_pages.preview_url，需求 FR-F2） */
    @TableField(exist = false)
    private String previewUrl;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}