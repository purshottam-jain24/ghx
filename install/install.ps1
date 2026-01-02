Write-Host "🚀 Installing GHX (by Purshottam Jain)..." -ForegroundColor Cyan

$InstallDir = "$HOME\.ghx\bin"
$Binary = "$InstallDir\ghx.exe"
$Repo = "purshottam-jain24/ghx"
$BaseUrl = "https://github.com/$Repo/releases/latest/download"
$BinaryName = "ghx-win.exe"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "⬇️ Downloading GHX binary..." -ForegroundColor Blue
Invoke-WebRequest "$BaseUrl/$BinaryName" -OutFile $Binary

Write-Host "✅ GHX installed successfully!" -ForegroundColor Green
Write-Host "🚀 Launching GHX..." -ForegroundColor Cyan

& $Binary
