$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stage = Join-Path (Get-Location) '.docx_work\report5-package'
$output = Join-Path (Get-Location) 'Report5_VietRide_Test_Documentation.docx'
$zipPath = [IO.Path]::ChangeExtension($output, '.zip')
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
[IO.Compression.ZipFile]::CreateFromDirectory(
  $stage,
  $zipPath,
  [IO.Compression.CompressionLevel]::Optimal,
  $false
)
Move-Item -LiteralPath $zipPath -Destination $output
Get-Item -LiteralPath $output | Select-Object FullName, Length, LastWriteTime
