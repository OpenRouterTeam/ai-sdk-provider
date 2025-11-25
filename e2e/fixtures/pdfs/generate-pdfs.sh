#!/bin/bash
# Script to generate test PDFs with unique verification codes
# Each PDF contains embedded text that can be used to verify end-to-end AI processing
#
# TODO: Dynamically randomize verification codes at generation time so fixtures can't be
#       guessed in advance. This would involve:
#       1. Generating a random code for each PDF at runtime
#       2. Writing both PDF and JSON metadata with the randomized code
#       3. Reading the code from the JSON in tests instead of hard-coding
#       This ensures the "needle" in the PDF cannot be known before execution.

set -e

# Verification codes
SMALL_CODE="SMALL-7X9Q2"
MEDIUM_CODE="MEDIUM-K4P8R"
LARGE_CODE="LARGE-M9N3T"
XLARGE_CODE="XLARGE-W6H5V"

echo "Generating test PDFs with verification codes..."
echo

# Small PDF (33KB) - Text only with minimal content
echo "Creating small.pdf with code $SMALL_CODE..."
convert -size 800x600 xc:white \
  -pointsize 36 -gravity center \
  -annotate +0-150 'SMALL PDF TEST' \
  -annotate +0-80 'Verification Code:' \
  -fill red -pointsize 42 \
  -annotate +0-20 "$SMALL_CODE" \
  -fill black -pointsize 18 \
  -annotate +0+60 'If you can read this code, PDF processing works.' \
  small_text.jpg

convert small_text.jpg small.pdf
rm small_text.jpg

# Medium PDF (813KB) - Text + some image padding
echo "Creating medium.pdf with code $MEDIUM_CODE..."
magick -size 1200x900 xc:white \
  -pointsize 48 -gravity center \
  -annotate +0-250 'MEDIUM PDF TEST' \
  -pointsize 32 \
  -annotate +0-150 'Verification Code:' \
  -fill blue -pointsize 38 \
  -annotate +0-80 "$MEDIUM_CODE" \
  -fill black -pointsize 20 \
  -annotate +0+20 'This is a medium test document.' \
  -annotate +0+60 'Code confirms AI processed the PDF.' \
  medium_base.pdf

# Add filler images to increase size
magick -size 1000x1000 plasma:fractal med_fill1.jpg
magick -size 1000x1000 plasma:fractal med_fill2.jpg
magick medium_base.pdf med_fill1.jpg med_fill2.jpg medium.pdf
rm medium_base.pdf med_fill*.jpg

# Large PDF (3.4MB) - Text + more image padding
echo "Creating large.pdf with code $LARGE_CODE..."
magick -size 1600x1200 xc:white \
  -pointsize 60 -gravity center \
  -annotate +0-350 'LARGE PDF TEST' \
  -pointsize 40 \
  -annotate +0-250 'Verification Code:' \
  -fill green -pointsize 46 \
  -annotate +0-170 "$LARGE_CODE" \
  -fill black -pointsize 24 \
  -annotate +0-80 'Large test document for PDF uploads.' \
  -annotate +0-40 'Verification code confirms processing.' \
  large_base.pdf

# Add filler images to increase size
magick -size 1500x1500 plasma:fractal lg_fill1.jpg
magick -size 1500x1500 plasma:fractal lg_fill2.jpg
magick -size 1500x1500 plasma:fractal lg_fill3.jpg
magick -size 1500x1500 plasma:fractal lg_fill4.jpg
magick large_base.pdf lg_fill1.jpg lg_fill2.jpg lg_fill3.jpg lg_fill4.jpg large.pdf
rm large_base.pdf lg_fill*.jpg

# XLarge PDF (11MB) - Text + lots of image padding
echo "Creating xlarge.pdf with code $XLARGE_CODE..."
magick -size 2000x1500 xc:white \
  -pointsize 72 -gravity center \
  -annotate +0-450 'XLARGE PDF TEST' \
  -pointsize 48 \
  -annotate +0-330 'Verification Code:' \
  -fill purple -pointsize 56 \
  -annotate +0-240 "$XLARGE_CODE" \
  -fill black -pointsize 28 \
  -annotate +0-140 'Extra-large test document.' \
  -annotate +0-100 'Code confirms AI read the PDF.' \
  xlarge_base.pdf

# Add many filler images to increase size
for i in {1..8}; do
  magick -size 2000x2000 plasma:fractal xl_fill$i.jpg
done
magick xlarge_base.pdf xl_fill*.jpg xlarge.pdf
rm xlarge_base.pdf xl_fill*.jpg

echo
echo "✓ PDF generation complete!"
echo
echo "Generating JSON metadata files..."
echo

# Create JSON metadata for each PDF with verification code
# Format: { "verificationCode": "CODE", "description": "...", "size": "...", "type": "test_fixture" }

cat > small.json << EOF
{
  "verificationCode": "$SMALL_CODE",
  "description": "Small test PDF (33KB) with minimal content",
  "size": "small",
  "type": "test_fixture",
  "purpose": "Test basic PDF processing with FileParserPlugin"
}
EOF
echo "  ✓ small.json"

cat > medium.json << EOF
{
  "verificationCode": "$MEDIUM_CODE",
  "description": "Medium test PDF (813KB) with text and image padding",
  "size": "medium",
  "type": "test_fixture",
  "purpose": "Test PDF processing with moderate file size"
}
EOF
echo "  ✓ medium.json"

cat > large.json << EOF
{
  "verificationCode": "$LARGE_CODE",
  "description": "Large test PDF (3.4MB) for FileParserPlugin regression testing",
  "size": "large",
  "type": "test_fixture",
  "purpose": "Test large PDF handling and plugin activation",
  "regression": "Validates fix for FileParserPlugin large PDF issue"
}
EOF
echo "  ✓ large.json"

cat > xlarge.json << EOF
{
  "verificationCode": "$XLARGE_CODE",
  "description": "Extra-large test PDF (11MB) with extensive content",
  "size": "xlarge",
  "type": "test_fixture",
  "purpose": "Test maximum file size handling with FileParserPlugin"
}
EOF
echo "  ✓ xlarge.json"

echo
echo "Generated files:"
ls -lh *.pdf *.json
echo
echo "Verification codes:"
echo "  small.pdf  -> $SMALL_CODE   (small.json)"
echo "  medium.pdf -> $MEDIUM_CODE  (medium.json)"
echo "  large.pdf  -> $LARGE_CODE   (large.json)"
echo "  xlarge.pdf -> $XLARGE_CODE  (xlarge.json)"
echo
echo "Validating PDFs..."
for pdf in small.pdf medium.pdf large.pdf xlarge.pdf; do
  if qpdf --check "$pdf" &>/dev/null; then
    echo "  ✓ $pdf is valid"
  else
    echo "  ✗ $pdf has issues"
  fi
done
echo
echo "Validating JSON metadata..."
for json in small.json medium.json large.json xlarge.json; do
  if python3 -m json.tool "$json" > /dev/null 2>&1; then
    echo "  ✓ $json is valid"
  else
    echo "  ✗ $json has syntax errors"
  fi
done
