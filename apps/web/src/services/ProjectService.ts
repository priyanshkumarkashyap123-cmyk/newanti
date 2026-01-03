
/**
 * ProjectService - Manage User Projects
 */

export interface Project {
    _id: string;
    id?: string; // For compatibility
    name: string;
    description?: string;
    thumbnail?: string;
    data: any; // Structural model data
    updatedAt: string;
    createdAt: string;
    isPublic: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const ProjectService = {
    /**
     * List all projects for current user
     */
    async listProjects(token: string): Promise<Project[]> {
        const response = await fetch(`${API_BASE_URL}/api/project`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch projects');
        }

        const data = await response.json();
        return data.projects || [];
    },

    /**
     * Get specific project details
     */
    async getProject(id: string, token: string): Promise<Project> {
        const response = await fetch(`${API_BASE_URL}/api/project/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch project');
        }

        const data = await response.json();
        return data.project;
    },

    /**
     * Create a new project
     */
    async createProject(
        project: { name: string; description?: string; data: any; thumbnail?: string },
        token: string
    ): Promise<Project> {
        const response = await fetch(`${API_BASE_URL}/api/project`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(project)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create project');
        }

        const data = await response.json();
        return data.project;
    },

    /**
     * Update an existing project
     */
    async updateProject(
        id: string,
        updates: { name?: string; description?: string; data?: any; thumbnail?: string },
        token: string
    ): Promise<Project> {
        const response = await fetch(`${API_BASE_URL}/api/project/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            throw new Error('Failed to update project');
        }

        const data = await response.json();
        return data.project;
    },

    /**
     * Delete a project
     */
    async deleteProject(id: string, token: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/api/project/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete project');
        }
    }
};
