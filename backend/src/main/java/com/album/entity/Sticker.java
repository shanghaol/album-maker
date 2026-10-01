package com.album.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("stickers")
public class Sticker {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String category;
    private String imageUrl;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}