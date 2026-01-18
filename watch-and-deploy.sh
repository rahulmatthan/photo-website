#!/bin/bash

# Auto-deploy script for Photo Website
# Watches for image changes and automatically commits/pushes to GitHub

WATCH_DIR="/Users/rahul/Coding/Photo Website/static/images"
REPO_DIR="/Users/rahul/Coding/Photo Website"
CHECK_INTERVAL=5  # seconds between checks

echo "Watching for image changes in: $WATCH_DIR"
echo "Press Ctrl+C to stop"
echo ""

# Store initial state
get_state() {
    find "$WATCH_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" \) -exec stat -f "%m %N" {} \; 2>/dev/null | sort
}

last_state=$(get_state)

while true; do
    sleep $CHECK_INTERVAL

    current_state=$(get_state)

    if [ "$current_state" != "$last_state" ]; then
        echo ""
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Changes detected!"

        # Wait a moment for any file operations to complete
        sleep 2

        cd "$REPO_DIR"

        # Check if there are actual git changes
        if [ -n "$(git status --porcelain)" ]; then
            echo "Committing and pushing changes..."

            # Add all changes in images directory
            git add static/images/

            # Create commit message based on changes
            added=$(git diff --cached --name-only --diff-filter=A | wc -l | tr -d ' ')
            modified=$(git diff --cached --name-only --diff-filter=M | wc -l | tr -d ' ')
            deleted=$(git diff --cached --name-only --diff-filter=D | wc -l | tr -d ' ')
            renamed=$(git diff --cached --name-only --diff-filter=R | wc -l | tr -d ' ')

            msg="Update images:"
            [ "$added" -gt 0 ] && msg="$msg $added added,"
            [ "$modified" -gt 0 ] && msg="$msg $modified modified,"
            [ "$deleted" -gt 0 ] && msg="$msg $deleted deleted,"
            [ "$renamed" -gt 0 ] && msg="$msg $renamed renamed,"
            msg="${msg%,}"  # Remove trailing comma

            git commit -m "$msg"
            git push origin main

            echo "$(date '+%Y-%m-%d %H:%M:%S') - Deployed successfully!"
            echo ""
        else
            echo "No git changes to commit"
        fi

        last_state=$(get_state)
    fi
done
