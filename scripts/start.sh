#!/bin/bash

echo "========================================"
echo "  Image Asset Management - Production"
echo "========================================"
echo

cd server

if [ ! -f .env ]; then
    echo "ERROR: .env file not found"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

if ! grep -q "DASHSCOPE_API_KEY" .env; then
    echo "WARNING: DASHSCOPE_API_KEY not configured"
    echo "Please configure API Key in .env file"
fi

echo "Starting server..."
echo "URL: http://localhost:3000"
echo

export NODE_ENV=production
node src/app.js