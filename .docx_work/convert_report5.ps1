$ErrorActionPreference='Stop'
$html=(Resolve-Path '.docx_work\Report5_VietRide_Test_Documentation.html').Path
$out=Join-Path (Get-Location) 'Report5_VietRide_Test_Documentation.docx'
$pdf=Join-Path (Get-Location) '.docx_work\Report5_VietRide_Test_Documentation.pdf'
$word=New-Object -ComObject Word.Application; $word.Visible=$false; $word.DisplayAlerts=0
try { $doc=$word.Documents.Open($html,$false,$false); foreach($s in $doc.Sections){$f=$s.Footers.Item(1);$f.Range.Text='VietRide - Report 5 Software Test Documentation';$f.Range.Font.Name='Times New Roman';$f.Range.Font.Size=9;$f.Range.ParagraphFormat.Alignment=1;$f.PageNumbers.Add()|Out-Null}; $doc.SaveAs2($out,16); $doc.ExportAsFixedFormat($pdf,17); "PAGES=$($doc.ComputeStatistics(2))"; "WORDS=$($doc.Words.Count)"; "TABLES=$($doc.Tables.Count)"; $doc.Close($false) } finally {$word.Quit()}
