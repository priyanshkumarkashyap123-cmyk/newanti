#!/usr/bin/env python3
"""
Test script for database project management routes
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

def test_db_routes():
    """Test that database routes can be imported and initialized"""
    try:
        from db_routes import router, init_db
        print("✅ Database routes imported successfully")

        # Test database initialization (this will create tables if they don't exist)
        init_db()
        print("✅ Database initialized successfully")

        return True
    except Exception as e:
        print(f"❌ Database routes test failed: {e}")
        return False

def test_project_model():
    """Test that Pydantic models work"""
    try:
        from db_routes import User, Project, ProjectAnalytics
        from datetime import datetime

        # Test User model
        user = User(
            clerk_id="test_user_123",
            email="test@example.com",
            name="Test User",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        print("✅ User model created successfully")

        # Test Project model
        project = Project(
            user_id="test_user_123",
            name="Test Project",
            description="A test project",
            project_data={"test": "data"},
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        print("✅ Project model created successfully")

        # Test ProjectAnalytics model
        analytics = ProjectAnalytics(
            project_id=1,
            user_id="test_user_123",
            action="test_action",
            metadata={"test": "metadata"},
            timestamp=datetime.now()
        )
        print("✅ ProjectAnalytics model created successfully")

        return True
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Database Project Management Implementation")
    print("=" * 50)

    success = True
    success &= test_db_routes()
    success &= test_project_model()

    print("=" * 50)
    if success:
        print("🎉 All tests passed! Ready for Phase 3.")
    else:
        print("❌ Some tests failed. Please check the implementation.")
        sys.exit(1)