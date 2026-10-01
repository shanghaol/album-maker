package com.album.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SavePageRequest {
    @Min(value = 1, message = "页码必须大于0")
    private Integer pageNumber;
    @Size(max = 65536, message = "页面数据过大，最大允许64KB")
    private String pageData;
    private String previewUrl;
}