param(
  [string]$ExtractedDir = ".docx_work/extracted",
  [string]$OutputDocx = "VietRide_Function_Details_Draft_completed.docx"
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem

$ErrorActionPreference = "Stop"

function Decode-XmlText([string]$value) {
  return [System.Net.WebUtility]::HtmlDecode($value)
}

function Get-ParagraphText([string]$paragraphXml) {
  $parts = [regex]::Matches($paragraphXml, '<w:t[^>]*>([\s\S]*?)</w:t>')
  return (($parts | ForEach-Object { Decode-XmlText $_.Groups[1].Value }) -join "")
}

function New-Font($name, [float]$size, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Regular) {
  return [System.Drawing.Font]::new($name, $size, $style, [System.Drawing.GraphicsUnit]::Point)
}

function New-Brush([string]$hex) {
  return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen([string]$hex, [float]$width = 1) {
  return [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($hex), $width)
}

function Fill-RoundRect($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-RoundRect($g, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.DrawPath($pen, $path)
  $path.Dispose()
}

function Draw-Text($g, [string]$text, $font, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [string]$align = "Near") {
  $format = [System.Drawing.StringFormat]::new()
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $format.Alignment = [System.Drawing.StringAlignment]::$align
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $g.DrawString($text, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $w, $h), $format)
  $format.Dispose()
}

function Draw-Button($g, [string]$label, [float]$x, [float]$y, [float]$w, [float]$h, [string]$fill = "#42A8A8") {
  $b = New-Brush $fill
  Fill-RoundRect $g $b $x $y $w $h 12
  $font = New-Font "Segoe UI" 11 ([System.Drawing.FontStyle]::Bold)
  $white = New-Brush "#FFFFFF"
  Draw-Text $g $label $font $white $x ($y + 8) $w $h "Center"
  $font.Dispose(); $white.Dispose(); $b.Dispose()
}

function Draw-Field($g, [string]$label, [float]$x, [float]$y, [float]$w) {
  $muted = New-Brush "#6B7280"
  $dark = New-Brush "#111827"
  $font = New-Font "Segoe UI" 9
  $fieldFont = New-Font "Segoe UI" 10
  Draw-Text $g $label $font $muted $x $y $w 22
  $white = New-Brush "#FFFFFF"; $border = New-Pen "#D1D5DB" 1
  Fill-RoundRect $g $white $x ($y + 24) $w 42 10
  Draw-RoundRect $g $border $x ($y + 24) $w 42 10
  Draw-Text $g ("Enter " + $label.ToLower()) $fieldFont $dark ($x + 14) ($y + 35) ($w - 28) 22
  $muted.Dispose(); $dark.Dispose(); $font.Dispose(); $fieldFont.Dispose(); $white.Dispose(); $border.Dispose()
}

function Draw-Table($g, [float]$x, [float]$y, [float]$w, [string[]]$headers) {
  $white = New-Brush "#FFFFFF"; $header = New-Brush "#ECFBFB"; $line = New-Pen "#E5E7EB" 1
  $text = New-Brush "#111827"; $muted = New-Brush "#6B7280"; $font = New-Font "Segoe UI" 9; $bold = New-Font "Segoe UI" 9 ([System.Drawing.FontStyle]::Bold)
  Fill-RoundRect $g $white $x $y $w 250 12
  Draw-RoundRect $g $line $x $y $w 250 12
  $g.FillRectangle($header, $x, $y, $w, 42)
  $colW = $w / $headers.Length
  for ($i = 0; $i -lt $headers.Length; $i++) {
    Draw-Text $g $headers[$i] $bold $text ($x + 12 + $i * $colW) ($y + 12) ($colW - 18) 22
  }
  for ($r = 0; $r -lt 4; $r++) {
    $rowY = $y + 42 + ($r * 50)
    $g.DrawLine($line, $x, $rowY, $x + $w, $rowY)
    for ($i = 0; $i -lt $headers.Length; $i++) {
      $rowValues = @(("VR-" + (1200 + $r * 9)), "Active", "Today", "Review")
      $value = $rowValues[$i % 4]
      Draw-Text $g $value $font ($(if ($i -eq 0) { $text } else { $muted })) ($x + 12 + $i * $colW) ($rowY + 16) ($colW - 18) 22
    }
  }
  $white.Dispose(); $header.Dispose(); $line.Dispose(); $text.Dispose(); $muted.Dispose(); $font.Dispose(); $bold.Dispose()
}

function Draw-Map($g, [float]$x, [float]$y, [float]$w, [float]$h) {
  $bg = New-Brush "#ECFBFB"; $road = New-Pen "#73D9D9" 8; $road2 = New-Pen "#A8E9E9" 4; $pin = New-Brush "#42A8A8"; $line = New-Pen "#D1D5DB" 1
  Fill-RoundRect $g $bg $x $y $w $h 16
  Draw-RoundRect $g $line $x $y $w $h 16
  $g.DrawBezier($road, $x + 60, $y + 210, $x + 250, $y + 60, $x + 420, $y + 320, $x + $w - 70, $y + 120)
  $g.DrawBezier($road2, $x + 80, $y + 80, $x + 210, $y + 250, $x + 510, $y + 20, $x + $w - 90, $y + 260)
  foreach ($p in @(@(($x + 88), ($y + 190)), @(($x + 330), ($y + 145)), @(($x + $w - 115), ($y + 105)))) {
    $g.FillEllipse($pin, $p[0], $p[1], 22, 22)
  }
  $bg.Dispose(); $road.Dispose(); $road2.Dispose(); $pin.Dispose(); $line.Dispose()
}

function Draw-PrototypeImage([string]$path, [string]$title, [string]$summary, [int]$index) {
  $w = 1200; $h = 675
  $bmp = [System.Drawing.Bitmap]::new($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $bg = New-Brush "#F9FAFB"; $g.FillRectangle($bg, 0, 0, $w, $h); $bg.Dispose()
  $sidebar = New-Brush "#FFFFFF"; $accent = New-Brush "#42A8A8"; $accentLight = New-Brush "#ECFBFB"; $dark = New-Brush "#111827"; $muted = New-Brush "#6B7280"; $line = New-Pen "#E5E7EB" 1
  $titleFont = New-Font "Segoe UI" 22 ([System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Font "Segoe UI" 10
  $smallFont = New-Font "Segoe UI" 8
  $labelFont = New-Font "Segoe UI" 11 ([System.Drawing.FontStyle]::Bold)

  Fill-RoundRect $g $sidebar 24 24 230 627 22
  Draw-RoundRect $g $line 24 24 230 627 22
  Fill-RoundRect $g $accent 50 52 42 42 10
  Draw-Text $g "VR" $labelFont (New-Brush "#FFFFFF") 50 62 42 24 "Center"
  Draw-Text $g "VietRide" $labelFont $dark 104 50 120 26
  Draw-Text $g "UI prototype" $smallFont $muted 104 76 120 20
  $menu = @("Dashboard", "Trips", "Bookings", "Parcels", "Vehicles", "Reports")
  for ($i = 0; $i -lt $menu.Count; $i++) {
    $y = 132 + ($i * 54)
    if ($i -eq ($index % $menu.Count)) {
      Fill-RoundRect $g $accentLight 42 $y 190 38 9
      $g.FillRectangle($accent, 42, $y, 5, 38)
    }
    Draw-Text $g $menu[$i] $bodyFont ($(if ($i -eq ($index % $menu.Count)) { $dark } else { $muted })) 64 ($y + 10) 140 20
  }

  Fill-RoundRect $g (New-Brush "#FFFFFF") 278 24 898 627 22
  Draw-RoundRect $g $line 278 24 898 627 22
  Draw-Text $g $title $titleFont $dark 312 54 590 72
  Draw-Text $g $summary $bodyFont $muted 314 138 690 42
  Draw-Button $g "Primary action" 1010 58 128 40

  $lower = $title.ToLowerInvariant()
  $kind = "table"
  if ($lower -match "track|gps|route|stop|eta|fleet|map|location") { $kind = "map" }
  elseif ($lower -match "register|password|checkout|create|update|configure|settings|review|profile|top-up|cancel|report|confirmation|consent") { $kind = "form" }
  elseif ($lower -match "payment|wallet|settlement|revenue|payout|invoice") { $kind = "payment" }
  elseif ($lower -match "chat|rag|notification|push") { $kind = "chat" }
  elseif ($lower -match "dashboard|report|export|statistics") { $kind = "dashboard" }

  if ($kind -eq "map") {
    Draw-Map $g 314 180 556 370
    Fill-RoundRect $g (New-Brush "#FFFFFF") 900 180 228 370 16
    Draw-RoundRect $g $line 900 180 228 370 16
    Draw-Text $g "Live status" $labelFont $dark 924 204 160 26
    foreach ($i in 0..3) {
      Draw-Text $g @("Current bus", "Next stop", "ETA", "Incident")[$i] $smallFont $muted 924 (250 + $i * 58) 120 18
      Draw-Text $g @("On route", "Da Nang", "18 min", "None")[$i] $bodyFont $dark 924 (270 + $i * 58) 150 22
    }
  } elseif ($kind -eq "form") {
    Draw-Field $g "Name / Code" 326 190 360
    Draw-Field $g "Contact / Detail" 326 280 360
    Draw-Field $g "Status / Policy" 326 370 360
    Fill-RoundRect $g (New-Brush "#ECFBFB") 730 190 360 188 16
    Draw-Text $g "Validation summary" $labelFont $dark 754 216 250 24
    Draw-Text $g "Required fields, role permissions, and business rules are checked before submission." $bodyFont $muted 754 254 280 70
    Draw-Button $g "Save / Submit" 754 430 160 42
    Draw-Button $g "Cancel" 930 430 110 42 "#94A3B8"
  } elseif ($kind -eq "payment") {
    foreach ($i in 0..2) {
      Fill-RoundRect $g (New-Brush "#ECFBFB") (326 + $i * 245) 185 210 96 16
      Draw-Text $g @("Balance", "Pending", "Completed")[$i] $smallFont $muted (350 + $i * 245) 208 120 18
      Draw-Text $g @("2,450,000 VND", "8 requests", "96.4%")[$i] $labelFont $dark (350 + $i * 245) 232 150 28
    }
    Draw-Table $g 326 320 770 @("Ref", "Type", "Amount", "Status")
  } elseif ($kind -eq "chat") {
    Fill-RoundRect $g (New-Brush "#FFFFFF") 326 182 520 360 18
    Draw-RoundRect $g $line 326 182 520 360 18
    foreach ($i in 0..3) {
      $bx = if ($i % 2 -eq 0) { 356 } else { 520 }
      $bw = if ($i % 2 -eq 0) { 330 } else { 280 }
      Fill-RoundRect $g ($(if ($i % 2 -eq 0) { New-Brush "#ECFBFB" } else { New-Brush "#42A8A8" })) $bx (215 + $i * 66) $bw 42 14
      Draw-Text $g @("Ask about policy", "Answer from knowledge base", "Open related record", "Notify user")[$i] $bodyFont ($(if ($i % 2 -eq 0) { $dark } else { New-Brush "#FFFFFF" })) ($bx + 18) (225 + $i * 66) ($bw - 36) 24
    }
    Draw-Table $g 880 182 228 @("Audit", "Status")
  } elseif ($kind -eq "dashboard") {
    foreach ($i in 0..3) {
      Fill-RoundRect $g (New-Brush "#FFFFFF") (326 + ($i % 2) * 260) (188 + [math]::Floor($i / 2) * 122) 230 90 16
      Draw-RoundRect $g $line (326 + ($i % 2) * 260) (188 + [math]::Floor($i / 2) * 122) 230 90 16
      Draw-Text $g @("Trips", "Bookings", "Revenue", "Alerts")[$i] $smallFont $muted (350 + ($i % 2) * 260) (210 + [math]::Floor($i / 2) * 122) 120 18
      Draw-Text $g @("128", "2,340", "86.2M", "12")[$i] $labelFont $dark (350 + ($i % 2) * 260) (236 + [math]::Floor($i / 2) * 122) 140 28
    }
    Draw-Table $g 326 446 770 @("Metric", "Today", "Trend", "Action")
  } else {
    Draw-Table $g 326 190 770 @("ID", "Name", "Status", "Action")
    Draw-Button $g "Filter" 326 472 110 40 "#94A3B8"
    Draw-Button $g "Export" 452 472 116 40
  }

  Draw-Text $g ("Function prototype " + $index.ToString("00")) $smallFont $muted 948 614 190 22 "Far"

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  $sidebar.Dispose(); $accent.Dispose(); $accentLight.Dispose(); $dark.Dispose(); $muted.Dispose(); $line.Dispose()
  $titleFont.Dispose(); $bodyFont.Dispose(); $smallFont.Dispose(); $labelFont.Dispose()
}

function New-DrawingParagraph([int]$idx, [string]$rid, [string]$title) {
  $cx = 5212080
  $cy = 2931795
  $docPrId = 5000 + $idx
  $safeTitle = [System.Security.SecurityElement]::Escape($title)
  return @"
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="$cx" cy="$cy"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="$docPrId" name="VietRide UI prototype $idx" descr="$safeTitle"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="$idx" name="ui_$idx.png" descr="$safeTitle"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="$rid"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="$cx" cy="$cy"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
"@
}

$documentPath = Join-Path $ExtractedDir "word/document.xml"
$relsPath = Join-Path $ExtractedDir "word/_rels/document.xml.rels"
$contentTypesPath = Join-Path $ExtractedDir "[Content_Types].xml"
$mediaDir = Join-Path $ExtractedDir "word/media"
$imageDir = ".docx_work/generated-ui"
New-Item -ItemType Directory -Force -Path $mediaDir | Out-Null
New-Item -ItemType Directory -Force -Path $imageDir | Out-Null

$xml = Get-Content -LiteralPath $documentPath -Raw
$paragraphMatches = [regex]::Matches($xml, '<w:p[\s\S]*?</w:p>')
$paragraphTexts = @()
foreach ($match in $paragraphMatches) {
  $paragraphTexts += (Get-ParagraphText $match.Value)
}

$items = New-Object System.Collections.Generic.List[object]
for ($i = 0; $i -lt $paragraphTexts.Count; $i++) {
  if ($paragraphTexts[$i].Trim() -eq "[Insert screen mock-up / prototype image here]") {
    $title = if ($i -ge 2 -and $paragraphTexts[$i - 1] -eq "Screen layout:") { $paragraphTexts[$i - 2] } else { "VietRide screen" }
    $summary = ""
    for ($j = $i - 5; $j -lt $i; $j++) {
      if ($j -ge 0 -and $paragraphTexts[$j] -and $paragraphTexts[$j] -notin @("Purpose", "Interface", "Screen layout:")) {
        $summary = $paragraphTexts[$j]
        break
      }
    }
    $items.Add([pscustomobject]@{ Title = $title; Summary = $summary }) | Out-Null
  }
}

for ($i = 0; $i -lt $items.Count; $i++) {
  $num = $i + 1
  $png = Join-Path $imageDir ("ui_{0:D3}.png" -f $num)
  Draw-PrototypeImage $png $items[$i].Title $items[$i].Summary $num
  Copy-Item -LiteralPath $png -Destination (Join-Path $mediaDir ("image{0:D3}.png" -f $num)) -Force
}

$rels = Get-Content -LiteralPath $relsPath -Raw
for ($i = 0; $i -lt $items.Count; $i++) {
  $num = $i + 1
  $rid = "rIdUI$num"
  if ($rels -notmatch "Id=`"$rid`"") {
    $rel = "<Relationship Id=`"$rid`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image`" Target=`"media/image$($num.ToString("D3")).png`"/>"
    $rels = $rels -replace '</Relationships>', "$rel</Relationships>"
  }
}
Set-Content -LiteralPath $relsPath -Value $rels -NoNewline -Encoding UTF8

$contentTypes = Get-Content -LiteralPath $contentTypesPath -Raw
if ($contentTypes -notmatch 'Extension="png"') {
  $contentTypes = $contentTypes -replace '<Default Extension="rels"', '<Default Extension="png" ContentType="image/png"/><Default Extension="rels"'
  Set-Content -LiteralPath $contentTypesPath -Value $contentTypes -NoNewline -Encoding UTF8
}

$counter = 0
$patchedXml = [regex]::Replace($xml, '<w:p[\s\S]*?</w:p>', {
  param($m)
  $text = Get-ParagraphText $m.Value
  if ($text.Trim() -eq "[Insert screen mock-up / prototype image here]") {
    $script:counter++
    return New-DrawingParagraph $script:counter ("rIdUI$script:counter") $items[$script:counter - 1].Title
  }
  return $m.Value
})
Set-Content -LiteralPath $documentPath -Value $patchedXml -NoNewline -Encoding UTF8

$outputFullPath = [System.IO.Path]::GetFullPath($OutputDocx)
if (Test-Path -LiteralPath $outputFullPath) {
  Remove-Item -LiteralPath $outputFullPath -Force
}
[System.IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path $ExtractedDir), $outputFullPath)

Write-Output ("Inserted {0} UI prototype images into {1}" -f $items.Count, $outputFullPath)
