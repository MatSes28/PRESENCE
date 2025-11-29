#!/bin/bash

# Complete deployment setup script for Railway
echo "🚀 Starting CLIRDEC:PRESENCE deployment setup..."

# Build shared package
echo "📦 Building shared package..."
cd shared && npm run build && cd ..
if [ $? -ne 0 ]; then
    echo "❌ Shared package build failed"
    exit 1
fi

# Build client
echo "🎨 Building client..."
cd client && npm run build && cd ..
if [ $? -ne 0 ]; then
    echo "❌ Client build failed"
    exit 1
fi

# Copy client files to server public
echo "📋 Copying client files..."
mkdir -p server/public
cp -r client/dist/* server/public/

# Build server
echo "🔧 Building server..."
cd server && npm run build && cd ..
if [ $? -ne 0 ]; then
    echo "❌ Server build failed"
    exit 1
fi

# Run database migrations
echo "🗄️  Running database migrations..."
node migrate-db.js
if [ $? -ne 0 ]; then
    echo "❌ Database migration failed"
    exit 1
fi

echo "✅ Deployment setup completed successfully!"
echo ""
echo "🎯 Application is ready!"
echo "   Admin Login: admin@clsu.edu.ph / admin123"
echo "   All tables created and migrations applied"
echo "   Static assets deployed"