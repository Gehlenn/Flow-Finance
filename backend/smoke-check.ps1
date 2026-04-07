$ProgressPreference='SilentlyContinue'
$out = @()
$checks = @(
  @{Name='health';Method='GET';Uri='https://flow-finance-backend.vercel.app/api/health';Body=$null},
  @{Name='clinic-health-no-auth';Method='GET';Uri='https://flow-finance-backend.vercel.app/api/integrations/clinic/health';Body=$null},
  @{Name='financial-events-no-auth';Method='POST';Uri='https://flow-finance-backend.vercel.app/api/integrations/clinic/financial-events';Body='{}'}
)
foreach($t in $checks){
  try {
    if($t.Method -eq 'POST') { $r = Invoke-WebRequest -Method Post -Uri $t.Uri -ContentType 'application/json' -Body $t.Body -ErrorAction Stop }
    else { $r = Invoke-WebRequest -Method Get -Uri $t.Uri -ErrorAction Stop }
    $txt = [string]$r.Content
    $sn = ($txt.Substring(0,[Math]::Min(160,$txt.Length)) -replace '\s+',' ')
    $out += [pscustomobject]@{ Name=$t.Name; Method=$t.Method; Status=[int]$r.StatusCode; Snippet=$sn }
  } catch {
    $resp = $_.Exception.Response
    if($resp){
      $sr = New-Object IO.StreamReader($resp.GetResponseStream())
      $b = $sr.ReadToEnd()
      $sn = ($b.Substring(0,[Math]::Min(160,$b.Length)) -replace '\s+',' ')
      $out += [pscustomobject]@{ Name=$t.Name; Method=$t.Method; Status=[int]$resp.StatusCode; Snippet=$sn }
    } else {
      $out += [pscustomobject]@{ Name=$t.Name; Method=$t.Method; Status=-1; Snippet=$_.Exception.Message }
    }
  }
}
$out | ConvertTo-Json -Compress
