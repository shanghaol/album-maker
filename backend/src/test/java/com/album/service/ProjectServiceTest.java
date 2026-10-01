package com.album.service;

import com.album.common.BusinessException;
import com.album.dto.SavePageRequest;
import com.album.entity.Project;
import com.album.entity.ProjectPage;
import com.album.entity.Template;
import com.album.mapper.ProjectMapper;
import com.album.mapper.ProjectPageMapper;
import com.album.mapper.TemplateMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.Serializable;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 项目服务测试：DRAFT 唯一性、提交状态校验、删除所有权校验、previewUrl 保留（#7）。
 */
@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectMapper projectMapper;

    @Mock
    private ProjectPageMapper projectPageMapper;

    @Mock
    private TemplateMapper templateMapper;

    private ProjectService service;

    @BeforeAll
    static void initTableInfo() {
        // 单测环境无 MyBatis 容器，手动注册实体元数据以支持 LambdaQueryWrapper
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, Project.class);
        TableInfoHelper.initTableInfo(assistant, ProjectPage.class);
        TableInfoHelper.initTableInfo(assistant, Template.class);
    }

    private ProjectService service() {
        return new ProjectService(projectMapper, projectPageMapper, templateMapper);
    }

    private Project project(Long id, Long userId, String status) {
        Project p = new Project();
        p.setId(id);
        p.setUserId(userId);
        p.setStatus(status);
        p.setTemplateId(2L);
        return p;
    }

    @Test
    void createProjectAllowsWhenNoDraft() {
        // 单草稿约束已取消：相册与创意项目均可并行创建多个草稿
        when(projectMapper.insert(any(Project.class))).thenReturn(1);
        Project created = service().createProject(1L, 2L, "title");
        assertEquals("DRAFT", created.getStatus());
    }

    @Test
    void submitRejectsNonDraftProject() {
        when(projectMapper.selectById(9L)).thenReturn(project(9L, 1L, "SUBMITTED"));
        assertThrows(BusinessException.class, () -> service().submitProject(9L, "/h5"));
    }

    @Test
    void abandonByOtherUserForbidden() {
        when(projectMapper.selectById(5L)).thenReturn(project(5L, 100L, "DRAFT"));
        assertThrows(BusinessException.class, () -> service().abandonProject(5L, 200L));
        verify(projectMapper, never()).deleteById(any(Serializable.class));
    }

    @Test
    void abandonByOwnerDeletesPagesAndProject() {
        when(projectMapper.selectById(5L)).thenReturn(project(5L, 100L, "DRAFT"));
        service().abandonProject(5L, 100L);
        verify(projectPageMapper).delete(any());
        verify(projectMapper).deleteById(5L);
    }

    @Test
    void savePageInsertsWhenMissing() {
        when(projectPageMapper.selectOne(any())).thenReturn(null);
        SavePageRequest req = new SavePageRequest();
        req.setPageNumber(1);
        req.setPageData("{}");
        service().savePage(7L, req);
        ArgumentCaptor<ProjectPage> captor = ArgumentCaptor.forClass(ProjectPage.class);
        verify(projectPageMapper).insert(captor.capture());
        assertEquals(1, captor.getValue().getPageNumber());
        verify(projectPageMapper, never()).updateById(any(ProjectPage.class));
    }

    @Test
    void savePageUpdateRetainsPreviewUrlWhenAbsent() {
        // 对应 MODIFICATION_LOG #7：请求未携带 previewUrl 时不得把库中现值刷成 null
        ProjectPage existing = new ProjectPage();
        existing.setId(11L);
        existing.setProjectId(7L);
        existing.setPageNumber(1);
        existing.setPageData("old");
        existing.setPreviewUrl("/uploads/keep.png");
        when(projectPageMapper.selectOne(any())).thenReturn(existing);

        SavePageRequest req = new SavePageRequest();
        req.setPageNumber(1);
        req.setPageData("new");
        req.setPreviewUrl(null);

        service().savePage(7L, req);

        ArgumentCaptor<ProjectPage> captor = ArgumentCaptor.forClass(ProjectPage.class);
        verify(projectPageMapper).updateById(captor.capture());
        assertEquals("new", captor.getValue().getPageData());
        assertEquals("/uploads/keep.png", captor.getValue().getPreviewUrl());
    }

    @Test
    void savePageUpdateOverwritesPreviewUrlWhenProvided() {
        ProjectPage existing = new ProjectPage();
        existing.setId(11L);
        existing.setPageNumber(1);
        existing.setPreviewUrl("/uploads/old.png");
        when(projectPageMapper.selectOne(any())).thenReturn(existing);

        SavePageRequest req = new SavePageRequest();
        req.setPageNumber(1);
        req.setPageData("new");
        req.setPreviewUrl("/uploads/new.png");

        service().savePage(7L, req);

        ArgumentCaptor<ProjectPage> captor = ArgumentCaptor.forClass(ProjectPage.class);
        verify(projectPageMapper).updateById(captor.capture());
        assertEquals("/uploads/new.png", captor.getValue().getPreviewUrl());
    }

    @Test
    void copyRejectsNonSubmittedSource() {
        when(projectMapper.selectById(5L)).thenReturn(project(5L, 100L, "DRAFT"));
        assertThrows(BusinessException.class, () -> service().copySubmittedProject(5L, 100L));
    }

    @Test
    void copyRejectsAlbumTemplate() {
        // 相册作品提交后不可变（FR-D6）：仅创意模板允许重新编辑
        when(projectMapper.selectById(9L)).thenReturn(project(9L, 1L, "SUBMITTED"));
        when(templateMapper.selectById(2L)).thenReturn(tpl(2L, "ALBUM"));
        assertThrows(BusinessException.class, () -> service().copySubmittedProject(9L, 1L));
    }

    @Test
    void copyAllowsWhenDraftExists() {
        // 单草稿约束已取消：已有进行中草稿时仍可复制重新编辑
        when(projectMapper.selectById(9L)).thenReturn(project(9L, 1L, "SUBMITTED"));
        when(templateMapper.selectById(2L)).thenReturn(tpl(2L, "CREATIVE"));
        when(projectMapper.insert(any(Project.class))).thenAnswer(inv -> {
            Project p = inv.getArgument(0);
            p.setId(98L);
            return 1;
        });
        Project copy = service().copySubmittedProject(9L, 1L);
        assertEquals("DRAFT", copy.getStatus());
    }

    @Test
    void copyCreatesDraftWithPages() {
        when(projectMapper.selectById(9L)).thenReturn(project(9L, 1L, "SUBMITTED"));
        when(templateMapper.selectById(2L)).thenReturn(tpl(2L, "CREATIVE"));
        when(projectMapper.insert(any(Project.class))).thenAnswer(inv -> {
            Project p = inv.getArgument(0);
            p.setId(99L);
            return 1;
        });
        ProjectPage sourcePage = new ProjectPage();
        sourcePage.setProjectId(9L);
        sourcePage.setPageNumber(1);
        sourcePage.setPageData("pd");
        sourcePage.setPreviewUrl("/uploads/t.jpg");
        when(projectPageMapper.selectList(any())).thenReturn(List.of(sourcePage));

        Project copy = service().copySubmittedProject(9L, 1L);

        assertEquals("DRAFT", copy.getStatus());
        ArgumentCaptor<ProjectPage> captor = ArgumentCaptor.forClass(ProjectPage.class);
        verify(projectPageMapper).insert(captor.capture());
        assertEquals(99L, captor.getValue().getProjectId());
        assertEquals("pd", captor.getValue().getPageData());
        assertEquals("/uploads/t.jpg", captor.getValue().getPreviewUrl());
    }

    private Template tpl(Long id, String type) {
        Template t = new Template();
        t.setId(id);
        t.setType(type);
        return t;
    }
}
