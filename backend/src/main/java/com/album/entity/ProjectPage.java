package com.album.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("project_pages")
public class ProjectPage {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long projectId;
    private Integer pageNumber;
    private String pageData;
    private String previewUrl;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}