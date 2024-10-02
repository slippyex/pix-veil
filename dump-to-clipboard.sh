#!/bin/bash
find src/ tests/ -name '*.ts' -exec cat {} + | xclip -selection clipboard
