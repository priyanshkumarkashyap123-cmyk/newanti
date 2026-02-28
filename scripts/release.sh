#!/bin/bash

# Simple release script for bumping version and tagging

if [ -z "$1" ]; then
  echo "Usage: ./release.sh <increment>"
  echo "  increment: patch, minor, major"
  exit 1
fi

INCREMENT=$1

# increment version in root (or main app)
echo "Bumping version ($INCREMENT)..."
npm version $INCREMENT --no-git-tag-version

# Get new version
VERSION=$(node -p "require('./package.json').version")

# Create git tag
echo "Creating git tag v$VERSION..."
git add package.json pnpm-lock.yaml
git commit -m "chore: release v$VERSION"
git tag -a "v$VERSION" -m "Release v$VERSION"

echo "Done! Run 'git push --follow-tags' to publish."
