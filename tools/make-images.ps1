# Renders tools/og.html -> site/og.png (1200x630) and site/favicon.svg -> site/apple-touch-icon.png (180x180)
# using headless Microsoft Edge (or Chrome). Run from the project root: powershell -File tools/make-images.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw "Edge or Chrome not found" }

$profileDir = Join-Path $env:TEMP "cd-make-images"
function Shot($src, $out, $size) {
  $url = "file:///" + ($src -replace '\\', '/')
  & $browser --headless=new --disable-gpu --hide-scrollbars --no-first-run "--user-data-dir=$profileDir" `
    --virtual-time-budget=4000 "--window-size=$size" "--screenshot=$out" $url | Out-Null
  Write-Host "wrote $out"
}

# Favicon page: SVG scaled to 180px on its own blue
$iconHtml = Join-Path $env:TEMP "cd-icon.html"
$svg = Get-Content -Raw (Join-Path $root "site\favicon.svg")
"<!doctype html><html><body style='margin:0;width:180px;height:180px;background:#1F46C8'>" + ($svg -replace '<svg ', '<svg width="180" height="180" ') + "</body></html>" | Out-File -Encoding utf8 $iconHtml

Shot (Join-Path $root "tools\og.html") (Join-Path $root "site\og.png") "1200,630"
Shot $iconHtml (Join-Path $root "site\apple-touch-icon.png") "180,180"
Start-Sleep -Milliseconds 500
Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
