Write-Host "🚀 Installing GHX (by Purshottam Jain)..." -ForegroundColor Cyan

$InstallDir = "$HOME\.ghx\bin"
$Binary = "$InstallDir\ghx.exe"
$Repo = "purshottam-jain24/ghx"
$BaseUrl = "https://github.com/$Repo/releases/latest/download"
# $BaseUrl = "http://192.168.1.8:8000/dist"
$BinaryName = "ghx-tool-win.exe"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "⬇️ Downloading GHX binary..." -ForegroundColor Blue
try {
    Import-Module BitsTransfer
    Start-BitsTransfer -Source "$BaseUrl/$BinaryName" -Destination $Binary
} catch {
    Write-Host "❌ Failed to download. Does the asset '$BinaryName' exist in the GitHub Release?" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    return
}

# Verify the download against the release's published SHA-256
try {
    $Expected = ((Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/$BinaryName.sha256").Content -split '\s+')[0].Trim().ToLower()
} catch {
    $Expected = $null
}
if ($Expected) {
    $Actual = (Get-FileHash -Algorithm SHA256 -Path $Binary).Hash.ToLower()
    if ($Actual -ne $Expected) {
        Remove-Item -Force $Binary
        Write-Host "❌ Checksum mismatch: the download may be corrupted or tampered with." -ForegroundColor Red
        Write-Host "   expected $Expected" -ForegroundColor Red
        Write-Host "   got      $Actual" -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        return
    }
    Write-Host "🔒 Checksum verified (SHA-256)." -ForegroundColor Green
} else {
    Write-Host "⚠️  No checksum published for this release; skipping verification." -ForegroundColor Yellow
}

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    Write-Host "🔧 Adding to User PATH..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
}

if ($env:Path -notlike "*$InstallDir*") {
    $env:Path += ";$InstallDir"
}

Write-Host "✅ GHX installed successfully!" -ForegroundColor Green
Write-Host "🚀 Launching GHX..." -ForegroundColor Cyan

try {
    & $Binary
} catch {
    Write-Host "⚠️  Could not auto-launch. Please type 'ghx' to start." -ForegroundColor Yellow
}
