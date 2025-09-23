#!/bin/bash

# WordPress Plugin Build Script
# Creates installable plugin archives from source

PLUGIN_NAME="cms-automation-bridge"
SOURCE_DIR="wp-headless-cms-bridge"

echo "🔨 Building WordPress Plugin: $PLUGIN_NAME"
echo "📁 Source directory: $SOURCE_DIR"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory '$SOURCE_DIR' not found"
    exit 1
fi

# Clean up old archives
echo "🧹 Cleaning up old archives..."
rm -f "$PLUGIN_NAME.zip" "$PLUGIN_NAME.tar.gz"

# Create ZIP file (preferred for WordPress)
echo "📦 Creating ZIP archive..."
python3 -c "
import zipfile
import os

def zip_directory(source_dir, output_file):
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, os.path.dirname(source_dir))
                zipf.write(file_path, arcname)

zip_directory('$SOURCE_DIR', '$PLUGIN_NAME.zip')
"

# Create TAR.GZ file (alternative format)
echo "📦 Creating TAR.GZ archive..."
tar -czf "$PLUGIN_NAME.tar.gz" "$SOURCE_DIR/"

# Display results
echo ""
echo "✅ Plugin archives created successfully:"
ls -lh "$PLUGIN_NAME.zip" "$PLUGIN_NAME.tar.gz"

echo ""
echo "📋 Installation Instructions:"
echo "1. For WordPress Admin:"
echo "   - Go to Plugins → Add New → Upload Plugin"
echo "   - Choose: $PLUGIN_NAME.zip"
echo "   - Click Install Now"
echo ""
echo "2. For Manual Installation:"
echo "   - Extract: $PLUGIN_NAME.zip"
echo "   - Upload to: /wp-content/plugins/"
echo "   - Rename folder to: cms-automation-bridge"
echo ""
echo "3. For FTP Installation:"
echo "   - Extract: $PLUGIN_NAME.tar.gz"
echo "   - Upload contents to: /wp-content/plugins/cms-automation-bridge/"
echo ""
echo "🎉 Ready to install!"