#!/bin/bash

# WordPress Plugin Build Script with Version Management
# Creates installable plugin archives and manages version numbers

PLUGIN_NAME="cms-automation-bridge"
SOURCE_DIR="wp-headless-cms-bridge"
MAIN_FILE="$SOURCE_DIR/wp-headless-cms-bridge.php"
CHANGELOG_FILE="CHANGELOG.md"

echo "🔨 Building WordPress Plugin: $PLUGIN_NAME"
echo "📁 Source directory: $SOURCE_DIR"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory '$SOURCE_DIR' not found"
    exit 1
fi

# Function to get current version from plugin file
get_current_version() {
    grep -o "Version: [0-9]\+\.[0-9]\+\.[0-9]\+" "$MAIN_FILE" | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+"
}

# Function to increment version
increment_version() {
    local version=$1
    local type=${2:-patch}  # major, minor, patch
    
    IFS='.' read -ra PARTS <<< "$version"
    local major=${PARTS[0]}
    local minor=${PARTS[1]}
    local patch=${PARTS[2]}
    
    case $type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch|*)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# Function to update version in files
update_version() {
    local old_version=$1
    local new_version=$2
    
    # Update plugin header
    sed -i "s/Version: $old_version/Version: $new_version/" "$MAIN_FILE"
    
    # Update version constant
    sed -i "s/define('WP_HEADLESS_CMS_BRIDGE_VERSION', '$old_version')/define('WP_HEADLESS_CMS_BRIDGE_VERSION', '$new_version')/" "$MAIN_FILE"
    
    echo "📝 Updated version from $old_version to $new_version"
}

# Function to update changelog
update_changelog() {
    local version=$1
    local date=$(date +%Y-%m-%d)
    
    # Create changelog entry
    local temp_file=$(mktemp)
    
    # Add new version entry after the title
    sed "/^# WordPress Plugin Changelog/r /dev/stdin" "$CHANGELOG_FILE" > "$temp_file" << EOF

## [$version] - $date

### Changed
- Version bump to $version

EOF
    
    mv "$temp_file" "$CHANGELOG_FILE"
    echo "📝 Updated changelog for version $version"
}

# Parse command line arguments
INCREMENT_TYPE="patch"
AUTO_VERSION=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --version-type)
            INCREMENT_TYPE="$2"
            AUTO_VERSION=true
            shift 2
            ;;
        --auto-increment)
            AUTO_VERSION=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--version-type major|minor|patch] [--auto-increment]"
            echo ""
            echo "Options:"
            echo "  --version-type TYPE   Specify version increment type (major, minor, patch)"
            echo "  --auto-increment      Automatically increment patch version"
            echo "  --help               Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Get current version
CURRENT_VERSION=$(get_current_version)
echo "📊 Current version: $CURRENT_VERSION"

# Handle version increment
if [ "$AUTO_VERSION" = true ]; then
    NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$INCREMENT_TYPE")
    echo "🔄 Auto-incrementing version to: $NEW_VERSION"
    
    update_version "$CURRENT_VERSION" "$NEW_VERSION"
    update_changelog "$NEW_VERSION"
    
    CURRENT_VERSION=$NEW_VERSION
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
echo "✅ Plugin archives created successfully (v$CURRENT_VERSION):"
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

if [ "$AUTO_VERSION" = true ]; then
    echo ""
    echo "⚡ Version Management:"
    echo "   - Version incremented to: v$CURRENT_VERSION"
    echo "   - Changelog updated"
    echo "   - Ready for git commit"
fi