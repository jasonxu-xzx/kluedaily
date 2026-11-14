# Renders tools/pfp.html to brand/kuedrop-pfp-square.jpg and brand/kuedrop-pfp-circle.jpg (2048x2048, JPEG quality 95)
# using headless Microsoft Edge (or Chrome). Run from the project root: powershell -File tools/make-pfp.ps1
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw "Edge or Chrome not found" }

$outDir = Join-Path $root "brand"
New-Item -ItemType Directory -Force $outDir | Out-Null
$profileDir = Join-Path $env:TEMP "kuedrop-make-pfp"
$src = "file:///" + ((Join-Path $root "tools\pfp.html") -replace '\\', '/')

foreach ($shape in "square", "circle") {
  $png = Join-Path $env:TEMP "kuedrop-pfp-$shape.png"
  & $browser --headless=new --disable-gpu --hide-scrollbars --no-first-run --force-device-scale-factor=1 "--user-data-dir=$profileDir" `
    --virtual-time-budget=6000 "--window-size=2048,2048" "--screenshot=$png" "$src`?shape=$shape" | Out-Null

  $img = [System.Drawing.Image]::FromFile($png)
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 95L
  $jpg = Join-Path $outDir "kuedrop-pfp-$shape.jpg"
  $img.Save($jpg, $codec, $params)
  "{0}: {1}x{2}, {3:N0} KB" -f (Split-Path -Leaf $jpg), $img.Width, $img.Height, ((Get-Item $jpg).Length / 1KB)
  $img.Dispose(); Remove-Item $png
}
Start-Sleep -Milliseconds 500
Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
