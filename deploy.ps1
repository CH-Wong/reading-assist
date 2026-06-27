<#
.SYNOPSIS
    Deploy Reading Assist to AWS via CDK (Infrastructure as Code).
.DESCRIPTION
    Builds the frontend and deploys the full stack (S3 + CloudFront + API proxy)
    to AWS. Requires Node.js and AWS credentials to be configured.

    Optional parameters for custom domain:
      .\deploy.ps1 -Domain "reading.example.com" -HostedZoneId "Z1234567890"
.PARAMETER Domain
    Optional custom domain name (e.g. "reading.example.com").
    Requires a Route 53 hosted zone for the apex domain.
.PARAMETER HostedZoneId
    Optional Route 53 hosted zone ID for the custom domain.
.PARAMETER Profile
    Optional AWS CLI profile name to use for deployment.
.PARAMETER Region
    Optional AWS region (default: us-east-1 - required for CloudFront).
.EXAMPLE
    .\deploy.ps1
    Deploy with the default CloudFront domain (no custom domain).

    .\deploy.ps1 -Domain "reading.example.com" -HostedZoneId "Z1234567890"
    Deploy with a custom domain and automatic DNS + SSL setup.
#>

param(
    [string]$Domain = "",
    [string]$HostedZoneId = "",
    [string]$Profile = "",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSCommandPath
$cdk = Join-Path $rootDir "cdk\node_modules\.bin\cdk.cmd"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Reading Assist - AWS Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# -- Load .env file if it exists (before fallback checks) --
$envFile = Join-Path $rootDir ".env"
if (Test-Path $envFile) {
    Write-Host "Loading .env file..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        # Skip comments and blank lines
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"', "'")
            if ($key -and $value) {
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
                Write-Host "  Loaded: $key" -ForegroundColor Gray
            }
        }
    }
    Write-Host "  Environment variables loaded from .env" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "No .env file found. Using existing environment variables." -ForegroundColor Yellow
    Write-Host "To use a .env file: copy .env.example to .env and fill in your values." -ForegroundColor Gray
    Write-Host ""
}

# Fall back to .env values if params weren't passed explicitly
if (-not $Domain) { $Domain = [Environment]::GetEnvironmentVariable("DOMAIN", "Process") }
if (-not $HostedZoneId) { $HostedZoneId = [Environment]::GetEnvironmentVariable("HOSTED_ZONE_ID", "Process") }

# -- Step 1: Build frontend --
Write-Host "Step 1/5: Building frontend..." -ForegroundColor Yellow
Push-Location $rootDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
} finally {
    Pop-Location
}
Write-Host "  Frontend built successfully" -ForegroundColor Green
Write-Host ""

# -- Step 2: Install CDK dependencies --
Write-Host "Step 2/5: Installing CDK dependencies..." -ForegroundColor Yellow
Push-Location (Join-Path $rootDir "cdk")
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "CDK dependency installation failed" }
} finally {
    Pop-Location
}
Write-Host "  CDK dependencies installed" -ForegroundColor Green
Write-Host ""

# -- Step 3: Compile CDK TypeScript --
Write-Host "Step 3/5: Compiling CDK TypeScript..." -ForegroundColor Yellow
Push-Location (Join-Path $rootDir "cdk")
try {
    & "npx.cmd" @("tsc")
    if ($LASTEXITCODE -ne 0) { throw "CDK TypeScript compilation failed" }
} finally {
    Pop-Location
}
Write-Host "  CDK TypeScript compiled" -ForegroundColor Green
Write-Host ""

# -- Step 4: Bootstrap CDK (if not already done) --
Write-Host "Step 4/5: Bootstrapping CDK (if needed)..." -ForegroundColor Yellow
$bootstrapArgs = @("bootstrap")
if ($Profile) { $bootstrapArgs += "--profile"; $bootstrapArgs += $Profile }
Push-Location (Join-Path $rootDir "cdk")
try {
    # Bootstrap both regions: the main region (from .env) and us-east-1 (for ACM certs)
    $regions = @($Region, "us-east-1") | Select-Object -Unique
    foreach ($r in $regions) {
        Write-Host "  Bootstrapping region $r..." -ForegroundColor Yellow
        $regionArgs = $bootstrapArgs + @("--region", $r)
        & $cdk @regionArgs
        if ($LASTEXITCODE -ne 0) { throw "CDK bootstrap failed for region $r" }
    }
} finally {
    Pop-Location
}
Write-Host "  CDK bootstrapped" -ForegroundColor Green
Write-Host ""

# -- Step 5: Deploy stack --
Write-Host "Step 5/5: Deploying stack..." -ForegroundColor Yellow
$deployArgs = @("deploy")
if ($Profile) { $deployArgs += "--profile"; $deployArgs += $Profile }
if ($Domain -and $HostedZoneId) {
    $deployArgs += "-c"; $deployArgs += "domain=$Domain"
    $deployArgs += "-c"; $deployArgs += "hostedZoneId=$HostedZoneId"
    Write-Host "  Using custom domain: $Domain" -ForegroundColor Cyan
} else {
    Write-Host "  Using default CloudFront domain (no custom domain)" -ForegroundColor Cyan
}
$deployArgs += "--all"
$deployArgs += "--require-approval"; $deployArgs += "broadening"

Push-Location (Join-Path $rootDir "cdk")
try {
    & $cdk @deployArgs
    if ($LASTEXITCODE -ne 0) { throw "CDK deploy failed" }
} finally {
    Pop-Location
}
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Deployment complete!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your CloudFront URL will be shown in the CDK output above." -ForegroundColor White
Write-Host "You can also view outputs by running:" -ForegroundColor White
Write-Host "  cd cdk; npx cdk deploy --outputs-file outputs.json" -ForegroundColor Gray
