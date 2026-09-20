# Export the first worksheet of an .xlsx file to a JSON array of row objects.
# Column headers come from the first non-empty row; remaining rows become objects.
#
# Usage:
#   powershell -File scripts/xlsx-to-json.ps1 -Xlsx <file.xlsx> -OutJson <out.json>

param(
  [Parameter(Mandatory = $true)][string]$Xlsx,
  [Parameter(Mandatory = $true)][string]$OutJson
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$tmp = Join-Path $env:TEMP ("xlsx_" + [guid]::NewGuid().ToString('N'))
try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($Xlsx, $tmp)

  # Shared strings
  $strs = @()
  if (Test-Path (Join-Path $tmp 'xl\sharedStrings.xml')) {
    [xml]$ss = Get-Content (Join-Path $tmp 'xl\sharedStrings.xml') -Raw -Encoding UTF8
    foreach ($si in $ss.sst.si) {
      $strs += (($si.t -join '') -replace '\s+', ' ')
    }
  }

  # Sheet 1
  $sheetFile = Get-ChildItem (Join-Path $tmp 'xl\worksheets') -Filter 'sheet1.xml' | Select-Object -First 1
  [xml]$sh = Get-Content $sheetFile.FullName -Raw -Encoding UTF8

  function ColToNum([string]$ref) {
    $letters = $ref -replace '[0-9]', ''
    $n = 0
    foreach ($ch in $letters.ToCharArray()) { $n = $n * 26 + ([int][char]$ch - 64) }
    return $n
  }

  $rows = @()
  foreach ($row in $sh.worksheet.sheetData.row) {
    $cells = @{}
    foreach ($c in $row.c) {
      $cn = ColToNum $c.r
      $v = $c.v
      if ($c.t -eq 's') { $v = $strs[[int]$v] }
      $cells[$cn] = [string]$v
    }
    $rows += , $cells
  }

  # Header row = first row with any content
  $header = $null
  $start = 0
  for ($i = 0; $i -lt $rows.Count; $i++) {
    if ($rows[$i].Count -gt 0) { $header = $rows[$i]; $start = $i + 1; break }
  }
  if (-not $header) { Write-Error 'No header row found'; exit 1 }

  $maxCol = 0
  foreach ($k in $header.Keys) { if ($k -gt $maxCol) { $maxCol = $k } }

  $objs = @()
  for ($i = $start; $i -lt $rows.Count; $i++) {
    $cells = $rows[$i]
    if (-not $cells -or $cells.Count -eq 0) { continue }
    $obj = [ordered]@{}
    for ($c = 1; $c -le $maxCol; $c++) {
      $h = $header[$c]
      if ($null -eq $h -or $h -eq '') { continue }
      $obj[$h] = if ($cells.ContainsKey($c)) { $cells[$c] } else { '' }
    }
    $objs += $obj
  }

  $objs | ConvertTo-Json -Depth 4 | Set-Content -Path $OutJson -Encoding UTF8
  Write-Host "Wrote $OutJson ($($objs.Count) rows)"
}
finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
}
