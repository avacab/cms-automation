#!/bin/bash

# WordPress Plugin Build Script
# Creates installable plugin archives from source

PLUGIN_NAME="cms-automation-bridge"
SOURCE_DIR="wp-headless-cms-bridge"
MAIN_FILE="$SOURCE_DIR/wp-headless-cms-bridge.php"

# Function to get current version from plugin file
get_current_version() {
    grep -o "Version: [0-9]\+\.[0-9]\+\.[0-9]\+" "$MAIN_FILE" | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+"
}

CURRENT_VERSION=$(get_current_version)

echo "🔨 Building WordPress Plugin: $PLUGIN_NAME"
echo "📁 Source directory: $SOURCE_DIR"
echo "📊 Current version: $CURRENT_VERSION"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory '$SOURCE_DIR' not found"
    exit 1
fi

# Define versioned filenames
VERSIONED_ZIP="$PLUGIN_NAME-v$CURRENT_VERSION.zip"
VERSIONED_TAR="$PLUGIN_NAME-v$CURRENT_VERSION.tar.gz"

# Clean up old archives (including versioned ones)
echo "🧹 Cleaning up old archives..."
rm -f "$PLUGIN_NAME.zip" "$PLUGIN_NAME.tar.gz"
rm -f "$PLUGIN_NAME"-v*.zip "$PLUGIN_NAME"-v*.tar.gz

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

zip_directory('$SOURCE_DIR', '$VERSIONED_ZIP')
"

# Create TAR.GZ file (alternative format)
echo "📦 Creating TAR.GZ archive..."
tar -czf "$VERSIONED_TAR" "$SOURCE_DIR/"

# Create symlinks to the latest version (for backwards compatibility)
ln -sf "$VERSIONED_ZIP" "$PLUGIN_NAME.zip"
ln -sf "$VERSIONED_TAR" "$PLUGIN_NAME.tar.gz"

# Display results
echo ""
echo "✅ Plugin archives created successfully (v$CURRENT_VERSION):"
ls -lh "$VERSIONED_ZIP" "$VERSIONED_TAR"
echo ""
echo "📎 Symlinks for compatibility:"
ls -lh "$PLUGIN_NAME.zip" "$PLUGIN_NAME.tar.gz"

echo ""
echo "📋 Installation Instructions:"
echo "1. For WordPress Admin (Versioned):"
echo "   - Go to Plugins → Add New → Upload Plugin"
echo "   - Choose: $VERSIONED_ZIP"
echo "   - Click Install Now"
echo ""
echo "2. For WordPress Admin (Latest Symlink):"
echo "   - Go to Plugins → Add New → Upload Plugin"
echo "   - Choose: $PLUGIN_NAME.zip"
echo "   - Click Install Now"
echo ""
echo "3. For Manual Installation:"
echo "   - Extract: $VERSIONED_ZIP (or $PLUGIN_NAME.zip)"
echo "   - Upload to: /wp-content/plugins/"
echo "   - Rename folder to: cms-automation-bridge"
echo ""
echo "4. For FTP Installation:"
echo "   - Extract: $VERSIONED_TAR (or $PLUGIN_NAME.tar.gz)"
echo "   - Upload contents to: /wp-content/plugins/cms-automation-bridge/"
echo ""
echo "🎉 Ready to install!"