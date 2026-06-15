import { useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '../constants/app'
import initialProjects from '../data/initialProjects'

function loadProjects() {
  try {
    const storedProjects = localStorage.getItem(STORAGE_KEYS.projects)

    if (!storedProjects) {
      return initialProjects
    }

    const parsedProjects = JSON.parse(storedProjects)
    return Array.isArray(parsedProjects) ? parsedProjects : initialProjects
  } catch {
    return initialProjects
  }
}

function createProjectId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `project-${Date.now()}`
}

function useProjects() {
  const [projects, setProjects] = useState(loadProjects)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects))
    } catch {
      // Keep the in-memory project list usable when browser storage is blocked.
    }
  }, [projects])

  const filteredProjects = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase('ko-KR')

    if (!normalizedSearchTerm) {
      return projects
    }

    return projects.filter((project) =>
      project.title.toLocaleLowerCase('ko-KR').includes(normalizedSearchTerm),
    )
  }, [projects, searchTerm])

  function addProject(projectValues) {
    const newProject = {
      id: createProjectId(),
      ...projectValues,
      referenceCount: 0,
      brollCount: 0,
      checklistDone: 0,
      checklistTotal: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    }

    setProjects((currentProjects) => [newProject, ...currentProjects])
  }

  function updateProject(projectId, projectValues) {
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === projectId ? { ...project, ...projectValues } : project,
      ),
    )
  }

  function deleteProject(projectId) {
    setProjects((currentProjects) =>
      currentProjects.filter((project) => project.id !== projectId),
    )
  }

  return {
    projects,
    filteredProjects,
    searchTerm,
    setSearchTerm,
    addProject,
    updateProject,
    deleteProject,
  }
}

export default useProjects
