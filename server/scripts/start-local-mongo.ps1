# Starts a user-space single-node MongoDB replica set for local development.
# This does not require administrator rights and does not modify the MongoDB
# Windows service. Production should use MongoDB Atlas (or another replica set).
$ErrorActionPreference = "Stop"

$port = if ($env:LOCAL_MONGO_PORT) { [int]$env:LOCAL_MONGO_PORT } else { 27018 }
$replicaSet = "rs0"
$root = if ($env:LOCAL_MONGO_HOME) {
  $env:LOCAL_MONGO_HOME
} else {
  Join-Path $env:LOCALAPPDATA "food-app-mongodb"
}
$dataDir = Join-Path $root "data"
$logDir = Join-Path $root "log"
$logPath = Join-Path $logDir "mongod.log"

function Find-Mongod {
  if ($env:MONGOD_BINARY -and (Test-Path $env:MONGOD_BINARY)) {
    return $env:MONGOD_BINARY
  }

  $installRoot = "C:\Program Files\MongoDB\Server"
  if (Test-Path $installRoot) {
    $versions = Get-ChildItem $installRoot -Directory |
      Where-Object { Test-Path (Join-Path $_.FullName "bin\mongod.exe") } |
      Sort-Object Name -Descending
    if ($versions.Count -gt 0) {
      return (Join-Path $versions[0].FullName "bin\mongod.exe")
    }
  }

  $command = Get-Command mongod -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  return $null
}

function Test-Port {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return [bool]$connection
}

function Invoke-MongoShell {
  param([string]$Expression)
  $uri = "mongodb://127.0.0.1:$port/admin?directConnection=true"
  return (& mongosh $uri --quiet --eval $Expression 2>$null)
}

$mongosh = Get-Command mongosh -ErrorAction SilentlyContinue
if (-not $mongosh) {
  Write-Error "mongosh was not found. Install MongoDB Shell or add it to PATH."
  exit 1
}

if (-not (Test-Port $port)) {
  $mongod = Find-Mongod
  if (-not $mongod) {
    Write-Error "mongod.exe was not found. Install MongoDB Server or set MONGOD_BINARY."
    exit 1
  }

  New-Item -ItemType Directory -Force -Path $dataDir, $logDir | Out-Null

  Write-Host "Starting local MongoDB replica set on port $port..."
  $arguments = @(
    "--replSet", $replicaSet,
    "--port", "$port",
    "--dbpath", "`"$dataDir`"",
    "--bind_ip", "127.0.0.1",
    "--logpath", "`"$logPath`"",
    "--logappend"
  )
  Start-Process -FilePath $mongod -ArgumentList $arguments -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Port $port) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Write-Error "MongoDB did not start on port $port. See $logPath"
    exit 1
  }
}

$setName = (Invoke-MongoShell "try { const h = db.hello(); print(h.setName || '') } catch (e) { print('') }").Trim()
if ($setName -ne $replicaSet) {
  Write-Host "Initializing replica set '$replicaSet'..."
  Invoke-MongoShell "try { rs.status() } catch (e) { rs.initiate({_id: '$replicaSet', members: [{_id: 0, host: '127.0.0.1:$port'}]}) }" | Out-Null
}

$primary = $false
for ($i = 0; $i -lt 30; $i++) {
  $state = (Invoke-MongoShell "try { const h = db.hello(); print(h.isWritablePrimary ? 'primary' : '') } catch (e) { print('') }").Trim()
  if ($state -eq "primary") {
    $primary = $true
    break
  }
  Start-Sleep -Milliseconds 500
}

if (-not $primary) {
  Write-Error "MongoDB is running on port $port but did not become primary. See $logPath"
  exit 1
}

Write-Host "MongoDB ready: mongodb://127.0.0.1:$port/suman_food?replicaSet=$replicaSet"
