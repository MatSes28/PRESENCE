#!/bin/bash

# Setup admin user script for Railway
echo "Setting up admin user..."

# Build shared package if needed
cd shared && npm run build && cd ..

# Run the admin creation script
node create-admin.js

echo "Admin setup complete!"
echo "Email: admin@clsu.edu.ph"
echo "Password: admin123"