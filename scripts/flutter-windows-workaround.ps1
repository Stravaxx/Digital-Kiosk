Param(
  [ValidateSet('run','build-windows','build-apk','build-appbundle')]
  [string]$Mode = 'run',
  [string]$SourceFlutterDir = 'Digital Kiosk Manager',
  [string]$MirrorRoot = "$env:LOCALAPPDATA\DigitalKiosk\flutter_kiosk_manager_ntfs"
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
  Param(
    [string]$Title,
    [scriptblock]$Action
  )
  Write-Host "`n==> $Title" -ForegroundColor Cyan
  & $Action
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot $SourceFlutterDir
$mirrorPath = $MirrorRoot

if (-not (Test-Path $sourcePath)) {
  # Fallback for users who pass a path relative to the current directory.
  $fallbackSourcePath = Resolve-Path -Path $SourceFlutterDir -ErrorAction SilentlyContinue
  if ($fallbackSourcePath) {
    $sourcePath = $fallbackSourcePath.Path
  }
}

if (-not (Test-Path $sourcePath)) {
  throw "Dossier Flutter introuvable: $sourcePath"
}

Invoke-Step "Preparation du dossier miroir NTFS" {
  New-Item -ItemType Directory -Path $mirrorPath -Force | Out-Null
}

Invoke-Step "Copie du projet Flutter vers NTFS" {
  & robocopy $sourcePath $mirrorPath /MIR /XD '.dart_tool' 'build' /NFL /NDL /NJH /NJS /NP | Out-Null
  $rc = $LASTEXITCODE
  if ($rc -gt 7) {
    throw "Robocopy a echoue avec code $rc"
  }
}

Push-Location $mirrorPath
try {
  # Guard against shell/profile flags that enable huge Dart VM IR dumps.
  Remove-Item Env:DART_VM_OPTIONS -ErrorAction SilentlyContinue
  Remove-Item Env:DART_FLAGS -ErrorAction SilentlyContinue
  
  # Use an isolated Pub cache outside of the mirrored folder.
  # This avoids relying on a potentially corrupted global cache.
  $pubCachePath = Join-Path (Split-Path -Parent $mirrorPath) 'pub_cache'
  $toolingPath = Join-Path (Split-Path -Parent $mirrorPath) 'tooling'
  New-Item -ItemType Directory -Path $pubCachePath -Force | Out-Null
  New-Item -ItemType Directory -Path $toolingPath -Force | Out-Null

  function Test-PubPluginPackageHealthy {
    Param(
      [string]$CachePath,
      [string]$PackageName
    )

    $hostedPath = Join-Path $CachePath 'hosted\pub.dev'
    if (-not (Test-Path $hostedPath)) {
      return $true
    }

    $candidates = Get-ChildItem -Path $hostedPath -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "$PackageName-*" }

    if (-not $candidates -or $candidates.Count -eq 0) {
      return $true
    }

    $selected = $candidates | Sort-Object Name -Descending | Select-Object -First 1
    $pubspecPath = Join-Path $selected.FullName 'pubspec.yaml'
    return (Test-Path $pubspecPath)
  }

  $criticalPluginPackages = @(
    'flutter_inappwebview_windows',
    'shared_preferences_windows',
    'url_launcher_windows'
  )

  $hasCorruptedPluginCache = $false
  foreach ($pluginPackage in $criticalPluginPackages) {
    if (-not (Test-PubPluginPackageHealthy -CachePath $pubCachePath -PackageName $pluginPackage)) {
      $hasCorruptedPluginCache = $true
      break
    }
  }

  if ($hasCorruptedPluginCache) {
    Write-Host "Cache Pub local corrompu detecte, purge automatique..." -ForegroundColor Yellow
    Remove-Item -Path $pubCachePath -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $pubCachePath -Force | Out-Null
  }

  function Ensure-NuGetCli {
    Param(
      [string]$DownloadDir
    )

    $existingNuget = Get-Command nuget -ErrorAction SilentlyContinue
    if ($existingNuget) {
      return $existingNuget.Source
    }

    $nugetExePath = Join-Path $DownloadDir 'nuget.exe'
    if (-not (Test-Path $nugetExePath)) {
      Write-Host "NuGet CLI absent, telechargement automatique..." -ForegroundColor Yellow
      Invoke-WebRequest -Uri 'https://dist.nuget.org/win-x86-commandline/latest/nuget.exe' -OutFile $nugetExePath
    }

    if (-not (Test-Path $nugetExePath)) {
      throw "Impossible de recuperer nuget.exe pour la build Windows Flutter"
    }

    if (-not ($env:PATH -split ';' | Where-Object { $_ -eq $DownloadDir })) {
      $env:PATH = "$DownloadDir;$env:PATH"
    }

    return $nugetExePath
  }

  $nugetPath = Ensure-NuGetCli -DownloadDir $toolingPath
  Write-Host "NuGet utilise: $nugetPath" -ForegroundColor DarkGray

  $env:PUB_CACHE = $pubCachePath

  Invoke-Step "flutter pub get (dans le miroir NTFS)" {
    flutter pub get
  }

  switch ($Mode) {
    'run' {
      Invoke-Step "flutter run -d windows" {
        flutter run -d windows
      }
    }
    'build-windows' {
      Invoke-Step "flutter build windows --release" {
        flutter build windows --release
      }
    }
    'build-apk' {
      Invoke-Step "flutter build apk --release" {
        flutter build apk --release
      }
    }
    'build-appbundle' {
      Invoke-Step "flutter build appbundle --release" {
        flutter build appbundle --release
      }
    }
  }
}
finally {
  Pop-Location
}

if ($Mode -ne 'run') {
  Invoke-Step "Rapatriement du dossier build vers le projet source" {
    $sourceBuild = Join-Path $sourcePath 'build'
    $mirrorBuild = Join-Path $mirrorPath 'build'

    if (Test-Path $mirrorBuild) {
      New-Item -ItemType Directory -Path $sourceBuild -Force | Out-Null
      & robocopy $mirrorBuild $sourceBuild /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
      $rc = $LASTEXITCODE
      if ($rc -gt 7) {
        throw "Robocopy build a echoue avec code $rc"
      }
    }
  }
}

Write-Host "`nContournement termine. Miroir utilise: $mirrorPath" -ForegroundColor Green
$global:LASTEXITCODE = 0
