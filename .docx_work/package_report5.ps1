$ErrorActionPreference = 'Stop'
$source = Join-Path (Get-Location) '.docx_work\report5-template'
$stage = Join-Path (Get-Location) '.docx_work\report5-package'
$output = Join-Path (Get-Location) 'Report5_VietRide_Test_Documentation.docx'

if (Test-Path -LiteralPath $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}
Copy-Item -LiteralPath $source -Destination $stage -Recurse

$document = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="report5Html"/>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1247" w:right="1134" w:bottom="1134" w:left="1304"
        w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
'@
[IO.File]::WriteAllText((Join-Path $stage 'word\document.xml'), $document, [Text.UTF8Encoding]::new($false))

$relsPath = Join-Path $stage 'word\_rels\document.xml.rels'
$rels = [IO.File]::ReadAllText($relsPath)
$rels = $rels.Replace(
  '</Relationships>',
  '<Relationship Id="report5Html" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="report5.html"/></Relationships>'
)
[IO.File]::WriteAllText($relsPath, $rels, [Text.UTF8Encoding]::new($false))

$typesPath = Join-Path $stage '[Content_Types].xml'
$types = [IO.File]::ReadAllText($typesPath)
$types = $types.Replace('</Types>', '<Override PartName="/word/report5.html" ContentType="text/html"/></Types>')
[IO.File]::WriteAllText($typesPath, $types, [Text.UTF8Encoding]::new($false))

Copy-Item -LiteralPath '.docx_work\Report5_VietRide_Test_Documentation.html' -Destination (Join-Path $stage 'word\report5.html')

$zipPath = [IO.Path]::ChangeExtension($output, '.zip')
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -CompressionLevel Optimal
Move-Item -LiteralPath $zipPath -Destination $output
Get-Item -LiteralPath $output | Select-Object FullName, Length, LastWriteTime
