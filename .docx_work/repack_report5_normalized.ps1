$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$stage = Join-Path (Get-Location) '.docx_work\report5-package'
$output = Join-Path (Get-Location) 'Report5_VietRide_Test_Documentation.docx'
if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }

$stream = [IO.File]::Open($output, [IO.FileMode]::CreateNew)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
  Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
    $entry = $archive.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream = [IO.File]::OpenRead($_.FullName)
    try {
      $fileStream.CopyTo($entryStream)
    } finally {
      $fileStream.Dispose()
      $entryStream.Dispose()
    }
  }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}
Get-Item -LiteralPath $output | Select-Object FullName, Length, LastWriteTime
