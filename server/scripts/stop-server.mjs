import { execFileSync } from "node:child_process";

const port = process.env.PORT || "8001";

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function stopWindows() {
  const script = `
    $port = [int]${JSON.stringify(port)};
    $pids = New-Object System.Collections.Generic.HashSet[int];

    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { [void]$pids.Add([int]$_.OwningProcess) };

    Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -eq 'node.exe' -and
        $_.CommandLine -match 'nodemon' -and
        $_.CommandLine -match 'food-app-yt-main[\\\\/]server'
      } |
      ForEach-Object { [void]$pids.Add([int]$_.ProcessId) };

    if ($pids.Count -eq 0) {
      Write-Output 'No Food App backend process is running.';
      exit 0;
    }

    foreach ($pidToStop in $pids) {
      Write-Output "Stopping process $pidToStop...";
      Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue;
    }
    Write-Output 'Backend stopped.';
  `;

  try {
    const output = run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
    process.stdout.write(output);
  } catch (error) {
    console.error("Could not stop the backend process.");
    if (error.stderr) console.error(error.stderr.toString().trim());
    process.exitCode = 1;
  }
}

function stopPosix() {
  try {
    const output = run("lsof", ["-ti", `tcp:${port}`]).trim();
    if (!output) {
      console.log("No Food App backend process is running.");
      return;
    }

    for (const pid of output.split(/\s+/)) {
      console.log(`Stopping process ${pid}...`);
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch {
        // Process already exited.
      }
    }
    console.log("Backend stopped.");
  } catch {
    console.log("No Food App backend process is running.");
  }
}

if (process.platform === "win32") {
  stopWindows();
} else {
  stopPosix();
}
