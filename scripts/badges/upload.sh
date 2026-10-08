#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -d "$1" ]]; then
  echo "usage: $0 <dir-of-webp-files>" >&2
  echo "env: BADGE_BUCKET (default studily-badges), BADGE_PREFIX (default badges/v1)" >&2
  exit 1
fi

dir="${1%/}"
bucket="${BADGE_BUCKET:-studily-badges}"
prefix="${BADGE_PREFIX:-badges/v1}"
prefix="${prefix%/}"

shopt -s nullglob
files=("$dir"/*.webp)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "no .webp files in $dir" >&2
  exit 1
fi

for other in "$dir"/*; do
  if [[ -f "$other" && "$other" != *.webp ]]; then
    echo "skipping non-webp file: $other" >&2
  fi
done

count=0
for file in "${files[@]}"; do
  key="$prefix/$(basename "$file")"
  echo "uploading $file -> $bucket/$key"
  npx --yes wrangler@latest r2 object put "$bucket/$key" \
    --remote \
    --file "$file" \
    --content-type image/webp \
    --cache-control "public, max-age=31536000, immutable"
  count=$((count + 1))
done

echo "uploaded $count file(s) to $bucket/$prefix/"
