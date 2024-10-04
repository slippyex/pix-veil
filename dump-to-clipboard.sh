#!/bin/bash

# dump-to-clipboard.sh
#
# Usage:
#   ./dump-to-clipboard.sh            # Copies entire content to clipboard
#   ./dump-to-clipboard.sh N P        # Splits content into N parts and copies part P
#
# Parameters:
#   N - Number of parts to split the content into
#   P - Part number to copy to clipboard (1-based index)

# Function to display usage instructions
usage() {
    echo "Usage:"
    echo "  $0                # Copies entire content to clipboard"
    echo "  $0 N P            # Splits content into N parts and copies part P"
    echo ""
    echo "Parameters:"
    echo "  N - Number of parts to split the content into (positive integer)"
    echo "  P - Part number to copy to clipboard (1-based index, <= N)"
    exit 1
}

# Function to validate if a value is a positive integer
is_positive_integer() {
    [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

# Check the number of arguments
if [ "$#" -eq 0 ]; then
    # No parameters provided: Dump entire content to clipboard
    find src/ tests/ -name '*.ts' -exec cat {} + | xclip -selection clipboard
    echo "Entire content copied to clipboard."
elif [ "$#" -eq 2 ]; then
    NUM_SPLITS="$1"
    PART_NUMBER="$2"

    # Validate that NUM_SPLITS and PART_NUMBER are positive integers
    if ! is_positive_integer "$NUM_SPLITS"; then
        echo "Error: num_splits (N) must be a positive integer."
        usage
    fi

    if ! is_positive_integer "$PART_NUMBER"; then
        echo "Error: part_number (P) must be a positive integer."
        usage
    fi

    # Check that PART_NUMBER does not exceed NUM_SPLITS
    if [ "$PART_NUMBER" -gt "$NUM_SPLITS" ]; then
        echo "Error: part_number (P) cannot be greater than num_splits (N)."
        usage
    fi

    # Concatenate all .ts files
    CONCAT_CONTENT=$(find src/ tests/ -name '*.ts' -exec cat {} +)

    # Calculate total number of lines
    TOTAL_LINES=$(echo "$CONCAT_CONTENT" | wc -l)

    if [ "$TOTAL_LINES" -eq 0 ]; then
        echo "No content found in .ts files to copy."
        exit 1
    fi

    # Calculate lines per part
    LINES_PER_PART=$(( TOTAL_LINES / NUM_SPLITS ))
    REMAINDER=$(( TOTAL_LINES % NUM_SPLITS ))

    # Determine start and end line for the desired part
    START_LINE=1
    for (( i=1; i<=NUM_SPLITS; i++ )); do
        # Distribute the remainder among the first few parts
        if [ "$i" -le "$REMAINDER" ]; then
            END_LINE=$(( START_LINE + LINES_PER_PART ))
        else
            END_LINE=$(( START_LINE + LINES_PER_PART - 1 ))
        fi

        if [ "$i" -eq "$PART_NUMBER" ]; then
            # Extract the desired part and copy to clipboard
            PART_CONTENT=$(echo "$CONCAT_CONTENT" | sed -n "${START_LINE},${END_LINE}p")
            echo "$PART_CONTENT" | xclip -selection clipboard
            echo "Part $PART_NUMBER of $NUM_SPLITS copied to clipboard."
            exit 0
        fi

        # Update the start line for the next part
        START_LINE=$(( END_LINE + 1 ))
    done
else
    # Invalid number of arguments
    echo "Error: Invalid number of arguments."
    usage
fi
