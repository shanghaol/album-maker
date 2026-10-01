package com.album.service;

import com.album.common.BusinessException;
import com.album.common.ImageUploadValidator;
import com.album.entity.Template;
import com.album.entity.TemplatePage;
import com.album.mapper.TemplateMapper;
import com.album.mapper.TemplatePageMapper;
import com.album.mapper.TemplateZoneMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 模板下架/恢复测试（FR-63/RULE-22/VER-95）：仅 PUBLISHED⇄DISABLED 双向迁移、
 * 非法迁移 400、恢复需满足发布前置（至少 1 页）。
 */
@ExtendWith(MockitoExtension.class)
class TemplateServiceDisableTest {

    @Mock
    private TemplateMapper templateMapper;

    @Mock
    private TemplatePageMapper templatePageMapper;

    @Mock
    private TemplateZoneMapper templateZoneMapper;

    @Mock
    private StorageService storageService;

    private TemplateService service;

    @BeforeAll
    static void initTableInfo() {
        MybatisConfiguration configuration = new MybatisConfiguration();
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(configuration, "");
        TableInfoHelper.initTableInfo(assistant, Template.class);
        TableInfoHelper.initTableInfo(assistant, TemplatePage.class);
    }

    @BeforeEach
    void setUp() {
        service = new TemplateService(templateMapper, templatePageMapper, templateZoneMapper, storageService, new ImageUploadValidator());
    }

    @Test
    void disablePublishedTemplateSucceeds() {
        Template template = new Template();
        template.setId(1L);
        template.setStatus("PUBLISHED");
        when(templateMapper.selectById(1L)).thenReturn(template);

        service.disableTemplate(1L);

        assertEquals("DISABLED", template.getStatus());
        verify(templateMapper).updateById(template);
    }

    @Test
    void disableDraftTemplateRejected() {
        Template template = new Template();
        template.setId(1L);
        template.setStatus("DRAFT");
        when(templateMapper.selectById(1L)).thenReturn(template);

        BusinessException e = assertThrows(BusinessException.class, () -> service.disableTemplate(1L));
        assertEquals(400, e.getCode());
    }

    @Test
    void enableDisabledTemplateSucceedsWhenPageExists() {
        Template template = new Template();
        template.setId(1L);
        template.setStatus("DISABLED");
        when(templateMapper.selectById(1L)).thenReturn(template);
        when(templatePageMapper.selectCount(any())).thenReturn(1L);

        service.enableTemplate(1L);

        assertEquals("PUBLISHED", template.getStatus());
        verify(templateMapper).updateById(template);
    }

    @Test
    void enableWithoutPageRejected() {
        Template template = new Template();
        template.setId(1L);
        template.setStatus("DISABLED");
        when(templateMapper.selectById(1L)).thenReturn(template);
        when(templatePageMapper.selectCount(any())).thenReturn(0L);

        assertThrows(BusinessException.class, () -> service.enableTemplate(1L));
    }

    @Test
    void enablePublishedTemplateRejected() {
        Template template = new Template();
        template.setId(1L);
        template.setStatus("PUBLISHED");
        when(templateMapper.selectById(1L)).thenReturn(template);

        BusinessException e = assertThrows(BusinessException.class, () -> service.enableTemplate(1L));
        assertEquals(400, e.getCode());
    }
}
