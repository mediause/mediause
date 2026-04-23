param(
  [string]$ManifestBaseUrl = "https://release.mediause.dev/cli",
  [string]$LatestUrl,
  [string]$InstallDir = "$env:USERPROFILE\.mediause\bin",
  [string]$BinaryName = "mediause",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Get-PlatformKey {
  $isWindows = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
    [System.Runtime.InteropServices.OSPlatform]::Windows
  )

  if (-not $isWindows) {
    throw "This installer only supports Windows."
  }

  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
  switch ($arch) {
    "arm64" { return "windows-arm64" }
    default { return "windows-x64" }
  }
}

function Resolve-Version {
  param([object]$LatestPayload)

  $version = $LatestPayload.version
  if (-not $version) { $version = $LatestPayload.latest }
  if (-not $version) { $version = $LatestPayload.tag_name }

  if (-not $version) {
    throw "latest.json missing version/latest/tag_name"
  }

  return ([string]$version).Trim().TrimStart("v")
}

function Normalize-Version {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }

  return $Value.Trim().TrimStart("v")
}

function Get-InstalledBinaryVersion {
  param([string]$BinaryPath)

  if (-not (Test-Path $BinaryPath)) {
    return $null
  }

  try {
    $jsonOutput = & $BinaryPath version --json 2>$null
    if ($LASTEXITCODE -eq 0 -and $jsonOutput) {
      $jsonText = ($jsonOutput | Out-String).Trim()
      try {
        $json = $jsonText | ConvertFrom-Json -ErrorAction Stop
        if ($json.version) {
          return Normalize-Version -Value ([string]$json.version)
        }
      } catch {
      }
    }
  } catch {
  }

  try {
    $plainOutput = & $BinaryPath --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $plainOutput) {
      $text = ($plainOutput | Out-String).Trim()
      if ($text -match "([0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z\.-]+)?)") {
        return Normalize-Version -Value $matches[1]
      }

      return Normalize-Version -Value $text
    }
  } catch {
  }

  return $null
}

function Resolve-Assets {
  param(
    [object]$LatestPayload,
    [string]$Version,
    [string]$ManifestBaseUrl
  )

  if ($LatestPayload.assets) {
    return $LatestPayload.assets
  }

  $manifestUrl = "{0}/{1}.json" -f $ManifestBaseUrl.TrimEnd("/"), $Version
  Write-Host "latest.json has no assets, loading manifest: $manifestUrl"
  $manifest = Invoke-RestMethod -Uri $manifestUrl

  if (-not $manifest.assets) {
    throw "Manifest ${manifestUrl} missing assets"
  }

  return $manifest.assets
}

function Resolve-AssetForPlatform {
  param(
    [object]$Assets,
    [string]$PlatformKey
  )

  $asset = $null

  if ($Assets.PSObject.Properties.Name -contains $PlatformKey) {
    $asset = $Assets.$PlatformKey
  }

  if (-not $asset -and $PlatformKey -eq "windows-x64" -and $Assets.windows -and $Assets.windows.x64) {
    $asset = $Assets.windows.x64
  }

  if (-not $asset -and $PlatformKey -eq "windows-arm64" -and $Assets.windows -and $Assets.windows.arm64) {
    $asset = $Assets.windows.arm64
  }

  if (-not $asset) {
    $known = ($Assets.PSObject.Properties.Name -join ", ")
    throw "No artifact found for platform '${PlatformKey}'. Known keys: ${known}"
  }

  if (-not $asset.url) {
    throw "Artifact for '${PlatformKey}' has no url field"
  }

  return $asset
}

try {
  $resolvedLatestUrl = if ([string]::IsNullOrWhiteSpace($LatestUrl)) {
    "{0}/latest.json" -f $ManifestBaseUrl.TrimEnd("/")
  } else {
    $LatestUrl
  }

  $platformKey = Get-PlatformKey
  Write-Host "Platform: $platformKey"
  Write-Host "Fetching latest release metadata: $resolvedLatestUrl"

  $latestPayload = Invoke-RestMethod -Uri $resolvedLatestUrl
  $version = Resolve-Version -LatestPayload $latestPayload
  $assets = Resolve-Assets -LatestPayload $latestPayload -Version $version -ManifestBaseUrl $ManifestBaseUrl
  $asset = Resolve-AssetForPlatform -Assets $assets -PlatformKey $platformKey

  $downloadUrl = [string]$asset.url
  $sha256 = if ($asset.sha256) { ([string]$asset.sha256).ToLowerInvariant() } else { "" }

  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

  $targetFile = Join-Path $InstallDir ("{0}.exe" -f $BinaryName)
  $shouldDownload = $true
  if ((Test-Path $targetFile) -and -not $Force) {
    $installedVersion = Get-InstalledBinaryVersion -BinaryPath $targetFile

    if ($installedVersion -and $installedVersion -eq $version) {
      $shouldDownload = $false
      Write-Host "Binary already exists: $targetFile"
      Write-Host "Local version matches latest ($version), skip download."
    } elseif ($installedVersion) {
      Write-Host "Binary already exists: $targetFile"
      Write-Host "Local version $installedVersion is older/different than latest $version, upgrading."
    } else {
      Write-Host "Binary already exists but current version could not be detected, downloading latest."
    }
  }

  $tmpFile = Join-Path $env:TEMP ("{0}-{1}.download" -f $BinaryName, [Guid]::NewGuid().ToString("N"))

  if ($shouldDownload) {
    Write-Host "Downloading CLI v$version from: $downloadUrl"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile

    if (-not [string]::IsNullOrWhiteSpace($sha256)) {
      $actualHash = (Get-FileHash -Path $tmpFile -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($actualHash -ne $sha256) {
        Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
        throw "SHA256 mismatch. expected=$sha256 actual=$actualHash"
      }
    } else {
      Write-Host "Warning: no sha256 in manifest, checksum verification skipped."
    }

    Move-Item -Path $tmpFile -Destination $targetFile -Force
  }

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not $userPath) {
    $userPath = ""
  }

  $segments = $userPath.Split(";", [System.StringSplitOptions]::RemoveEmptyEntries)
  $alreadyInPath = $false
  foreach ($segment in $segments) {
    if ($segment.TrimEnd("\\").ToLowerInvariant() -eq $InstallDir.TrimEnd("\\").ToLowerInvariant()) {
      $alreadyInPath = $true
      break
    }
  }

  if (-not $alreadyInPath) {
    $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $InstallDir } else { "$userPath;$InstallDir" }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Updated user PATH with: $InstallDir"

    if ([string]::IsNullOrWhiteSpace($env:Path)) {
      $env:Path = $InstallDir
    } elseif (-not (($env:Path.Split(";", [System.StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object { $_.TrimEnd("\\").ToLowerInvariant() }) -contains $InstallDir.TrimEnd("\\").ToLowerInvariant())) {
      $env:Path = "$env:Path;$InstallDir"
    }

    Write-Host "Updated current shell PATH with: $InstallDir"
  } else {
    if ([string]::IsNullOrWhiteSpace($env:Path)) {
      $env:Path = $InstallDir
      Write-Host "Updated current shell PATH with: $InstallDir"
    } elseif (-not (($env:Path.Split(";", [System.StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object { $_.TrimEnd("\\").ToLowerInvariant() }) -contains $InstallDir.TrimEnd("\\").ToLowerInvariant())) {
      $env:Path = "$env:Path;$InstallDir"
      Write-Host "Updated current shell PATH with: $InstallDir"
    }
  }

  Write-Host "Installed: $targetFile"
  Write-Host "Version: $version"
  Write-Host "Run in current shell: $BinaryName --version"
  Write-Host "If you started this script via a new powershell process, run in your parent shell instead: .\\agent-skills\\install.ps1"
  exit 0
} catch {
  Write-Error $_
  exit 1
}
