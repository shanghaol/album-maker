package com.album.dto;

import lombok.Data;

@Data
public class ZoneSaveRequest {
    private String zoneType;
    /** RECT/ELLIPSE/POLYGON/COMPOUND，空按 RECT 处理 */
    private String shape;
    /** POLYGON/COMPOUND 的形状 op 列表 JSON */
    private String shapesJson;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private Double rotation;
    private String placeholderText;
    private Integer sortOrder;
}