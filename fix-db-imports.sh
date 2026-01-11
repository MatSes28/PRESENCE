#!/bin/bash

# Fix all database import errors in the server codebase
# This script changes "import { db } from" to "import db from" in all TypeScript files

find server/src -name "*.ts" -exec sed -i 's/import { db } from/import db from/g' {} +

echo "✅ Fixed all database import statements"
echo "📊 Files modified:"
find server/src -name "*.ts" -exec grep -l "import db from" {} \;