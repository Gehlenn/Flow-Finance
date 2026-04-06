param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,

  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$WorkspaceId,

  [switch]$SkipWriteSync
)

$ErrorActionPreference = 'Stop'

function Normalize-BaseUrl {
  param([string]$Url)
  return $Url.TrimEnd('/')
}

function Convert-BodyToJson {
  param([object]$Body)
  if ($null -eq $Body) { return $null }
  return ($Body | ConvertTo-Json -Depth 10 -Compress)
}

function Invoke-Api {
  param(
    [Parameter(Mandatory = $true)][Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [Parameter(Mandatory = $true)][ValidateSet('GET','POST','PUT','PATCH','DELETE')] [string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [object]$Body,
    [string]$WorkspaceHeader
  )

  $headers = @{
    Accept = 'application/json'
  }

  if ($WorkspaceHeader) {
    $headers['x-workspace-id'] = $WorkspaceHeader
  }

  $params = @{
    Method      = $Method
    Uri         = $Url
    WebSession  = $Session
    Headers     = $headers
    ContentType = 'application/json'
    TimeoutSec  = 30
  }

  $jsonBody = Convert-BodyToJson -Body $Body
  if ($null -ne $jsonBody) {
    $params['Body'] = $jsonBody
  }

  try {
    $response = Invoke-WebRequest @params
    $parsed = $null
    if ($response.Content) {
      try { $parsed = $response.Content | ConvertFrom-Json } catch { $parsed = $response.Content }
    }

    return [pscustomobject]@{
      Ok      = $true
      Status  = [int]$response.StatusCode
      Body    = $parsed
      RawBody = $response.Content
    }
  }
  catch {
    $status = 0
    $content = $null

    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = 0 }
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Close()
      }
      catch {
        $content = $null
      }
    }

    $parsed = $null
    if ($content) {
      try { $parsed = $content | ConvertFrom-Json } catch { $parsed = $content }
    }

    return [pscustomobject]@{
      Ok      = $false
      Status  = $status
      Body    = $parsed
      RawBody = $content
    }
  }
}

$backend = Normalize-BaseUrl -Url $BackendUrl
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Step,
    [bool]$Pass,
    [string]$Details
  )

  $results.Add([pscustomobject]@{
    Step    = $Step
    Status  = $(if ($Pass) { 'PASS' } else { 'FAIL' })
    Details = $Details
  }) | Out-Null
}

Write-Host "Iniciando smoke test auth/sync em $backend" -ForegroundColor Cyan

# 1) Login
$login = Invoke-Api -Session $session -Method POST -Url "$backend/api/auth/login" -Body @{
  email = $Email
  password = $Password
}

if ($login.Ok -and $login.Status -ge 200 -and $login.Status -lt 300) {
  Add-Result -Step '1. Login' -Pass $true -Details "HTTP $($login.Status)"
}
else {
  Add-Result -Step '1. Login' -Pass $false -Details "HTTP $($login.Status)"
}

# 2) Sessao ativa em endpoint protegido
$workspace = Invoke-Api -Session $session -Method GET -Url "$backend/api/workspace" -WorkspaceHeader $WorkspaceId
if ($workspace.Ok -and $workspace.Status -ge 200 -and $workspace.Status -lt 300) {
  Add-Result -Step '2. Sessao autenticada' -Pass $true -Details "HTTP $($workspace.Status)"
}
else {
  Add-Result -Step '2. Sessao autenticada' -Pass $false -Details "HTTP $($workspace.Status)"
}

# 3) Refresh por cookie HttpOnly
$refresh = Invoke-Api -Session $session -Method POST -Url "$backend/api/auth/refresh" -Body @{}
if ($refresh.Ok -and $refresh.Status -ge 200 -and $refresh.Status -lt 300) {
  Add-Result -Step '3. Refresh por cookie' -Pass $true -Details "HTTP $($refresh.Status)"
}
else {
  Add-Result -Step '3. Refresh por cookie' -Pass $false -Details "HTTP $($refresh.Status)"
}

# 4) Sync pull
$pull = Invoke-Api -Session $session -Method GET -Url "$backend/api/sync/pull" -WorkspaceHeader $WorkspaceId
if ($pull.Ok -and $pull.Status -ge 200 -and $pull.Status -lt 300) {
  Add-Result -Step '4. Sync pull' -Pass $true -Details "HTTP $($pull.Status)"
}
else {
  Add-Result -Step '4. Sync pull' -Pass $false -Details "HTTP $($pull.Status)"
}

# 5) Sync push com cleanup (opcional)
if ($SkipWriteSync) {
  Add-Result -Step '5. Sync push' -Pass $true -Details 'Pulado por -SkipWriteSync'
}
else {
  $goalId = "smoke-goal-$(Get-Date -Format yyyyMMddHHmmss)"
  $nowIso = (Get-Date).ToUniversalTime().ToString('o')

  $pushCreate = Invoke-Api -Session $session -Method POST -Url "$backend/api/sync/push" -WorkspaceHeader $WorkspaceId -Body @{
    entity = 'goals'
    items = @(
      @{
        id = $goalId
        updatedAt = $nowIso
        payload = @{
          id = $goalId
          user_id = 'smoke-user'
          name = 'Smoke Goal'
          target_amount = 1000
          current_amount = 0
          created_at = $nowIso
        }
      }
    )
  }

  $pushDelete = Invoke-Api -Session $session -Method POST -Url "$backend/api/sync/push" -WorkspaceHeader $WorkspaceId -Body @{
    entity = 'goals'
    items = @(
      @{
        id = $goalId
        updatedAt = (Get-Date).ToUniversalTime().ToString('o')
        deleted = $true
      }
    )
  }

  $pushOk = ($pushCreate.Ok -and $pushCreate.Status -ge 200 -and $pushCreate.Status -lt 300) -and ($pushDelete.Ok -and $pushDelete.Status -ge 200 -and $pushDelete.Status -lt 300)
  if ($pushOk) {
    Add-Result -Step '5. Sync push + cleanup' -Pass $true -Details "create HTTP $($pushCreate.Status), delete HTTP $($pushDelete.Status)"
  }
  else {
    Add-Result -Step '5. Sync push + cleanup' -Pass $false -Details "create HTTP $($pushCreate.Status), delete HTTP $($pushDelete.Status)"
  }
}

# 6) Logout e bloqueio
$logout = Invoke-Api -Session $session -Method POST -Url "$backend/api/auth/logout" -Body @{}
$postLogoutWorkspace = Invoke-Api -Session $session -Method GET -Url "$backend/api/workspace" -WorkspaceHeader $WorkspaceId

$logoutOk = ($logout.Ok -and $logout.Status -ge 200 -and $logout.Status -lt 300)
$blockedAfterLogout = ($postLogoutWorkspace.Status -eq 401 -or $postLogoutWorkspace.Status -eq 403)

if ($logoutOk -and $blockedAfterLogout) {
  Add-Result -Step '6. Logout e sessao invalidada' -Pass $true -Details "logout HTTP $($logout.Status), workspace HTTP $($postLogoutWorkspace.Status)"
}
else {
  Add-Result -Step '6. Logout e sessao invalidada' -Pass $false -Details "logout HTTP $($logout.Status), workspace HTTP $($postLogoutWorkspace.Status)"
}

Write-Host ''
Write-Host 'Resultado do smoke test:' -ForegroundColor Cyan
$results | ForEach-Object {
  $color = if ($_.Status -eq 'PASS') { 'Green' } else { 'Red' }
  Write-Host ("{0} {1} - {2}" -f $_.Status, $_.Step, $_.Details) -ForegroundColor $color
}

$failed = @($results | Where-Object { $_.Status -eq 'FAIL' }).Count
if ($failed -gt 0) {
  Write-Error "Smoke test finalizado com $failed falha(s)."
  exit 1
}

Write-Host ''
Write-Host 'Smoke test finalizado com sucesso.' -ForegroundColor Green
exit 0
