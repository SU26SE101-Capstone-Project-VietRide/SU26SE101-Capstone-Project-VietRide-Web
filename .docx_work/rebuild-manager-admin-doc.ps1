param(
  [string]$InputDocx = "VietRide_Function_Details_Draft_completed.docx",
  [string]$OutputDocx = "VietRide_Function_Details_Manager_Admin.docx",
  [string]$WorkDir = ".docx_work/manager_admin_rebuild"
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$ErrorActionPreference = "Stop"

function Escape-Xml([string]$value) {
  return [System.Security.SecurityElement]::Escape($value)
}

function Paragraph([string]$text, [string]$style = "", [int]$size = 22, [bool]$bold = $false, [string]$color = "1F2937") {
  $styleXml = if ($style) { "<w:pStyle w:val=`"$style`"/>" } else { "" }
  $boldXml = if ($bold) { "<w:b/>" } else { "" }
  $escaped = Escape-Xml $text
  return "<w:p><w:pPr>$styleXml<w:spacing w:after=`"120`"/></w:pPr><w:r><w:rPr>$boldXml<w:color w:val=`"$color`"/><w:sz w:val=`"$size`"/></w:rPr><w:t>$escaped</w:t></w:r></w:p>"
}

function Heading([string]$text, [int]$level = 1) {
  $style = if ($level -eq 1) { "Heading1" } elseif ($level -eq 2) { "Heading2" } else { "Heading3" }
  $size = if ($level -eq 1) { 30 } elseif ($level -eq 2) { 26 } else { 23 }
  return Paragraph $text $style $size $true "0F766E"
}

function Placeholder() {
  return "<w:p><w:pPr><w:spacing w:before=`"80`" w:after=`"160`"/><w:ind w:left=`"360`"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val=`"6B7280`"/><w:sz w:val=`"20`"/></w:rPr><w:t>[Add UI screenshot here]</w:t></w:r></w:p>"
}

function FeatureBlock([string]$number, [string]$title, [string]$route, [string]$source, [string]$purpose, [string]$mainActions) {
  $xml = ""
  $xml += Heading "$number $title" 3
  $xml += Paragraph "Route: $route" "" 20 $true "374151"
  $xml += Paragraph "Source: $source" "" 20 $false "4B5563"
  $xml += Paragraph "Purpose: $purpose" "" 20 $false "1F2937"
  $xml += Paragraph "Main actions: $mainActions" "" 20 $false "1F2937"
  $xml += Placeholder
  return $xml
}

function Copy-DirectoryContent([string]$from, [string]$to) {
  if (Test-Path -LiteralPath $to) {
    Remove-Item -LiteralPath $to -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  Copy-Item -LiteralPath (Join-Path $from "*") -Destination $to -Recurse -Force
}

$inputFullPath = [System.IO.Path]::GetFullPath($InputDocx)
$outputFullPath = [System.IO.Path]::GetFullPath($OutputDocx)
$workFullPath = [System.IO.Path]::GetFullPath($WorkDir)
$zipPath = Join-Path $workFullPath "input.zip"
$extractPath = Join-Path $workFullPath "extracted"

if (Test-Path -LiteralPath $workFullPath) {
  Remove-Item -LiteralPath $workFullPath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $workFullPath | Out-Null
Copy-Item -LiteralPath $inputFullPath -Destination $zipPath -Force
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force

$documentPath = Join-Path $extractPath "word/document.xml"
$relsPath = Join-Path $extractPath "word/_rels/document.xml.rels"
$contentTypesPath = Join-Path $extractPath "[Content_Types].xml"
$mediaPath = Join-Path $extractPath "word/media"

$originalXml = Get-Content -LiteralPath $documentPath -Raw
$documentOpen = [regex]::Match($originalXml, '^[\s\S]*?<w:body>').Value
$sectPr = [regex]::Match($originalXml, '<w:sectPr[\s\S]*?</w:sectPr>').Value
if (-not $sectPr) {
  $sectPr = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
}

$body = ""
$body += Paragraph "VietRide Function Details - Manager and System Admin Scope" "" 34 $true "0F766E"
$body += Paragraph "Prepared from the current React source code. The document now includes only visible manager/operator and system admin features implemented in src." "" 21 $false "4B5563"
$body += Heading "1. Scope Confirmed from Source" 1
$body += Paragraph "Included source areas: src/pages/Manager, src/pages/Admin, src/modules/vehicle-builder, src/pages/Login.tsx, src/pages/Register.tsx, and src/pages/Profile.tsx." "" 21 $false "1F2937"
$body += Paragraph "Excluded scope: features that are not implemented as visible manager/operator or system admin routes in the current src code." "" 21 $false "1F2937"

$body += Heading "2. Authentication and Profile" 1
$body += FeatureBlock "2.1" "Login" "/login" "src/pages/Login.tsx" "Authenticate admin and manager users and route them into the correct dashboard." "Enter credentials, validate role, navigate to admin or manager layout."
$body += FeatureBlock "2.2" "Register" "/register" "src/pages/Register.tsx" "Support account or operator registration entry from the public route." "Submit registration information and show validation feedback."
$body += FeatureBlock "2.3" "Profile" "/manager/profile, /admin/profile" "src/pages/Profile.tsx" "Show profile information for the signed-in manager or admin user." "View account details from the protected layout."
$body += FeatureBlock "2.4" "Logout" "Sidebar action" "src/components/Sidebar.tsx, src/auth.ts" "End the current session and return the user to the login screen." "Trigger logout, clear auth state, redirect to /login."

$body += Heading "3. Manager / Operator Features" 1
$managerFeatures = @(
  @("3.1", "Manager Dashboard", "/manager/dashboard", "src/pages/Manager/Dashboard.tsx", "Show an operational overview for the bus operator.", "Review key counts, status summaries, and recent activity."),
  @("3.2", "Trip Management", "/manager/trips", "src/pages/Manager/Trips/index.tsx", "Manage operator trip records.", "Create, view, update, filter, and monitor trips."),
  @("3.3", "Route ETA", "/manager/route-eta", "src/pages/Manager/RouteETA/index.tsx", "Monitor estimated arrival and route timing information.", "Review ETA status and delay-related route data."),
  @("3.4", "Routes Management", "/manager/routes", "src/pages/Manager/Routes/index.tsx", "Manage routes and route-related station information.", "View, create, update, and organize route records."),
  @("3.5", "Vehicle Management", "/manager/vehicles", "src/pages/Manager/Vehicles/index.tsx", "Manage operator vehicles and their operational status.", "Add vehicles, update vehicle data, and review status."),
  @("3.6", "Vehicle Builder", "/manager/vehicle-builder", "src/modules/vehicle-builder", "Design or configure vehicle layouts using the vehicle-builder module.", "Create vehicle layout, edit canvas elements, update properties, and save layout state."),
  @("3.7", "Staff Management", "/manager/staff", "src/pages/Manager/Staff/index.tsx", "Manage operator staff accounts visible to the manager role.", "View staff list, create or update staff records, and manage status."),
  @("3.8", "Booking Management", "/manager/bookings", "src/pages/Manager/Bookings/index.tsx", "Monitor bookings under the operator scope.", "Filter bookings, view booking information, and manage booking status."),
  @("3.9", "Parcel Management", "/manager/parcels", "src/pages/Manager/Parcels/index.tsx", "Monitor parcel requests and parcel operation records.", "View parcels, inspect status, and manage parcel-related cases."),
  @("3.10", "Voucher Management", "/manager/vouchers", "src/pages/Manager/Vouchers/index.tsx", "Manage operator-side voucher information.", "View campaigns, review voucher details, and manage operator voucher actions."),
  @("3.11", "Package Management", "/manager/packages", "src/pages/Manager/Packages/index.tsx", "Manage package or subscription package data available to operators.", "View package list and manage package-related records."),
  @("3.12", "Policy Management", "/manager/policies", "src/pages/Manager/Policies/index.tsx", "Manage operator policies shown in the manager console.", "Review and update policy records."),
  @("3.13", "GPS Tracking", "/manager/gps", "src/pages/Manager/GPS/index.tsx, src/pages/Manager/GPS/FleetMap.tsx", "Track fleet location and GPS information.", "Open map view, monitor vehicle markers, and review fleet movement."),
  @("3.14", "Reports", "/manager/reports", "src/pages/Manager/Reports/index.tsx", "View operator reports.", "Review report metrics and export or inspect report data where supported."),
  @("3.15", "Dispatch", "/manager/dispatch", "src/pages/Manager/Dispatch/index.tsx", "Manage dispatch-related operational tasks.", "Review dispatch items and coordinate fleet or route actions."),
  @("3.16", "Wallet", "/manager/wallet", "src/pages/Manager/Wallet/index.tsx", "View operator wallet and financial transaction information.", "Review balance, transaction list, and settlement-related records."),
  @("3.17", "Settings", "/manager/settings", "src/pages/Manager/Settings/index.tsx", "Manage manager-side settings for the operator console.", "View and update configurable settings available to the manager role.")
)
foreach ($f in $managerFeatures) {
  $body += FeatureBlock $f[0] $f[1] $f[2] $f[3] $f[4] $f[5]
}

$body += Heading "4. System Admin Features" 1
$adminFeatures = @(
  @("4.1", "Admin Dashboard", "/admin/dashboard", "src/pages/Admin/Dashboard.tsx", "Show platform-level overview for system admin.", "Review platform KPIs, counts, and status summaries."),
  @("4.2", "Operator Management", "/admin/operators", "src/pages/Admin/Operators.tsx", "Manage bus operator records from the system admin console.", "Create, review, update, approve, suspend, or inspect operator data according to UI support."),
  @("4.3", "User Management", "/admin/users", "src/pages/Admin/Users.tsx", "Manage platform user records.", "View users, filter records, and manage user status/actions exposed by the page."),
  @("4.4", "Voucher Management", "/admin/vouchers", "src/pages/Admin/Vouchers.tsx", "Manage platform voucher campaigns.", "Create, review, update, and monitor voucher records."),
  @("4.5", "Package Management", "/admin/packages", "src/pages/Admin/Packages.tsx", "Manage platform package data.", "View package records and manage package configuration shown in the admin page."),
  @("4.6", "Policy Management", "/admin/policies", "src/pages/Admin/Policies.tsx", "Manage platform policy records.", "Review and update policies available to system admin."),
  @("4.7", "Payouts", "/admin/payouts", "src/pages/Admin/Payouts.tsx", "Review and manage payout information.", "Inspect payout records, statuses, and related admin actions."),
  @("4.8", "Revenue", "/admin/revenue", "src/pages/Admin/Revenue.tsx", "View platform revenue information.", "Review revenue metrics, charts, and summarized financial data."),
  @("4.9", "Admin Reports", "/admin/reports", "src/pages/Admin/Reports.tsx", "View platform reports.", "Review aggregate reports and export or inspect report data where supported.")
)
foreach ($f in $adminFeatures) {
  $body += FeatureBlock $f[0] $f[1] $f[2] $f[3] $f[4] $f[5]
}

$newXml = $documentOpen + $body + $sectPr + "</w:body></w:document>"
Set-Content -LiteralPath $documentPath -Value $newXml -NoNewline -Encoding UTF8

if (Test-Path -LiteralPath $mediaPath) {
  Remove-Item -LiteralPath $mediaPath -Recurse -Force
}

$rels = Get-Content -LiteralPath $relsPath -Raw
$rels = [regex]::Replace($rels, '<Relationship[^>]+Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"[^>]*/>', '')
Set-Content -LiteralPath $relsPath -Value $rels -NoNewline -Encoding UTF8

$contentTypes = Get-Content -LiteralPath $contentTypesPath -Raw
$contentTypes = [regex]::Replace($contentTypes, '<Default Extension="png" ContentType="image/png"/>', '')
Set-Content -LiteralPath $contentTypesPath -Value $contentTypes -NoNewline -Encoding UTF8

if (Test-Path -LiteralPath $outputFullPath) {
  Remove-Item -LiteralPath $outputFullPath -Force
}
[System.IO.Compression.ZipFile]::CreateFromDirectory($extractPath, $outputFullPath)

Write-Output "Created $outputFullPath"
