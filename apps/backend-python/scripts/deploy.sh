#!/bin/bash

# Azure deployment script for Python backend

echo "Installing Python dependencies..."
pip install -r requirements.txt --no-cache-dir

echo "Python backend ready for startup"
