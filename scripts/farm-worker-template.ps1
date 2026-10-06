<#
farm-worker.ps1 - ainumbers-farm-aspire worker (Aspire)

Runs ONE tasking from inbox\ with a free-model harness (hermes | opencode | cline | workbuddy) and
lands the report in outbox\.
Runs every 15 min via Task Scheduler; also runnable manually:
  powershell -NoProfile -ExecutionPolicy Bypass -File C:\dev\ainumbers-farm-aspire\farm-worker.ps1 [-TaskId <id>] [-DryRun]

Carries every fix from the ainumbers-farm incident log (HP memorial 2026-09-06):
  - ONE pre-quoted command-line string for the harness process (incident 1)
  - harness exe resolved to a real Application, never the .ps1 shim (incident 3)
  - per-task defer on a fresh outbox\<ID>.RUNNING marker (incident 4)
  - git wrapped in ErrorActionPreference=Continue + repo autocrlf=false (incident 5)
  - self-heal commits staged AND unstaged outbox changes before pull (incident 6)
  - inbox\NOTE-* files are never picked as taskings (incident 7)
  - a lane whose exe is missing defers its taskings instead of failing them
  - untracked root dirt is logged, never silently committed

PowerShell-native only: never bash, sh, or wsl on this host.
#>
param(
  [string]$TaskId = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$Farm    = $PSScriptRoot
$Inbox   = Join-Path $Farm 'inbox'
$Outbox  = Join-Path $Farm 'outbox'
$LogsDir = Join-Path $Farm 'logs'
$LockFile          = Join-Path $LogsDir 'worker.lock'
$LockStaleHrs      = 3
$RunningStaleHrs   = 3
$DefaultTimeoutMin = 90
$Machine = '@@MACHINE@@'

$script:Lanes = [ordered]@{
  # Lanes are named for their HARNESS since 2026-09-20 (Tim: "rename step->hermes, muse->opencode").
  'hermes' = @{
    ExeNames    = @('hermes')
    EnvAllow    = @()   # per-lane additions to the scrubbed child environment; add ONLY when a smoke fails without one
    FallbackExe = @("$env:LOCALAPPDATA\hermes\bin\hermes.exe")
    # RotateModelsLiteral (2026-10-06 auto-rotation, FARM-WATCH-PROMPT Part 5; folds the hand
    # edit PS-HERMES-ROTATE-2 found live on ps): stealth/space-bunny-alpha DROPPED — probed
    # HTTP 404 "not found in our configuration or OpenRouter catalog" on ps, nitro AND aspire
    # the same hour (T5-WMC-B7E0D883 on ps), i.e. promoted off the free catalog fleet-wide, not
    # a transient. Replacement upstage/solar-mini4:free (first added on ps by PS-HERMES-ROTATE-2,
    # Nous's Solar line — Tim: "Nous has Solar") probed READY ("Reply with exactly: OK",
    # --provider nous, rc=0) on ps (PS-HERMES-ROTATE-2), then re-probed by this rotation on
    # nitro, aspire and msi. omen NOT probed, by design (Tim 2026-10-06: omen IS the watcher
    # host, and hermes is deliberately not kept running/logged-in there — CPU/ram hog — so
    # its hermes lane is dormant; if it is ever reactivated, re-probe the whole list first).
    # The five 2026-10-02 ids all re-probed rc=0 "OK" on ps in the same pass.
    # longcat-2.5 leads as successor of the production-proven longcat line (SHADOW-WATCH-BRIEF-1);
    # solar-mini4 trails as newest. A promotion-ended id costs one fast failed run and is
    # stepped past; models.dev no longer carries a nous provider entry — the portal's own
    # enumeration stays the candidate source.
    RotateModelsLiteral = @('meituan/longcat-2.5-preview:free', 'inclusionai/ling-3.0-flash-sante:free', 'poolside/laguna-s-2.1:free', 'stepfun/step-3.7-flash:free', 'poolside/laguna-xs-2.1:free', 'upstage/solar-mini4:free')
    DefaultModel = 'meituan/longcat-2.5-preview:free'
    ArgFormat   = '-z "{0}" --provider nous -m {4}'
  }
  # opencode lane. One model hung on every box for days (2026-09-06..18: 1 report / 13 timeouts,
  # empty log) while the same Muse model ran fine through cline, so the lane now ROTATES across
  # RotateModels, one step per run (Tim 2026-09-18). {4} is the chosen model id. A candidate this
  # machine's own `opencode models` does not list is skipped, so an id that is renamed or not yet
  # in a box's catalog costs nothing. The first entry is the fallback when none can be validated.
  'opencode' = @{
    ExeNames     = @('opencode')
    EnvAllow     = @()
    FallbackExe  = @("@@NPMROOT@@\opencode.cmd")
    # Patterns, not ids: each is resolved against THIS machine's `opencode models` listing, so a
    # renamed id or a model a box's catalog does not carry yet (union-alpha, 2026-09-18) is skipped.
    # Refreshed 2026-10-05 (fleet sweep, Tim-directed, extends the nitro rotation of the same
    # day): the catalog had moved on — only muse-spark-1.3 and ling-3.0-flash-fin still resolved
    # of the 09-20 pool, so a ling endpoint outage (T5-WMC-3FFC0AD5, "Upstream request failed:
    # Endpoint is unavailable") halved the lane to one healthy id. muse-spark-1.2,
    # deepseek-v4-flash, mimo-v2.5, jev-1.13 and union-alpha dropped (absent from every catalog
    # since ~09-20, zero resolves). Five replacements probed READY on EVERY machine the same hour
    # ("Reply with exactly: OK", rc=0 — nitro/hp/ps/aspire/omen all 3-17 s, msi 5-65 s), ordered
    # by probe time after the production-proven muse-spark. ling-3.0-flash-fin is OUT, not kept:
    # probed rc=1 after ~73 s on hp/ps/aspire/nitro and a >75 s HANG on msi — on msi each hit
    # would burn the full lane timeout before the retry advances, so a recovery re-add is a
    # future sweep's call, not a standing cost. Nemotron ultra/lightning stay OUT (2026-09-20,
    # Tim: not recommended on this estate). msi's catalog is older (no fledge/ling-3.1/
    # longcat-2.5-preview): those patterns skip at resolve time there, pool = 4 ids on msi,
    # 6 everywhere else. 2026-10-06 (second rotation same day, Part 5 auto): the mimo-v2.6
    # pattern DROPPED — T5-WMC-D9F4F8E0 harness-timeout on ps 09:46Z, then probed DEAD on ps
    # (rc=1 UnknownError "Unexpected server error" x3, zero "OK", 14:2xZ); ps catalog holds no
    # new free candidates (ling-3.0-flash-fin stays OUT per 10-05, nemotron ids stay OUT per
    # Tim 09-20), pool 6 -> 5 (muse-spark / fledge-alpha / space-bunny / ling-3.1 / longcat-2.5).
    RotateModels = @('^opencode/muse-spark-1\.3.*free$', '^opencode/fledge-alpha.*free$', '^opencode/space-bunny.*free$', '^opencode/ling-3\.1-flash.*free$', '^opencode/longcat-2\.5-preview.*free$')
    DefaultModel = 'opencode/muse-spark-1.3-contributor-free'
    ArgFormat    = 'run -m {4} "{0}"'
    # `opencode run` reads stdin when stdin is not a terminal and waits for EOF. Under Task
    # Scheduler that EOF never arrives: the run sits silent until the worker's timeout, with an
    # empty log. Measured 2026-09-18 on the Omen: both Muse ids answer in 4-6 s with stdin closed.
    CloseStdin   = $true
  }
  # Headless Cline, the runbook's pinned invocation (research/CLINE-DISPATCH-SETUP-1.md,
  # "Standing recipe"), mirroring the HP worker's argv exactly. Free tier only: no -k/--key,
  # no paid provider. {0} prompt, {1} per-run data dir, {2} cwd, {3} cline's own timeout in
  # seconds - so ArgFormat is now filled with four values, not one (see the -f call below).
  # The per-run data dir is a copy of the operator-created template-data, so the curated
  # auto-approval gate travels with the run and the desktop extension's state is never touched.
  'cline' = @{
    ExeNames    = @('cline')
    EnvAllow    = @()
    FallbackExe = @("@@NPMROOT@@\cline.cmd")
    # RotateModelsLiteral (2026-10-01, Tim: kimi-k3 removed from the cline free tier - probe
    # returns "model not found"; MiMo v2.6 Flash is its replacement, probed READY the same hour
    # on msi): cline's CLI has no model-catalog command, so the lane rotates a LITERAL id list,
    # one step per run - the same counter machinery as muse. Each free model carries its own
    # daily cap, so the rotation also spreads the lane across three quotas instead of dying on
    # one 429 (ps/cline, 09-18/19). A promotion-ended id costs one fast "model not found" run
    # and is stepped past.
    RotateModelsLiteral = @('cline-free/muse-spark-1.3-contributor', 'cline-free/deepseek-v4.1-flash', 'cline-free/mimo-v2.6-flash')
    DefaultModel = 'cline-free/muse-spark-1.3-contributor'
    ArgFormat   = '--data-dir "{1}" -c "{2}" -m {4} --json -t {3} --retries 4 "{0}"'
  }
  # Headless WorkBuddy desktop CLI, the invocation measured on the Omen 2026-09-10
  # (HARNESS-PROBES-1-REPORT, Probe A): -p is non-interactive, exit 0, total_cost_usd = 0, and the
  # model flag value is lowercase. Free window only: no key, no paid model. The exe is plain node
  # and the CLI script is argv[0], so no PreArgs field is needed - ArgFormat carries the script
  # path itself. RequireFile is the lane's install test: with WorkBuddy desktop absent the lane
  # defers its taskings, exactly as a missing lane exe does, instead of failing them.
  # 2026-09-24 (desktop CLI 2.147.0): the old cli\dist\codebuddy.js entry is gone; CLI 2.147.0 ships bin\codebuddy, a #!/usr/bin/env node
  # script - still plain node with the script as argv[0]; --version -> 2.147.0; --help keeps -p/--print, --output-format text, --model, --settings, --add-dir.
  'workbuddy' = @{
    ExeNames    = @('node')
    EnvAllow    = @()
    FallbackExe = @("$env:ProgramFiles\nodejs\node.exe")
    RequireFile = "$env:LOCALAPPDATA\Programs\WorkBuddyAI\resources\app.asar.unpacked\cli\bin\codebuddy"
    # 2026-10-04 Tim: WorkBuddy runs DeepSeek v4.1 Flash only; Hy4/Hy3 need a /login session we do not keep; on DeepSeek exhaustion the task defers, it never falls to another model.
    RotateModelsLiteral = @('deepseek-v4.1-flash')
    DefaultModel = 'deepseek-v4.1-flash'
    ArgFormat   = "`"$env:LOCALAPPDATA\Programs\WorkBuddyAI\resources\app.asar.unpacked\cli\bin\codebuddy`" `"{0}`" -p --output-format text --model {4} --settings `"$Farm\workbuddy-settings.json`" --add-dir `"$Outbox`""
  }
}

foreach ($d in @($Inbox, $Outbox, $LogsDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d | Out-Null }
}
Set-Location -LiteralPath $Farm

function Write-Log {
  param([string]$Message)
  $line = '{0} {1}' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'), $Message
  Add-Content -Path (Join-Path $LogsDir 'worker.log') -Value $line
}

function Invoke-Git {
  # git stderr noise must never kill a landing (memorial incident 5)
  param([string[]]$GitArgs)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & git @GitArgs 2>&1
    # 2026-10-03 hp fix, folded into this template by FARM-WORKER-HP-OMEN-RECONCILE-1: TrimEnd, not Trim.
    # 2026-10-03: was `.Trim()`. A GLOBAL trim also strips the LEADING porcelain status column of
    # the first line, so a caller doing `Substring(3)` to skip `XY ` is silently off by one on that
    # line (` D outbox/x` -> `D outbox/x` -> `utbox/x`). Only trailing whitespace is padding from
    # Out-String; leading whitespace is data. TrimEnd keeps it.
    [pscustomobject]@{ Code = $LASTEXITCODE; Output = (($out | Out-String)).TrimEnd() }
  } finally { $ErrorActionPreference = $prev }
}

function Test-HasRemote {
  $r = Invoke-Git @('remote')
  return ($r.Code -eq 0 -and $r.Output)
}

function Assert-Repo {
  if (-not (Test-Path (Join-Path $Farm '.git'))) {
    Write-Log 'FATAL: farm repo not initialized (no .git). Run ASPIRE-BOOTSTRAP step 1.'
    exit 1
  }
  $idn = Invoke-Git @('config', 'user.email')
  if (-not $idn.Output) {
    Write-Log 'FATAL: repo-local git identity missing. Run ASPIRE-BOOTSTRAP step 1.'
    exit 1
  }
}

function Sync-Repo {
  # Self-heal: commit staged AND unstaged changes under outbox\ before pulling (incident 6).
  # 2026-10-03 hp fix, folded into this template by FARM-WORKER-HP-OMEN-RECONCILE-1: -z porcelain self-heal.
  # 2026-10-03 (sync-deadlock): this used `git status --porcelain` and sliced paths with
  # `Substring(3)`. Two faults made it blind to exactly the state it exists to repair:
  #   1. `Invoke-Git` trimmed the whole output, stripping the first line's leading status column,
  #      so ` D outbox/x` (an UNSTAGED DELETION) became `D outbox/x` -> Substring(3) = `utbox/x`.
  #      Untracked `?? outbox/x` was unaffected, which is why only additions ever self-healed.
  #   2. `Substring(3)` threw on any line shorter than 3 chars.
  # A push-rejected landing leaves an uncommitted outbox deletion behind, so this blindness was
  # what let one failed push wedge `git pull --rebase` ("cannot pull with rebase: You have
  # unstaged changes") for hours while the worker kept committing heartbeats.
  # Now NUL-delimited (-z: no quoting/escaping, no leading-space ambiguity), split defensively on
  # NULs OR newlines, length-guarded, and quote-tolerant.
  $st = Invoke-Git @('status', '--porcelain', '-z')
  if ($st.Code -ne 0) { Write-Log "git status failed: $($st.Output)"; return $false }
  $outboxDirt = @($st.Output -split "[`0`r`n]+" |
    Where-Object { $_.Length -ge 4 -and $_.Substring(3).Trim('"') -like 'outbox/*' })
  foreach ($line in $outboxDirt) { Write-Log ('self-heal: ' + $line.Trim()) }
  if ($outboxDirt.Count -gt 0) {
    $add = Invoke-Git @('add', '-A', '--', 'outbox')
    $ci  = Invoke-Git @('commit', '-m', "farm: self-heal outbox before pull [$Machine]")
    Write-Log "self-heal commit code=$($ci.Code)"
  }
  if (Test-HasRemote) {
    $pull = Invoke-Git @('pull', '--rebase')
    if ($pull.Code -ne 0) { Write-Log "git pull --rebase failed: $($pull.Output)"; return $false }
    Write-Log 'pull ok'
  } else {
    Write-Log 'no git remote configured yet; skipping pull'
  }
  return $true
}

function Resolve-LaneExe {
  param([string]$Harness)
  $lane = $script:Lanes[$Harness]
  if (-not $lane) { return $null }
  # a lane can need more than an exe (workbuddy needs the desktop app's CLI script): a missing
  # RequireFile defers the tasking with a log line naming the path, it never fails it
  if ($lane.RequireFile -and -not (Test-Path $lane.RequireFile)) {
    Write-Log ("lane '{0}' not installed on this machine: {1}" -f $Harness, $lane.RequireFile)
    return $null
  }
  foreach ($name in $lane.ExeNames) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue |
           Where-Object { $_.CommandType -eq 'Application' } |
           Select-Object -First 1
    if ($cmd) { return $cmd.Source }
  }
  foreach ($p in $lane.FallbackExe) { if (Test-Path $p) { return $p } }
  return $null
}

function Resolve-RotatedModel {
  # One step per run through the lane's RotateModels patterns. The counter lives in logs\ (never
  # committed: logs\ is outside every pathspec this worker stages) so each machine rotates on its
  # own. Returns the lane's DefaultModel when the catalog cannot be read or nothing matches, so a
  # broken `opencode models` call can never stop a run.
  param([hashtable]$Lane, [string]$ExePath, [string]$LaneName)
  if (-not $Lane.RotateModels -and -not $Lane.RotateModelsLiteral) { return '' }
  $resolved = @()
  if ($Lane.RotateModelsLiteral) {
    # Lanes whose CLI has no model-catalog command (cline, 2026-09-20) rotate a LITERAL id list:
    # a renamed or promotion-ended id fails its run in under a second ("model not found"), and the
    # per-run counter below moves the NEXT run to the next id, so a dead entry self-heals out of
    # the way. Verified live on the Omen 2026-09-20: muse-spark-1.3, deepseek-v4.1-flash and
    # kimi-k3 all answer through cline-free (kimi 3.4 s, deepseek 1.9 s, cost 0). kimi-k3 left
    # the free tier by 2026-10-01 (probe: "model not found"); mimo-v2.6-flash is its replacement.
    $resolved = @($Lane.RotateModelsLiteral)
  } else {
    $listed = @()
    try {
      # Same launch discipline as a real run: stdin closed, tree-killed on a hard 60 s limit, so the
      # catalog call can never be the thing that hangs the worker.
      $psi = [System.Diagnostics.ProcessStartInfo]::new()
      $psi.FileName = $ExePath; $psi.Arguments = 'models'
      $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
      $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.RedirectStandardInput = $true
      Set-ScrubbedEnv -Psi $psi -Extra $Lane.EnvAllow -TmpDir (Join-Path $Farm ('scratch\_catalog-' + $LaneName + '\tmp'))
      $mp =[System.Diagnostics.Process]::Start($psi)
      try { $mp.StandardInput.Close() } catch {}
      $mo = $mp.StandardOutput.ReadToEndAsync(); $me = $mp.StandardError.ReadToEndAsync()
      if ($mp.WaitForExit(60000)) {
        if ($mo.Wait(5000)) { $listed = @($mo.Result -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
      } else {
        try { & "$env:ComSpec" /c ("taskkill /PID {0} /T /F >nul 2>&1" -f $mp.Id) | Out-Null } catch {}
        Write-Log ("{0}: model catalog call exceeded 60 s, killed" -f $LaneName)
      }
    } catch { Write-Log ("{0}: model catalog call failed: {1}" -f $LaneName, $_.Exception.Message) }
    foreach ($pat in $Lane.RotateModels) {
      $hit = $listed | Where-Object { $_ -match $pat } | Select-Object -First 1
      if ($hit) { $resolved += $hit } else { Write-Log ("{0}: rotation pattern not in this machine's catalog, skipped: {1}" -f $LaneName, $pat) }
    }
  }
  if ($resolved.Count -eq 0) { Write-Log ("{0}: no rotation model resolved, using default {1}" -f $LaneName, $Lane.DefaultModel); return $Lane.DefaultModel }
  $ctrPath = Join-Path $LogsDir ($LaneName + '-rotation.txt')
  $n = 0
  if (Test-Path $ctrPath) { $raw = (Get-Content $ctrPath -TotalCount 1); if ($raw -match '^\d+$') { $n = [int]$raw } }
  $model = $resolved[$n % $resolved.Count]
  Set-Content -Path $ctrPath -Value ($n + 1)
  return $model
}

function Get-Taskings {
  Get-ChildItem -Path $Inbox -Filter '*.md' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike 'NOTE-*' } |
    Sort-Object LastWriteTime, Name
}

function Test-TaskClaimed {
  param([System.IO.FileInfo]$Tasking)
  $id = $Tasking.BaseName
  # A report whose STATUS line was never flipped is a DEAD RUN, not a result. Taskings with a
  # STEP 0 block create the report in their first minute, so a run killed mid-way leaves a stub
  # this test used to count as finished - PS-3B did exactly that on 2026-09-08: header only,
  # committed as a REPORT, no .FAILED, no log tail. A report with neither marker is legacy and
  # still counts as complete, so existing reports are unaffected.
  $rp = Join-Path $Outbox ($id + '-REPORT.md')
  if (Test-Path $rp) {
    $rb = Get-Content $rp -Raw
    $stub = ($rb -match '(?m)^\s*STATUS:\s*IN PROGRESS') -and ($rb -notmatch '(?m)^\s*STATUS:\s*(COMPLETE|PARTIAL)')
    if (-not $stub) { return 'reported' }
    Write-Log ("{0}: report is a STATUS:IN PROGRESS stub from a dead run, re-running" -f $id)
  }
  if (Test-Path (Join-Path $Outbox ($id + '.FAILED')))    { return 'failed' }
  # .DEFERRED marks a PROVIDER fault (429/500/quota, or a clean exit with no report), never a
  # defect in the tasking: eligible again after a cooldown, unlike .FAILED which stays permanent.
  # The caller tests truthiness, so 'cooling' skips the tasking exactly like 'reported'/'failed'.
  $dfr = Join-Path $Outbox ($id + '.DEFERRED')
  if (Test-Path $dfr) {
    $dage = ((Get-Date) - (Get-Item $dfr).LastWriteTime).TotalMinutes
    if ($dage -lt 60) { return 'cooling' }
    Write-Log ("{0}: DEFERRED cooldown elapsed ({1} min), retrying" -f $id, [int]$dage)
  }
  $run = Join-Path $Outbox ($id + '.RUNNING')
  if (Test-Path $run) {
    $ageH = ((Get-Date) - (Get-Item $run).LastWriteTime).TotalHours
    if ($ageH -lt $RunningStaleHrs) { return 'running-fresh' }
    Remove-Item $run -Force
    Write-Log ("cleared stale RUNNING marker for {0} ({1} h)" -f $id, [math]::Round($ageH, 1))
  }
  return $null
}

function Git-Land {
  # returns $true when the landing is durably recorded locally (and pushed when a remote exists)
  param([string]$Message)
  $add = Invoke-Git @('add', '--', 'outbox')
  if ($add.Code -ne 0) { Write-Log "git add failed: $($add.Output)"; return $false }
  $ci = Invoke-Git @('commit', '-m', $Message)
  if ($ci.Code -ne 0) { Write-Log "git commit failed: $($ci.Output)"; return $false }
  if (Test-HasRemote) {
    $push = Invoke-Git @('push')
    if ($push.Code -ne 0) { Write-Log "git push failed: $($push.Output)"; return $false }
  } else {
    Write-Log 'no remote configured; landing kept local'
  }
  return $true
}

# ---- env-scrub begin (FARM-HARNESS-ENV-SCRUB-1, 2026-09-19)
# A harness is an untrusted third-party model with a shell. Its child process gets an ALLOWLISTED
# environment, never the parent's: a denylist of known secret names misses the next key someone
# adds to the user environment. A lane adds a variable via its EnvAllow list ONLY when a smoke
# run fails without it.
$script:EnvAllowBase = @('SystemRoot','windir','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramData','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','OS')
$script:SecretNameRe = '(?i)KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL'

function Set-ScrubbedEnv {
  # Replaces the child's whole environment with the allowlist. Refuses (throws) when any allowlisted
  # name looks secret. Logs the NAMES passed, never the values. TmpDir, when given, becomes the
  # child's TEMP and TMP so it cannot drop or read files in the shared user temp.
  param($Psi, [string[]]$Extra = @(), [string]$TmpDir = '')
  $names = @($script:EnvAllowBase) + @($Extra | Where-Object { $_ })
  $bad = @($names | Where-Object { $_ -match $script:SecretNameRe })
  if ($bad.Count -gt 0) { throw ('env scrub self-check: secret-named variable in allowlist: ' + ($bad -join ',')) }
  $keep = @{}
  foreach ($n in $names) {
    $v = [Environment]::GetEnvironmentVariable($n)
    if ($null -ne $v) { $keep[$n] = $v }
  }
  $Psi.EnvironmentVariables.Clear()
  foreach ($k in $keep.Keys) { $Psi.EnvironmentVariables[$k] = $keep[$k] }
  if ($TmpDir) {
    if (-not (Test-Path $TmpDir)) { New-Item -ItemType Directory -Force $TmpDir | Out-Null }
    $Psi.EnvironmentVariables['TEMP'] = $TmpDir
    $Psi.EnvironmentVariables['TMP'] = $TmpDir
  }
  $passed = @($Psi.EnvironmentVariables.Keys | ForEach-Object { [string]$_ } | Sort-Object)
  $secretPassed = @($passed | Where-Object { $_ -match $script:SecretNameRe })
  if ($secretPassed.Count -gt 0) { throw ('env scrub self-check: secret-named variable reached the child: ' + ($secretPassed -join ',')) }
  Write-Log ('child env names ({0}): {1}' -f $passed.Count, ($passed -join ','))
}
# ---- env-scrub end

function Invoke-Harness {
  param([string]$ExePath, [string]$ArgString, [int]$TimeoutMin, [string]$JobLogPath, [string]$WorkDir = $Farm, [bool]$CloseStdin = $false, [string[]]$EnvAllow = @(), [string]$TmpDir = '')
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName               = $ExePath
  $psi.Arguments              = $ArgString   # ONE pre-quoted string (incident 1)
  $psi.UseShellExecute        = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.RedirectStandardInput  = $CloseStdin
  $psi.CreateNoWindow         = $true
  $psi.WorkingDirectory       = $WorkDir
  try { Set-ScrubbedEnv -Psi $psi -Extra $EnvAllow -TmpDir $TmpDir }
  catch {
    Write-Log ('REFUSED to launch harness: ' + $_.Exception.Message)
    return [pscustomobject]@{ ExitCode = -2; TimedOut = $false; Refused = $_.Exception.Message }
  }
  $proc = [System.Diagnostics.Process]::Start($psi)
  if ($CloseStdin) { try { $proc.StandardInput.Close() } catch {} }   # hand the child an immediate EOF
  $so = $proc.StandardOutput.ReadToEndAsync()
  $se = $proc.StandardError.ReadToEndAsync()
  $timedOut = $false
  if (-not $proc.WaitForExit($TimeoutMin * 60 * 1000)) {
    $timedOut = $true
    # Kill the TREE, not the launcher. opencode.cmd / cline.cmd are shims: $proc is cmd.exe and the
    # real work is a node grandchild. Process.Kill() took only the shim, and ProStar carried a
    # 15 h orphan opencode.exe on 2026-09-18 that held its own files and kept its provider session.
    # Through cmd with both streams sent to nul: under ErrorActionPreference=Stop, PowerShell 5.1
    # turns a captured native stderr line into a terminating error.
    try { & "$env:ComSpec" /c ("taskkill /PID {0} /T /F >nul 2>&1" -f $proc.Id) | Out-Null } catch {}
    try { if (-not $proc.HasExited) { $proc.Kill() }; $proc.WaitForExit(10000) | Out-Null } catch {}
  }
  $tail = ''
  try { if ($so.Wait(5000)) { $tail += $so.Result } } catch {}
  try { if ($se.Wait(5000)) { $tail += $se.Result } } catch {}
  Set-Content -Path $JobLogPath -Value $tail
  [pscustomobject]@{ ExitCode = if ($timedOut) { -1 } else { $proc.ExitCode }; TimedOut = $timedOut; Refused = '' }
}

function Land-Failure {
  # $Kind defaults to FAILED (permanent, never re-picked). Callers pass DEFERRED only for a
  # PROVIDER fault - a clean exit with no report, or a 429/500/quota tail. Genuine defects such
  # as a missing harness header keep the default and stay permanent.
  param([string]$Id, [string]$Reason, [string]$Harness, [string]$Kind = 'FAILED')
  # Deferral cap. A .DEFERRED tasking is retried after 60 min and meanwhile counts as IN FLIGHT to
  # bus-feed.mjs, so one tasking a model can never finish (ProStar T1-MR-F31CE5C5, 2026-09-16..18:
  # 35 deferrals, "produced only internal reasoning and no final answer") held its lane shut for
  # days. The count rides in the marker's own first line; the third deferral becomes a FAILED.
  $MaxDeferrals = 3
  $dfrPath = Join-Path $Outbox ($Id + '.DEFERRED')
  if ($Kind -eq 'DEFERRED') {
    $n = 0
    if (Test-Path $dfrPath) {
      $first = (Get-Content $dfrPath -TotalCount 1)
      if ($first -match '^DEFERRALS:\s*(\d+)') { $n = [int]$Matches[1] } else { $n = 1 }
    }
    $n++
    if ($n -ge $MaxDeferrals) {
      $Kind = 'FAILED'
      $Reason = ("deferred {0} times, giving up and freeing the lane; last: {1}" -f $n, $Reason)
      Remove-Item $dfrPath -Force -ErrorAction SilentlyContinue
    } else {
      $Reason = ("DEFERRALS: {0}`n{1}" -f $n, $Reason)
    }
  }
  # bus-feed.mjs reads a UTC stamp from the first two lines of a non-quota .FAILED to run its
  # HARNESS-DEAD breaker (2 in 24 h). This worker family wrote none, so the breaker never fired on
  # ps / nitro / aspire and a dead lane kept being fed. A QUOTA first line already carries a stamp
  # and must stay first, so only non-quota FAILED reasons are stamped.
  if (($Kind -eq 'FAILED') -and ($Reason -notmatch '^QUOTA ')) {
    $Reason = ("{0} {1}" -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mmZ'), $Reason)
  }
  $jobLog = Join-Path $LogsDir ($Id + '.log')
  $logTail = ''
  if (Test-Path $jobLog) { $logTail = (Get-Content $jobLog -Tail 30) -join "`n" }
  Set-Content -Path (Join-Path $Outbox ($Id + '.' + $Kind)) `
    -Value ("{0}`n`n--- last 30 log lines ({1}) ---`n{2}" -f $Reason, $jobLog, $logTail)
  Git-Land ("farm: {0} {1} [{2}/{3}]" -f $Id, $Kind, $Machine, $Harness) | Out-Null
  Write-Log ("{0}: {1} ({2})" -f $Kind, $Id, $Reason)
}

$script:HeartbeatDone = $false
function Write-Heartbeat {
  # -Status names what this run could do. 'sync-failed' is written when git pull fails, so that a
  # network outage stops looking like a dead machine: the line is committed locally and reaches
  # the bus with the next successful push (ProStar 2026-09-17/18: 14 h silent, machine was fine).
  param([string]$Status = 'worker-ok')
  # Plan B1. AutoClaw is what reports this laptop's state to a human; when it dies the worker keeps
  # running from Task Scheduler and nobody can tell. One line per run on the bus makes liveness
  # readable from any machine with `git log -1 -- notes/HEARTBEAT-@@BUS@@.md`, with no email and no popup.
  # Capped at one commit per 30 min so a 15-minute tick cannot fill the bus with heartbeats. Called
  # at the END of every path, including 'inbox empty' and 'fresh lock'.
  if ($script:HeartbeatDone) { return }
  $script:HeartbeatDone = $true
  try {
    $notes = Join-Path $Farm 'notes'
    if (-not (Test-Path $notes)) { New-Item -ItemType Directory -Force $notes | Out-Null }
    $hb = Join-Path $notes 'HEARTBEAT-@@BUS@@.md'
    $nowUtc = (Get-Date).ToUniversalTime()
    if (Test-Path $hb) {
      $prev = @(Get-Content $hb | Where-Object { $_ -match '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' })
      if ($prev.Count -gt 0) {
        $m = [regex]::Match($prev[-1], '^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z)')
        if ($m.Success) {
          $styles = [Globalization.DateTimeStyles]::AdjustToUniversal -bor [Globalization.DateTimeStyles]::AssumeUniversal
          $lastAt = [datetime]::Parse($m.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture, $styles)
          if (($nowUtc - $lastAt).TotalMinutes -lt 30) { return }
        }
      }
    }
    # unclaimed = a tasking in inbox with no report and no .FAILED yet
    $unclaimed = 0
    foreach ($t in (Get-ChildItem -Path $Inbox -Filter '*.md' -File -ErrorAction SilentlyContinue)) {
      if ($t.Name -like 'NOTE-*') { continue }
      if (Test-Path (Join-Path $Outbox ($t.BaseName + '-REPORT.md'))) { continue }
      if (Test-Path (Join-Path $Outbox ($t.BaseName + '.FAILED'))) { continue }
      $unclaimed++
    }
    $run = '-'
    $r = Get-ChildItem -Path $Outbox -Filter '*.RUNNING' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1
    if ($r) { $run = $r.BaseName }
    $lf = '-'
    $f = Get-ChildItem -Path $Outbox -Filter '*.FAILED' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1
    if ($f) { $lf = $f.BaseName }
    $line = '{0} {1} {5} inbox={2} running={3} last-failed={4}' -f $nowUtc.ToString('yyyy-MM-ddTHH:mmZ'), $env:COMPUTERNAME, $unclaimed, $run, $lf, $Status
    if ($DryRun) { Write-Log ('heartbeat (dry-run, not written): ' + $line); return }
    if (-not (Test-Path $hb)) { Set-Content -Path $hb -Value '# HEARTBEAT-@@BUS@@ - one line per worker run, at most one commit per 30 min (Plan B1)' }
    Add-Content -Path $hb -Value $line
    # by pathspec: Git-Land stages only outbox, and a heartbeat must never sweep in anything else
    $add = Invoke-Git @('add', '--', 'notes/HEARTBEAT-@@BUS@@.md')
    if ($add.Code -ne 0) { Write-Log ('heartbeat add failed: ' + $add.Output); return }
    $ci = Invoke-Git @('commit', '-m', 'farm: @@BUS@@ heartbeat')
    if ($ci.Code -ne 0) { Write-Log ('heartbeat commit failed: ' + $ci.Output); return }
    if (Test-HasRemote) {
      # 2026-09-30 omen fix, folded into this template by FARM-WORKER-HP-OMEN-RECONCILE-1 (FARM-HERMES-SWAP-1 open item 1).
      # sync before push: a bare push rejects whenever origin moved after Sync-Repo ran (bus heartbeat divergence 2026-09-30);
      # heartbeat stays advisory - a failed rebase skips this tick's push, it never blocks a report
      $null = Invoke-Git @('fetch', 'origin')
      $behind = Invoke-Git @('rev-list', '--count', 'HEAD..origin/main')
      $needRebase = ($behind.Code -eq 0 -and $behind.Output -match '^(\d+)$' -and [int]$Matches[1] -gt 0)
      if ($needRebase) {
        $rb = Invoke-Git @('pull', '--rebase', 'origin', 'main')
        Write-Log ('heartbeat rebase code=' + $rb.Code)
      }
      if (-not $needRebase -or $rb.Code -eq 0) {
        $push = Invoke-Git @('push')
        if ($push.Code -ne 0) { Write-Log ('heartbeat push failed: ' + $push.Output) }
      }
    }
    Write-Log ('heartbeat: ' + $line)
  } catch {
    # a heartbeat is diagnostics: it must never be the reason a report fails to land
    Write-Log ('heartbeat skipped: ' + $_.Exception.Message)
  }
}

# ---------------- main ----------------

Assert-Repo
if (-not (Sync-Repo)) { Write-Heartbeat -Status 'sync-failed'; exit 1 }

if (Test-Path $LockFile) {
  $ageH = ((Get-Date) - (Get-Item $LockFile).LastWriteTime).TotalHours
  if ($ageH -lt $LockStaleHrs) { Write-Log 'defer: fresh worker lock, a job is in flight'; Write-Heartbeat; exit 0 }
  Remove-Item $LockFile -Force
  Write-Log ("removed stale lock ({0} h)" -f [math]::Round($ageH, 1))
}

try {
  New-Item -ItemType File -Path $LockFile -Force | Out-Null

  $picked = $null; $laneName = ''; $exePath = ''
  foreach ($t in (Get-Taskings)) {
    if ($TaskId -and ($t.BaseName -ne $TaskId)) { continue }
    $id = $t.BaseName
    $claim = Test-TaskClaimed $t
    if ($claim) {
      if ($TaskId) { Write-Log "task $id not eligible: $claim"; exit 0 }
      continue
    }
    $head = (Get-Content $t.FullName -TotalCount 15) -join "`n"
    $harness = ''
    if ($head -match '(?m)^\s*harness:\s*([A-Za-z0-9_-]+)') { $harness = $Matches[1].ToLowerInvariant() }
    # Lane names have been the HARNESS names since 2026-09-20 (Tim): step -> hermes, muse ->
    # opencode. Taskings still in flight carry the legacy names; alias them so nothing starves.
    if ($harness -eq 'step') { $harness = 'hermes' }
    elseif ($harness -eq 'muse') { $harness = 'opencode' }
    if (-not $harness) {
      if ($TaskId) { Write-Log "task $id has no harness header"; exit 2 }
      Land-Failure -Id $id -Reason 'no harness header' -Harness 'none'
      continue
    }
    $exe = Resolve-LaneExe $harness
    if (-not $exe) {
      if ($TaskId) { Write-Log "lane '$harness' exe not found on $Machine"; exit 3 }
      Write-Log "defer $id : lane '$harness' has no exe on this machine"
      continue
    }
    $picked = $t; $laneName = $harness; $exePath = $exe
    break
  }

  if ($TaskId -and -not $picked) { Write-Log "task $TaskId not found in inbox or not eligible"; exit 0 }
  if (-not $picked) { Write-Log 'inbox empty (nothing eligible)'; exit 0 }

  $id = $picked.BaseName
  $head = (Get-Content $picked.FullName -TotalCount 15) -join "`n"
  $timeoutMin = if ($head -match '(?m)^\s*timeout-min:\s*(\d+)') { [int]$Matches[1] } else { $DefaultTimeoutMin }

  if ($DryRun) {
    Write-Log ("dry-run: would run [{0}] read {1} (timeout {2} min)" -f $laneName, ($picked.FullName -replace '\\', '/'), $timeoutMin)
    $marker = Join-Path $Outbox ($id + '.RUNNING')
    Set-Content -Path $marker -Value ("{0} dry-run {1}" -f $Machine, (Get-Date).ToUniversalTime().ToString('s'))
    if (Git-Land ("farm: {0} RUNNING dry-run marker [{1}]" -f $id, $Machine)) {
      Remove-Item $marker -Force
      if (Git-Land ("farm: dry-run marker cleanup [{0}]" -f $Machine)) {
        Write-Log 'dry-run OK: RUNNING marker landing + removal cycle completed'
      } else { Write-Log 'dry-run: marker cleanup landing failed (see log)' }
    } else {
      Write-Log 'dry-run: marker landing FAILED - check GitHub auth/remote'
    }
    exit 0
  }

  # claim the tasking: RUNNING marker + landing (a landing failure means reports cannot land either)
  $marker = Join-Path $Outbox ($id + '.RUNNING')
  Set-Content -Path $marker -Value ("{0} started {1}" -f $Machine, (Get-Date).ToUniversalTime().ToString('s'))
  if (-not (Git-Land ("farm: {0} RUNNING [{1}/{2}]" -f $id, $Machine, $laneName))) {
    # 2026-10-03 hp fix, folded into this template by FARM-WORKER-HP-OMEN-RECONCILE-1: keep a committed-but-unpushed RUNNING marker.
    # 2026-10-03 (sync-deadlock): Git-Land returns $false when the PUSH is rejected even though the
    # COMMIT already landed. Blindly removing the marker then deleted a committed file, leaving an
    # uncommitted deletion (` D outbox/<id>.RUNNING`) that blocked every later `git pull --rebase`
    # with "cannot pull with rebase: You have unstaged changes" - and, because the old self-heal
    # could not see deletions, it never recovered. Observed live: T1-CON-8C9B2278 wedged the tree
    # from 06:27Z and diverged the branch to 65 remote / 12 local commits.
    # Only remove the working file when the commit did NOT land; if the marker is tracked at HEAD
    # the landing is already durable, so leave the tree clean and let the push retry next tick.
    $tracked = Invoke-Git @('ls-files', '--error-unmatch', '--', ('outbox/' + $id + '.RUNNING'))
    if ($tracked.Code -eq 0) {
      Write-Log "abort: RUNNING marker for $id committed locally but NOT pushed (tree left clean; push retries next tick)"
    } else {
      Remove-Item $marker -Force -ErrorAction SilentlyContinue
      Write-Log "abort: could not land RUNNING marker for $id"
    }
    exit 1
  }

  $reportPath = Join-Path $Outbox ($id + '-REPORT.md')
  $jobLog = Join-Path $LogsDir ($id + '.log')

  # FARM-WORKER-FAIL-FORWARD-1 (2026-09-29, Tim: "harnesses aren't dead, you're just not rotating
  # them properly - once hy4-preview runs out of session, try DeepSeek v4.1"). Rotation advanced
  # one step per DISPATCH, so a dead model cost a full timeout before the NEXT tasking tried the
  # next id. A failed attempt whose exit or log tail carries a model-fault signature now retries
  # on the NEXT rotation id inside the same dispatch: Resolve-RotatedModel's per-lane counter
  # advances on every call, so re-invoking it IS the rotation. Capped at $maxAttempts; a failure
  # WITHOUT a model-fault signature (a tasking defect) lands immediately, exactly as before.
  $maxAttempts = 3
  $attempt = 0
  while ($true) {
    $attempt++
  # scratch cwd (farm automation plan section B). Everything a free model sees is training data,
  # and the harness used to run with cwd = the farm root, so notes\, inbox\ and queue\ were one
  # relative path away. The run now happens in scratch\<ID>\, holding only a copy of its own
  # tasking and a junction to repos\, so the public clone still resolves as repos\ainumbers and
  # nothing else on the bus is reachable. The worker copies the report out; the model never
  # picks the outbox path. Recreated per attempt: a partial run's leftovers must never
  # masquerade as the retry's report.
  $scratchDir = Join-Path $Farm ('scratch\' + $id)
  if (Test-Path $scratchDir) { Remove-Item $scratchDir -Recurse -Force }
  New-Item -ItemType Directory -Force $scratchDir | Out-Null
  Copy-Item -Path $picked.FullName -Destination (Join-Path $scratchDir ($id + '.md')) -Force
  $reposSrc = Join-Path $Farm 'repos'
  if (Test-Path $reposSrc) {
    try { New-Item -ItemType Junction -Path (Join-Path $scratchDir 'repos') -Target $reposSrc -ErrorAction Stop | Out-Null }
    catch { Write-Log ("{0}: junction to repos failed ({1}); harness runs without repos" -f $id, $_.Exception.Message) }
  }
  $scratchReport = Join-Path $scratchDir ($id + '-REPORT.md')
  $taskPathAbs = (Join-Path $scratchDir ($id + '.md')) -replace '\\', '/'
  $reportPathAbs = $scratchReport -replace '\\', '/'
  $prompt = "read $taskPathAbs and follow it exactly. write your report to $reportPathAbs."
  $lane = $script:Lanes[$laneName]

  # cline's rig is created ONCE by the operator (interactive `cline auth cline`), never by this
  # script: a missing template lands a .FAILED naming the exact path rather than running
  # unauthenticated. ASPIRE-BOOTSTRAP step 2 carries the precondition.
  $runDir = ''
  if ($laneName -eq 'cline') {
    $runnerRoot = Join-Path $env:USERPROFILE '.cline-runner'
    $template   = Join-Path $runnerRoot 'template-data'
    if (-not (Test-Path $template)) {
      Remove-Item $marker -Force -ErrorAction SilentlyContinue
      Land-Failure -Id $id -Reason ("cline rig missing: $template (operator must run cline auth cline and create template-data once, ASPIRE-BOOTSTRAP step 2)") -Harness $laneName
      exit 1
    }
    $runDir = Join-Path $runnerRoot ('run-' + $id)
    if (Test-Path $runDir) { Remove-Item $runDir -Recurse -Force }
    Copy-Item -Path $template -Destination $runDir -Recurse -Force
    Set-Content -Path (Join-Path $runDir 'brief.txt') -Value $prompt   # the audit trail the runbook keeps
  }
  # cline's own timeout is seconds and must fire before this worker kills the process, so the
  # NDJSON stream still ends in a run_result receipt the log tail can carry.
  $cSec = ($timeoutMin * 60) - 30
  if ($cSec -lt 60) { $cSec = 60 }
  # ArgFormat now takes four values: {0} prompt, {1} data dir, {2} cwd, {3} cline timeout in
  # seconds. The step and muse formats reference only {0} and are unaffected.
  # {4} is the rotated model id; only a lane with RotateModels references it.
  $model = Resolve-RotatedModel -Lane $lane -ExePath $exePath -LaneName $laneName
  $modelNote = ''; if ($model) { $modelNote = ' model=' + $model }
  $argString = $lane.ArgFormat -f ($prompt -replace '"', '\"'), $runDir, $scratchDir, $cSec, $model
  Write-Log ("launching {0}{3} (timeout {1} min) for {2}" -f $laneName, $timeoutMin, $id, $modelNote)
  $res = Invoke-Harness -ExePath $exePath -ArgString $argString -TimeoutMin $timeoutMin -JobLogPath $jobLog -WorkDir $scratchDir -CloseStdin ([bool]$lane.CloseStdin) -EnvAllow @($lane.EnvAllow) -TmpDir (Join-Path $scratchDir 'tmp')
  if ($res.Refused) {
    Remove-Item $marker -Force -ErrorAction SilentlyContinue
    Land-Failure -Id $id -Reason ("env scrub refused the launch: " + $res.Refused) -Harness $laneName
    exit 1
  }
  Write-Log ("harness exited code={0} timedOut={1}" -f $res.ExitCode, $res.TimedOut)

  # the worker, not the model, moves the report onto the bus
  # Taskings say "write to outbox/<ID>-REPORT.md"; from the scratch cwd that lands in scratch\<ID>\outbox\ (measured
  # 2026-09-11: GOLDEN-HASH-CROSS-MACHINE-PS-1 wrote a complete report there and the bus saw "no report"). Accept
  # either location, and carry the report's companion dir (<ID>.d) when present.
  $scratchOutboxReport = Join-Path $scratchDir ('outbox\' + $id + '-REPORT.md')
  if (-not (Test-Path $scratchReport) -and (Test-Path $scratchOutboxReport)) { $scratchReport = $scratchOutboxReport }
  if (Test-Path $scratchReport) {
    Copy-Item -Path $scratchReport -Destination $reportPath -Force
    foreach ($dd in @((Join-Path $scratchDir ($id + '.d')), (Join-Path $scratchDir ('outbox\' + $id + '.d')))) {
      if (Test-Path $dd) { Copy-Item -Path $dd -Destination (Join-Path $Outbox ($id + '.d')) -Recurse -Force }
    }
    Write-Log ("{0}: report copied out of scratch ({1})" -f $id, $scratchReport)
  }

  if ((Test-Path $reportPath) -and (-not $res.TimedOut)) {
    Remove-Item $marker -Force
    # a retried tasking would otherwise keep its .DEFERRED marker forever
    $dm = Join-Path $Outbox ($id + '.DEFERRED')
    if (Test-Path $dm) { Remove-Item $dm -Force; Write-Log ("{0}: cleared stale .DEFERRED" -f $id) }
    if (Git-Land ("farm: {0} REPORT [{1}/{2}]" -f $id, $Machine, $laneName)) {
      Write-Log "success: $id report landed$modelNote"
      exit 0
    }
    Write-Log "report exists but landing failed for $id (next tick's self-heal will retry the landing)"
    exit 1
  }

  $reason = "harness exit code $($res.ExitCode), no report produced$modelNote"
  if ($res.TimedOut) { $reason = "harness timed out after $timeoutMin min$modelNote" }
  # A clean exit with no report is a PROVIDER fault, not a defect in the work: the harness ran,
  # talked to the provider, gave up and returned 0. Three taskings were retired on this bus that
  # way in two days (PS-1 quota, PS-2 connectivity, PS-3 429 capacity); not one was a defect.
  $jl = Join-Path $LogsDir ($id + '.log')
  $lt = ''; if (Test-Path $jl) { $lt = (Get-Content $jl -Tail 30) -join "`n" }
  # model fault = this attempt's MODEL is the problem, not the tasking: a timeout (session/
  # quota exhaustion hangs the harness until the worker kills it - hy4-preview on hp, 2026-09-29),
  # a clean exit with no report (provider gave up), or a tail signature naming the model side.
  # Only a model fault is worth the next rotation id; anything else falls through to the landing.
  $modelFault = ($res.TimedOut -or ($res.ExitCode -eq 0) -or
    ($lt -match '(?i)(model not found|promotion ended|endpoint is unavailable|upstream request failed|INFERENCE_CAP|quota|rate.?limit|429|insufficient)'))
  if ($modelFault -and ($attempt -lt $maxAttempts) -and ($lane.RotateModels -or $lane.RotateModelsLiteral)) {
    Write-Log ("{0}: model fault on {1} (attempt {2}/{3}: {4}); advancing rotation and retrying on the next id" -f $id, $model, $attempt, $maxAttempts, ($reason -split "`n" | Select-Object -Last 1))
    continue
  }
  Remove-Item $marker -Force -ErrorAction SilentlyContinue
  $transient = $false
  if ((-not $res.TimedOut) -and ($res.ExitCode -eq 0)) { $transient = $true }
  if ($lt -match '(?i)\b(429|HTTP 500|rate.?limit|at capacity|quota|temporarily)\b') { $transient = $true }
  $kind = 'FAILED'; if ($transient) { $kind = 'DEFERRED' }
  # A daily cap is neither a defect nor an ordinary transient: it is spent budget, and it stays
  # spent until the provider's reset. bus-feed.mjs tells one from the other by the FIRST LINE, so
  # a cap lands a .FAILED beginning `QUOTA <pattern> <UTC>`; the feeder then puts the tasking back
  # at the head of queue/ with retries: N+1 instead of the tasking being lost (plan section B).
  if ($lt -match '(?i)(Daily free model limit|INFERENCE_CAP|429|rate.?limit|quota|insufficient)') {
    $kind = 'FAILED'
    $reason = 'QUOTA ' + $Matches[1] + ' ' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mmZ') + "`n" + $reason
  }
  Land-Failure -Id $id -Reason $reason -Harness $laneName -Kind $kind
  exit 1
  } # while ($true) - FARM-WORKER-FAIL-FORWARD-1 attempt loop
} finally {
  # every exit path above (including the `exit 0` for an empty inbox) runs this block
  Write-Heartbeat
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}
