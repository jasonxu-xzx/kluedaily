# Finds each song's cover color bucket from its release artwork via the public iTunes Search API.
# The artwork is only analyzed in memory/temp (never stored or shown in the game); the output is a color name.
# Usage: powershell -File tools/cover-colors.ps1 [-Only id1,id2]   -> writes tools/cover-colors.csv for review
#
# Color rule: ignore near-gray pixels; if at least 20% of the cover is colorful, the bucket is its most common hue
# (Red, Orange, Yellow, Green, Blue, Purple, Pink). Otherwise the cover counts as Black or White.
param([string[]]$Only = @())
$ErrorActionPreference = "Stop"
$Only = @($Only | ForEach-Object { $_ -split ',' } | Where-Object { $_ })   # -File passes "a,b" as one string
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$songs = Get-Content -Raw -Encoding UTF8 (Join-Path $root "site\data\songs.json") | ConvertFrom-Json
$artists = Get-Content -Raw -Encoding UTF8 (Join-Path $root "site\data\artists.json") | ConvertFrom-Json
$norm = { param($s) ($s.ToLowerInvariant() -replace '[^\p{L}\p{N}]', '') }

# Releases iTunes matches wrongly by default: id -> words the right collection name contains
$albumHint = @{
  "dynamite" = "dynamite"; "butter" = "hottersweetercooler"; "seven" = "seven"; "gods-menu" = "golive"; "tell-me" = "wonderyears";
  "russian-roulette" = "russianroulette"; "how-you-like-that" = "howyoulikethat"; "cherish-my-love" = "illlikeyou";
  "youre-under-arrest" = "breakeven"; "me-gustas-tu" = "flowerbud"; "nobody" = "trilogy"
}
$badCollection = 'remix|live|japan|sped up|instrumental|acoustic|ver\.\)|version\)|anniversary|best of|collection|proof|mashup|soundtrack|works best'

function Get-Hue([System.Drawing.Color]$c) {
  $h = $c.GetHue()
  $mx = [Math]::Max($c.R, [Math]::Max($c.G, $c.B)) / 255.0; $mn = [Math]::Min($c.R, [Math]::Min($c.G, $c.B)) / 255.0
  $sv = if ($mx -eq 0) { 0 } else { ($mx - $mn) / $mx }
  if ($mx -lt 0.25 -or $sv -lt 0.25) { if ($mx -gt 0.6) { return "~White" } else { return "~Black" } }
  if ($h -lt 14 -or $h -ge 345) { if ($sv -lt 0.5 -and $mx -gt 0.8) { return "Pink" } else { return "Red" } }
  if ($h -lt 40) { return "Orange" }
  if ($h -lt 68) { return "Yellow" }
  if ($h -lt 165) { return "Green" }
  if ($h -lt 255) { return "Blue" }
  if ($h -lt 292) { return "Purple" }
  return "Pink"
}

$out = @()
$tmp = Join-Path $env:TEMP "kuedrop-cover.jpg"
foreach ($s in $songs) {
  if ($Only.Count -and $Only -notcontains $s.id) { continue }
  $artist = $artists.($s.artist).name
  $term = [Uri]::EscapeDataString("$artist $($s.title)")
  $row = [ordered]@{ id = $s.id; title = $s.title; artist = $artist; collection = ""; color = ""; share = ""; second = ""; note = "" }
  try {
    $res = Invoke-RestMethod -Uri "https://itunes.apple.com/search?term=$term&entity=song&limit=50&country=US" -TimeoutSec 20
    $t = & $norm $s.title; $a = & $norm $artist
    $hits = @($res.results | Where-Object { $n = & $norm $_.trackName; $n.StartsWith($t) -or $n -eq $t })
    $exact = @($hits | Where-Object { (& $norm ($_.trackName -replace '\s*[\(\[].*$', '')) -eq $t })
    if ($exact.Count) { $hits = $exact }
    $byArtist = @($hits | Where-Object { (& $norm $_.artistName).Contains($a) })
    if ($byArtist.Count) { $hits = $byArtist }
    $good = @($hits | Where-Object { $_.collectionName -notmatch $badCollection })
    if ($good.Count) { $hits = $good }
    if ($albumHint[$s.id]) { $h = @($hits | Where-Object { (& $norm $_.collectionName).Contains($albumHint[$s.id]) }); if ($h.Count) { $hits = $h } else { $row.note = "album hint not found" } }
    $best = $hits | Select-Object -First 1   # iTunes' own ranking: usually the original release
    if (-not $best) { $row.note = "no iTunes match"; $out += [pscustomobject]$row; Start-Sleep -Milliseconds 3200; continue }
    $row.collection = $best.collectionName
    Invoke-WebRequest -Uri ($best.artworkUrl100 -replace '100x100bb', '200x200bb') -OutFile $tmp -UseBasicParsing -TimeoutSec 20
    $img = [System.Drawing.Bitmap]::FromFile($tmp)
    $small = New-Object System.Drawing.Bitmap $img, 60, 60
    $img.Dispose()
    $counts = @{}
    for ($x = 0; $x -lt 60; $x++) { for ($y = 0; $y -lt 60; $y++) { $b = Get-Hue $small.GetPixel($x, $y); $counts[$b] = 1 + [int]$counts[$b] } }
    $small.Dispose(); Remove-Item $tmp -ErrorAction SilentlyContinue
    $hue = @($counts.GetEnumerator() | Where-Object { -not $_.Key.StartsWith("~") } | Sort-Object Value -Descending)
    $colorful = ($hue | Measure-Object Value -Sum).Sum
    if ($colorful -ge 720) { $row.color = $hue[0].Key; $row.share = [Math]::Round(100 * $hue[0].Value / 3600) }
    else { $w = [int]$counts["~White"]; $k = [int]$counts["~Black"]; if ($w -ge $k) { $row.color = "White"; $row.share = [Math]::Round(100 * $w / 3600) } else { $row.color = "Black"; $row.share = [Math]::Round(100 * $k / 3600) } }
    if ($hue.Count) { $row.second = "$($hue[0].Key) $([Math]::Round(100 * $hue[0].Value / 3600))% / colorful $([Math]::Round(100 * $colorful / 3600))%" }
  } catch { $row.note = "error: $($_.Exception.Message)" }
  $out += [pscustomobject]$row
  Write-Host ("{0,-28} {1,-7} {2,3}%  {3}" -f $s.id, $row.color, $row.share, $row.collection)
  Start-Sleep -Milliseconds 3200   # iTunes Search allows ~20 requests a minute
}
$out | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $root "tools\cover-colors.csv")
Write-Host "wrote tools/cover-colors.csv ($($out.Count) rows)"
