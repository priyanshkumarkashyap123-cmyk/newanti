import json
import os
import uuid
from typing import List, Optional, Dict
from datetime import datetime

# Local storage path
STORAGE_DIR = "data/projects"
os.makedirs(STORAGE_DIR, exist_ok=True)

class ProjectRepository:
    """
    Persistence layer for Projects.
    Currently uses JSON files, but can be swapped for PostgreSQL.
    """
    
    @staticmethod
    def save_project(project_data: Dict) -> str:
        """Save project and return ID"""
        project_id = project_data.get("id") or str(uuid.uuid4())
        project_data["id"] = project_id
        project_data["lastModified"] = datetime.now().isoformat()
        
        file_path = os.path.join(STORAGE_DIR, f"{project_id}.json")
        with open(file_path, "w") as f:
            json.dump(project_data, f, indent=2)
            
        return project_id

    @staticmethod
    def get_project(project_id: str) -> Optional[Dict]:
        """Load project by ID"""
        file_path = os.path.join(STORAGE_DIR, f"{project_id}.json")
        if not os.path.exists(file_path):
            return None
            
        with open(file_path, "r") as f:
            return json.load(f)

    @staticmethod
    def list_projects() -> List[Dict]:
        """List all projects (summary)"""
        projects = []
        if not os.path.exists(STORAGE_DIR):
            return []
            
        for filename in os.listdir(STORAGE_DIR):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(STORAGE_DIR, filename), "r") as f:
                        data = json.load(f)
                        # Return summary info
                        projects.append({
                            "id": data.get("id"),
                            "name": data.get("projectInfo", {}).get("name", "Untitled"),
                            "lastModified": data.get("lastModified"),
                            "nodeCount": len(data.get("nodes", [])),
                            "memberCount": len(data.get("members", []))
                        })
                except Exception:
                    continue
        
        # Sort by last modified desc
        projects.sort(key=lambda x: x.get("lastModified", ""), reverse=True)
        return projects

    @staticmethod
    def delete_project(project_id: str) -> bool:
        """Delete project by ID"""
        file_path = os.path.join(STORAGE_DIR, f"{project_id}.json")
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
