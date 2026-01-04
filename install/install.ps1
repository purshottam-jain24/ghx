Write-Host "🚀 Installing GHX (by Purshottam Jain)..." -ForegroundColor Cyan

$InstallDir = "$HOME\.ghx\bin"
$Binary = "$InstallDir\ghx.exe"
$Repo = "purshottam-jain24/ghx"
$BaseUrl = "https://github.com/$Repo/releases/latest/download"
# $BaseUrl = "http://192.168.1.2:8000/dist"
$BinaryName = "ghx-tool-win.exe"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "⬇️ Downloading GHX binary..." -ForegroundColor Blue
try {
    Invoke-WebRequest "$BaseUrl/$BinaryName" -OutFile $Binary
} catch {
    Write-Host "❌ Failed to download. Does the asset '$BinaryName' exist in the GitHub Release?" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    return
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
