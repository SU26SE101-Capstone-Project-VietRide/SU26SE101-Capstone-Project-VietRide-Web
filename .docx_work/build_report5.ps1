$ErrorActionPreference = 'Stop'
$out = Join-Path (Get-Location) 'Report5_VietRide_Test_Documentation.docx'
$pdf = Join-Path (Get-Location) '.docx_work\Report5_VietRide_Test_Documentation.pdf'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Add()
try {
  $sec = $doc.Sections.Item(1)
  $sec.PageSetup.TopMargin = $word.CentimetersToPoints(2.2)
  $sec.PageSetup.BottomMargin = $word.CentimetersToPoints(2.0)
  $sec.PageSetup.LeftMargin = $word.CentimetersToPoints(2.3)
  $sec.PageSetup.RightMargin = $word.CentimetersToPoints(2.0)
  $doc.Styles.Item('Normal').Font.Name = 'Times New Roman'
  $doc.Styles.Item('Normal').Font.Size = 11
  foreach ($name in @('Heading 1','Heading 2','Heading 3')) { $doc.Styles.Item($name).Font.Name = 'Times New Roman'; $doc.Styles.Item($name).Font.Color = 0x7A3A12 }
  $doc.Styles.Item('Heading 1').Font.Size = 16; $doc.Styles.Item('Heading 1').Font.Bold = 1
  $doc.Styles.Item('Heading 2').Font.Size = 14; $doc.Styles.Item('Heading 2').Font.Bold = 1
  $doc.Styles.Item('Heading 3').Font.Size = 12; $doc.Styles.Item('Heading 3').Font.Bold = 1

  function Add-P([string]$text='', [string]$style='Normal', [int]$align=0, [int]$bold=0, [double]$size=0, [int]$after=6) {
    $p=$doc.Paragraphs.Add(); $p.Style=$style; $p.Alignment=$align; $p.Range.Text=$text; $p.Range.Font.Name='Times New Roman'; if($bold){$p.Range.Font.Bold=1}; if($size){$p.Range.Font.Size=$size}; $p.Format.SpaceAfter=$after; $p.Range.InsertParagraphAfter() | Out-Null; return $p
  }
  function Add-PageBreak { $r=$doc.Range($doc.Content.End-1,$doc.Content.End-1); $r.InsertBreak(7) }
  function Shade-Cell($cell,[int]$color) { $cell.Shading.BackgroundPatternColor=$color }
  function Add-Table([object[]]$headers,[object[]]$rows,[double[]]$widths) {
    $range=$doc.Range($doc.Content.End-1,$doc.Content.End-1)
    $table=$doc.Tables.Add($range,$rows.Count+1,$headers.Count)
    $table.Borders.Enable=1; $table.AllowAutoFit=$false; $table.Rows.Item(1).HeadingFormat=-1
    for($c=1;$c -le $headers.Count;$c++){ $cell=$table.Cell(1,$c); $cell.Range.Text=[string]$headers[$c-1]; $cell.Range.Bold=1; $cell.Range.Font.Color=0xFFFFFF; $cell.Range.ParagraphFormat.Alignment=1; Shade-Cell $cell 0x7A3A12; if($widths){$cell.Width=$word.CentimetersToPoints($widths[$c-1])} }
    for($r=0;$r -lt $rows.Count;$r++){
      for($c=0;$c -lt $headers.Count;$c++){ $cell=$table.Cell($r+2,$c+1); $cell.Range.Text=[string]$rows[$r][$c]; $cell.Range.Font.Name='Times New Roman'; $cell.Range.Font.Size=9.5; $cell.VerticalAlignment=1; if($r%2 -eq 1){Shade-Cell $cell 0xF4F8FA}; if($widths){$cell.Width=$word.CentimetersToPoints($widths[$c])} }
    }
    $table.Range.ParagraphFormat.SpaceAfter=2; $doc.Range($doc.Content.End-1,$doc.Content.End-1).InsertParagraphAfter() | Out-Null
    return $table
  }
  function Add-Bullets([string[]]$items) { foreach($item in $items){ $p=Add-P $item; $p.Range.ListFormat.ApplyBulletDefault(); $p.Format.LeftIndent=$word.CentimetersToPoints(0.65); $p.Format.FirstLineIndent=$word.CentimetersToPoints(-0.3) } }

  # Cover
  Add-P 'FPT UNIVERSITY' 'Normal' 1 1 15 3 | Out-Null
  Add-P 'CAPSTONE PROJECT' 'Normal' 1 1 18 20 | Out-Null
  Add-P 'VIETRIDE' 'Normal' 1 1 28 4 | Out-Null
  Add-P 'Multi-role Coach Operations and Transportation Platform' 'Normal' 1 0 14 55 | Out-Null
  Add-P 'REPORT 5' 'Normal' 1 1 24 4 | Out-Null
  Add-P 'SOFTWARE TEST DOCUMENTATION' 'Normal' 1 1 20 50 | Out-Null
  Add-P 'Prepared by: VietRide Development Team' 'Normal' 1 0 12 4 | Out-Null
  Add-P 'Test execution date: 28 July 2026' 'Normal' 1 0 12 4 | Out-Null
  Add-P 'Version: 1.0' 'Normal' 1 0 12 45 | Out-Null
  Add-P '- Hanoi, July 2026 -' 'Normal' 1 0 12 0 | Out-Null
  Add-PageBreak

  Add-P 'Table of Contents' 'Heading 1' 0 0 0 10 | Out-Null
  $tocRange=$doc.Range($doc.Content.End-1,$doc.Content.End-1); $doc.TablesOfContents.Add($tocRange,$true,1,3) | Out-Null
  Add-PageBreak

  Add-P 'I. Record of Changes' 'Heading 1' | Out-Null
  Add-Table @('Date','A/M/D','In charge','Change Description') @(
    @('28-Jul-2026','A','VietRide FE Team','Initial test documentation based on the project Report 5 template.'),
    @('28-Jul-2026','A','VietRide FE Team','Executed automated frontend tests and recorded actual results: 95/95 passed.'),
    @('28-Jul-2026','A','VietRide FE Team','Added role-based coverage for System Admin, Operator Admin, and Operator Staff.')
  ) @(2.6,2.0,4.0,9.0) | Out-Null
  Add-P '*A - Added; M - Modified; D - Deleted.' 'Normal' 0 0 9 4 | Out-Null
  Add-PageBreak

  Add-P 'II. Testing Documentation' 'Heading 1' | Out-Null
  Add-P '1. Scope of Testing' 'Heading 2' | Out-Null
  Add-P 'The testing scope covers the VietRide React frontend and its integration contracts with the VietRide backend APIs. The primary objective is to verify reliable authentication, role-aware operations, data transformation, idempotent mutations, payment return handling, image upload, route processing, and core management workflows.' | Out-Null
  Add-P 'In scope' 'Heading 3' | Out-Null
  Add-Bullets @(
    'Authentication: login, token persistence, refresh-token flow, logout, operator registration, OTP verification, and password recovery.',
    'System Admin: operator/user administration, locations, vouchers/campaigns, subscription plans, reports, RAG operations, invoices, settlements, and notifications.',
    'Operator Admin: vehicles and seat layouts, staff, routes, driver schedules, trips, bookings, parcels, vouchers, subscription purchase, VNPay return, wallet, invoices, and tracking.',
    'Operator Staff: read-oriented operational views and permitted trip, booking, parcel, dispatch, tracking, notification, and incident workflows.',
    'Cross-cutting behavior: API envelope parsing, backend error propagation, idempotency keys, server filters/pagination, Firebase image upload, accessibility behavior in shared modal/image components, and Google encoded polylines.'
  )
  Add-P 'Out of scope and constraints' 'Heading 3' | Out-Null
  Add-Bullets @(
    'Backend unit tests, database migration tests, VNPay production settlement, email delivery infrastructure, and Firebase infrastructure rules are owned by backend/DevOps and are not directly validated by this frontend suite.',
    'Automated tests use mocked HTTP responses; end-to-end validation against production-like services remains a release-gate activity.',
    'Browser compatibility and mobile visual regression require manual execution on the target environments listed in Section 3.2.'
  )

  Add-P '2. Test Strategy' 'Heading 2' | Out-Null
  Add-P 'The strategy combines automated unit/component/integration-contract tests with manual system and acceptance testing. Risk-based priority is assigned to authentication, money movement, subscription state transitions, booking/parcel operations, and mutations that require idempotency.' | Out-Null
  Add-P '2.1 Testing Types' 'Heading 3' | Out-Null
  Add-Table @('Test Type','Objective','Technique','Completion Criteria') @(
    @('Functional','Verify expected business behavior for each supported role.','Positive, negative, boundary, and state-transition scenarios.','All critical scenarios pass; no open blocker/critical defects.'),
    @('API Contract','Verify endpoint, method, query, payload, auth, and response mapping.','Mocked fetch assertions and response envelope mapping.','All documented frontend API calls match the current BE contract.'),
    @('Component/UI','Verify rendering, interaction, loading, empty, error, and accessibility behavior.','React Testing Library with user-event and jest-dom.','Components render expected states and expose accessible controls.'),
    @('Security/Session','Verify token handling, role normalization, refresh concurrency, and protected errors.','Session-storage tests and mocked 401 retry flows.','No access-token misuse; one refresh request is shared and retry is bounded.'),
    @('Reliability','Prevent duplicate mutations and inconsistent payment outcomes.','Idempotency-key and payment polling/return tests.','Mutation keys are stable; payment success is shown only after backend confirmation.'),
    @('Regression','Detect unintended changes after API/UI updates.','Full Vitest, typecheck, lint, and production build.','All automated tests and static checks pass.')
  ) @(2.7,4.7,5.2,5.0) | Out-Null

  Add-P '2.2 Test Levels' 'Heading 3' | Out-Null
  Add-Table @('Type of Tests','Unit','Integration','System','Acceptance') @(
    @('Functional','X','X','X','X'), @('API Contract','X','X','X',''), @('Component/UI','X','X','X','X'),
    @('Security/Session','X','X','X',''), @('Reliability','X','X','X',''), @('Regression','X','X','X','X')
  ) @(5.8,2.7,2.7,2.7,2.7) | Out-Null

  Add-P '2.3 Supporting Tools' 'Heading 3' | Out-Null
  Add-Table @('Purpose','Tool','Vendor/In-house','Version') @(
    @('Unit/component/API tests','Vitest','Open source','4.1.9'),
    @('React interaction tests','Testing Library + user-event','Open source','16.3.2 / 14.6.1'),
    @('DOM assertions','jest-dom','Open source','6.9.1'),
    @('Static type validation','TypeScript','Microsoft','6.0.2'),
    @('Code quality','ESLint','Open source','10.3.0'),
    @('Production bundling','Vite','Open source','8.0.12'),
    @('Manual API verification','Swagger UI / Browser DevTools','Open source / Browser vendor','Current'),
    @('Source control and review','Git','Open source','Current')
  ) @(5.3,5.0,4.3,3.2) | Out-Null

  Add-P '3. Test Plan' 'Heading 2' | Out-Null
  Add-P '3.1 Human Resources' 'Heading 3' | Out-Null
  Add-Table @('Worker/Doer','Role','Specific Responsibilities/Comments') @(
    @('VietRide FE Team','Developer / Unit Tester','Implement and maintain unit, component, and API contract tests; fix regressions.'),
    @('VietRide QA Member','Test Designer / Executor','Design system scenarios, execute manual role-based workflows, and record evidence.'),
    @('VietRide BE Team','Integration Support','Provide API contracts, test data, logs, and resolve service-side defects.'),
    @('Product Owner / Supervisor','Acceptance Reviewer','Validate business rules and approve release acceptance criteria.')
  ) @(4.5,4.5,9.0) | Out-Null

  Add-P '3.2 Test Environment' 'Heading 3' | Out-Null
  Add-Table @('Purpose','Tool/Environment','Provider','Version/Configuration') @(
    @('Frontend runtime','Node.js + npm','OpenJS','Project-compatible current LTS'),
    @('Automated tests','jsdom','Open source','29.1.1'),
    @('Desktop browser','Google Chrome','Google','Current stable; 1920x1080'),
    @('Responsive testing','Chrome DevTools','Google','360x800, 768x1024, 1920x1080'),
    @('Application','VietRide Vite frontend','In-house','Localhost and deployed environment'),
    @('Backend APIs','api.vietride.online','In-house','HTTPS test/deployed services'),
    @('External services','Firebase Storage, Google Maps, VNPay sandbox','External','Test credentials and restricted keys')
  ) @(4.0,5.4,3.7,4.9) | Out-Null

  Add-P '3.3 Test Milestones' 'Heading 3' | Out-Null
  Add-Table @('Milestone Task','Start Date','End Date','Exit Evidence') @(
    @('Test planning and scope review','21-Jul-2026','22-Jul-2026','Approved scope and risk list'),
    @('Unit/API contract test update','22-Jul-2026','27-Jul-2026','Test sources committed'),
    @('Automated regression execution','28-Jul-2026','28-Jul-2026','95/95 tests passed'),
    @('Manual role-based system test','28-Jul-2026','TBD','Signed test execution sheet'),
    @('Acceptance and release decision','TBD','TBD','No blocker/critical defect; stakeholder approval')
  ) @(7.5,3.0,3.0,4.5) | Out-Null

  Add-P '4. Test Cases' 'Heading 2' | Out-Null
  Add-P 'The table below summarizes representative automated and system-level cases. Detailed automated evidence is available in the corresponding *.test.ts and *.test.tsx files.' | Out-Null
  $cases=@(
    @('TC-AUTH-01','All roles','Login with valid credentials','Session stores access/refresh tokens and normalized role.','Automated','PASS'),
    @('TC-AUTH-02','All roles','Expired access token during API call','Use refreshToken, retry once, and share one refresh across concurrent calls.','Automated','PASS'),
    @('TC-AUTH-03','Operator Admin','Complete operator registration wizard','Step 2 only advances; complete payload is submitted at final step.','Automated','PASS'),
    @('TC-AUTH-04','Operator Admin','Forgot password with OTP','Validate email/OTP and submit new password.','Automated','PASS'),
    @('TC-API-01','All roles','Mutation request','Attach one UUID v4 idempotency key and preserve it across retry.','Automated','PASS'),
    @('TC-ADM-01','System Admin','Manage users/operators/locations','Correct admin endpoints, filters, IDs, and mutations are called.','Automated','PASS'),
    @('TC-ADM-02','System Admin','RAG/report/DLQ operations','Call authorized admin facade endpoints with expected query.','Automated','PASS'),
    @('TC-VEH-01','Operator Admin','Upload vehicle image','Use BE Firebase purpose/path; reject invalid or >=5 MiB files.','Automated','PASS'),
    @('TC-VEH-02','Operator Admin','Create/load seat layout','Generate default layout and restore saved seat positions.','Automated','PASS'),
    @('TC-TRIP-01','Operator Admin/Staff','Load trip cargo capacity','Render cargo capacity returned for selected trip.','Automated','PASS'),
    @('TC-TRIP-02','Operator Admin/Staff','Substitute disrupted vehicle','Submit vehicle, crew, and reason through documented endpoint.','Automated','PASS'),
    @('TC-BOOK-01','Operator Admin/Staff','Load operator bookings','Apply server filters and retrieve booking detail.','Automated','PASS'),
    @('TC-PAR-01','Operator Admin/Staff','Load parcel queue and review parcel','Build queue query and call permitted parcel review/report operations.','Automated','PASS'),
    @('TC-VOU-01','System/Operator Admin','Manage vouchers/campaigns','Use correct service scope and consent/campaign APIs.','Automated','PASS'),
    @('TC-SUB-01','Operator Admin','Buy a paid plan using VNPay','Send planId, billingPeriod, paymentMethod, and returnUrl.','Automated','PASS'),
    @('TC-SUB-02','Operator Admin','Return from successful VNPay payment','Show success only when BE reports target plan ACTIVE.','Automated','PASS'),
    @('TC-SUB-03','Operator Admin','Cancelled/expired subscription','Allow repurchase; do not list one-time free trial as purchasable.','Automated','PASS'),
    @('TC-MAP-01','Operator Admin/Staff','Encode/decode saved route polyline','Precision-5 round trip succeeds; incomplete polyline is rejected.','Automated','PASS'),
    @('TC-MAP-02','Operator Admin/Staff','Estimate coach duration','Use coach speed and retain slower router duration.','Automated','PASS'),
    @('TC-NOT-01','All roles','Load and mark notification as read','Call user notification list/read APIs.','Automated','PASS')
  )
  Add-Table @('ID','Role','Scenario','Expected Result','Method','Result') $cases @(2.2,2.8,4.0,6.2,2.0,1.7) | Out-Null

  Add-P '5. Test Reports' 'Heading 2' | Out-Null
  Add-P '5.1 Automated Test Execution Summary' 'Heading 3' | Out-Null
  Add-Table @('Metric','Result') @(
    @('Command','npm run test -- --reporter=verbose'),
    @('Execution date','28-Jul-2026'),
    @('Test files','18 passed / 18 total'),
    @('Test cases','95 passed / 95 total'),
    @('Failed tests','0'),
    @('Pass rate','100%'),
    @('Test framework','Vitest 4.1.9 with jsdom and React Testing Library'),
    @('Overall automated status','PASS')
  ) @(7.0,11.0) | Out-Null

  Add-P '5.2 Coverage Distribution' 'Heading 3' | Out-Null
  Add-Table @('Area','Evidence / Test Files','Status') @(
    @('API and integrations','client, SSE, idempotency, vietride API','PASS'),
    @('Authentication and registration','auth, Register, RegisterSuccess, ForgotPassword','PASS'),
    @('Subscription and VNPay','Manager Packages, PaymentReturn','PASS'),
    @('Vehicle and Firebase images','VehicleImage, vehicleImageUpload, firebaseImageUpload','PASS'),
    @('Trips and routes','TripOperationsPanel, polyline','PASS'),
    @('Shared UI and mapping','Modal, Google Places','PASS'),
    @('Vehicle layout state','vehicleStore','PASS')
  ) @(5.0,10.5,2.5) | Out-Null

  Add-P '5.3 Static Validation' 'Heading 3' | Out-Null
  Add-Table @('Check','Command','Result') @(
    @('Type safety','npm run typecheck','PASS'),
    @('Lint','npm run lint','PASS'),
    @('Production build','npm run build','PASS'),
    @('Automated test suite','npm run test','PASS')
  ) @(5.0,7.0,6.0) | Out-Null

  Add-P '5.4 Defect and Risk Analysis' 'Heading 3' | Out-Null
  Add-Bullets @(
    'No automated regression failures were observed in the recorded execution.',
    'The automated suite validates frontend behavior and HTTP contracts using mocks; it does not prove backend email delivery, VNPay IPN processing, Firebase security rules, or production data consistency.',
    'Highest residual risk remains in external-service callbacks and cross-service state synchronization. These flows require staging end-to-end evidence before release.',
    'Manual responsive, accessibility, and browser compatibility checks should be executed for critical System Admin, Operator Admin, and Operator Staff journeys.'
  )
  Add-P 'Conclusion: The frontend automated regression gate is PASSED. Release acceptance remains conditional on completion of staging end-to-end and stakeholder acceptance testing.' 'Normal' 0 1 11 8 | Out-Null

  # Footer and page numbers
  foreach($section in $doc.Sections){
    $footer=$section.Footers.Item(1); $footer.Range.Text='VietRide - Report 5 Software Test Documentation    ' ; $footer.Range.Font.Name='Times New Roman'; $footer.Range.Font.Size=9; $footer.Range.ParagraphFormat.Alignment=2
    $footer.PageNumbers.Add() | Out-Null
  }
  $doc.TablesOfContents.Item(1).Update() | Out-Null
  $doc.Fields.Update() | Out-Null
  $doc.SaveAs2($out,16)
  $doc.ExportAsFixedFormat($pdf,17)
  $pages=$doc.ComputeStatistics(2)
  "OUTPUT=$out"; "PDF=$pdf"; "PAGES=$pages"; "WORDS=$($doc.Words.Count)"; "TABLES=$($doc.Tables.Count)"
} finally {
  $doc.Close($false)
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
