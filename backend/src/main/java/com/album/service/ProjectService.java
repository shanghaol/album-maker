package com.album.service;

import com.album.common.BusinessException;
import com.album.dto.SavePageRequest;
import com.album.entity.Project;
import com.album.entity.ProjectPage;
import com.album.entity.Template;
import com.album.mapper.ProjectMapper;
import com.album.mapper.ProjectPageMapper;
import com.album.mapper.TemplateMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectMapper projectMapper;
    private final ProjectPageMapper projectPageMapper;
    private final TemplateMapper templateMapper;

    @Transactional
    public Project createProject(Long userId, Long templateId, String title) {
        Project project = new Project();
        project.setUserId(userId);
        project.setTemplateId(templateId);
        project.setTitle(title);
        project.setStatus("DRAFT");
        projectMapper.insert(project);
        return project;
    }

    public Project getCurrentProject(Long userId) {
        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Project::getUserId, userId)
                .eq(Project::getStatus, "DRAFT")
                .orderByDesc(Project::getCreatedAt)
                .last("LIMIT 1");
        return projectMapper.selectOne(wrapper);
    }

    public List<Project> getMyProjects(Long userId) {
        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Project::getUserId, userId)
                .orderByDesc(Project::getCreatedAt);
        List<Project> projects = projectMapper.selectList(wrapper);
        fillListExtras(projects);
        return projects;
    }

    /**
     * 批量回填列表展示用瞬态字段：首页缩略图（FR-F2）与模板类型（"重新编辑"入口区分，FR-D6）。
     * 两次批量查询，避免逐项目 N+1。
     */
    private void fillListExtras(List<Project> projects) {
        if (projects == null || projects.isEmpty()) {
            return;
        }
        List<Long> projectIds = projects.stream().map(Project::getId).collect(Collectors.toList());
        LambdaQueryWrapper<ProjectPage> pageWrapper = new LambdaQueryWrapper<>();
        pageWrapper.in(ProjectPage::getProjectId, projectIds)
                .eq(ProjectPage::getPageNumber, 1);
        Map<Long, String> previewMap = projectPageMapper.selectList(pageWrapper).stream()
                .filter(p -> p.getPreviewUrl() != null)
                .collect(Collectors.toMap(ProjectPage::getProjectId, ProjectPage::getPreviewUrl, (a, b) -> a));

        List<Long> templateIds = projects.stream().map(Project::getTemplateId).distinct().collect(Collectors.toList());
        Map<Long, String> typeMap = templateMapper.selectBatchIds(templateIds).stream()
                .collect(Collectors.toMap(Template::getId, t -> t.getType() == null ? "ALBUM" : t.getType()));

        for (Project p : projects) {
            p.setPreviewUrl(previewMap.get(p.getId()));
            p.setTemplateType(typeMap.get(p.getTemplateId()));
        }
    }

    public Project getById(Long id) {
        Project project = projectMapper.selectById(id);
        if (project != null) {
            // 回填模板类型（编辑器按类型分流转入相册/创意编辑器）
            Template tpl = templateMapper.selectById(project.getTemplateId());
            project.setTemplateType(tpl != null ? tpl.getType() : "ALBUM");
        }
        return project;
    }

    public List<ProjectPage> getProjectPages(Long projectId) {
        LambdaQueryWrapper<ProjectPage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProjectPage::getProjectId, projectId)
                .orderByAsc(ProjectPage::getPageNumber);
        return projectPageMapper.selectList(wrapper);
    }

    @Transactional
    public void savePage(Long projectId, SavePageRequest request) {
        LambdaQueryWrapper<ProjectPage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProjectPage::getProjectId, projectId)
                .eq(ProjectPage::getPageNumber, request.getPageNumber());
        ProjectPage page = projectPageMapper.selectOne(wrapper);
        if (page == null) {
            page = new ProjectPage();
            page.setProjectId(projectId);
            page.setPageNumber(request.getPageNumber());
            page.setPageData(request.getPageData());
            page.setPreviewUrl(request.getPreviewUrl());
            projectPageMapper.insert(page);
        } else {
            page.setPageData(request.getPageData());
            // 请求未携带 previewUrl 时保留库中现值，避免每次保存把已有预览图刷成 null
            if (request.getPreviewUrl() != null) {
                page.setPreviewUrl(request.getPreviewUrl());
            }
            projectPageMapper.updateById(page);
        }
    }

    @Transactional
    public void submitProject(Long projectId, String h5Url) {
        Project project = projectMapper.selectById(projectId);
        if (project == null) {
            throw BusinessException.notFound("项目不存在");
        }
        if (!"DRAFT".equals(project.getStatus())) {
            throw BusinessException.badRequest("项目状态不正确");
        }
        project.setStatus("SUBMITTED");
        project.setSubmittedAt(LocalDateTime.now());
        project.setH5Url(h5Url);
        projectMapper.updateById(project);
    }

    public List<Project> listSubmitted() {
        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Project::getStatus, "SUBMITTED")
                .orderByDesc(Project::getSubmittedAt);
        return projectMapper.selectList(wrapper);
    }

    public List<Project> searchProjects(String keyword, String status) {
        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(Project::getTitle, keyword)
                    .or()
                    .like(Project::getH5Url, keyword));
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(Project::getStatus, status);
        }
        wrapper.orderByDesc(Project::getCreatedAt);
        return projectMapper.selectList(wrapper);
    }

    @Transactional
    public void deleteProject(Long id) {
        LambdaQueryWrapper<ProjectPage> pageWrapper = new LambdaQueryWrapper<>();
        pageWrapper.eq(ProjectPage::getProjectId, id);
        projectPageMapper.delete(pageWrapper);
        projectMapper.deleteById(id);
    }

    @Transactional
    public void abandonProject(Long projectId, Long userId) {
        Project project = projectMapper.selectById(projectId);
        if (project == null || !project.getUserId().equals(userId)) {
            throw BusinessException.forbidden("无权操作");
        }
        LambdaQueryWrapper<ProjectPage> pageWrapper = new LambdaQueryWrapper<>();
        pageWrapper.eq(ProjectPage::getProjectId, projectId);
        projectPageMapper.delete(pageWrapper);
        projectMapper.deleteById(projectId);
    }

    /**
     * 复制已提交项目为新草稿（"重新编辑"，需求 SR-14）。
     * 校验：操作者为项目所有者、源项目为 SUBMITTED、且仅创意作品。
     * 事务内复制项目记录与全部页面数据。
     */
    @Transactional
    public Project copySubmittedProject(Long projectId, Long userId) {
        Project source = projectMapper.selectById(projectId);
        if (source == null) {
            throw BusinessException.notFound("项目不存在");
        }
        if (!source.getUserId().equals(userId)) {
            throw BusinessException.forbidden("无权操作该项目");
        }
        if (!"SUBMITTED".equals(source.getStatus())) {
            throw BusinessException.badRequest("仅已提交的作品可以重新编辑");
        }
        // 仅创意模板作品支持迭代（相册提交后不可变，需求 FR-D6）
        Template sourceTpl = templateMapper.selectById(source.getTemplateId());
        if (sourceTpl == null || !"CREATIVE".equals(sourceTpl.getType())) {
            throw BusinessException.badRequest("仅创意作品支持重新编辑");
        }

        Project copy = new Project();
        copy.setUserId(userId);
        copy.setTemplateId(source.getTemplateId());
        copy.setTitle(source.getTitle());
        copy.setStatus("DRAFT");
        // 溯源链：指向来源的根（来源若本身是副本则沿用其 source_id，FR-F7）
        copy.setSourceId(source.getSourceId() != null ? source.getSourceId() : source.getId());
        projectMapper.insert(copy);

        LambdaQueryWrapper<ProjectPage> pageWrapper = new LambdaQueryWrapper<>();
        pageWrapper.eq(ProjectPage::getProjectId, projectId)
                .orderByAsc(ProjectPage::getPageNumber);
        for (ProjectPage page : projectPageMapper.selectList(pageWrapper)) {
            ProjectPage pageCopy = new ProjectPage();
            pageCopy.setProjectId(copy.getId());
            pageCopy.setPageNumber(page.getPageNumber());
            pageCopy.setPageData(page.getPageData());
            pageCopy.setPreviewUrl(page.getPreviewUrl());
            projectPageMapper.insert(pageCopy);
        }
        return copy;
    }
}