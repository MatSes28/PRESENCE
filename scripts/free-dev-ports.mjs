import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const ports = (process.env.DEV_PORTS || "3000,5024,5025")
  .split(",")
  .map((port) => Number(port.trim()))
  .filter(Number.isFinite);

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
  .replace(/^\/([A-Za-z]:)/, "$1")
  .toLowerCase();

const shouldStopProcess = (commandLine = "") => {
  const normalized = commandLine.toLowerCase();
  return normalized.includes(repoRoot);
};

const stopWindowsPorts = () => {
  const script = `
$ErrorActionPreference = "SilentlyContinue"
$ports = @(${ports.join(",")})
$processIds = @()
foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    if ($connection.OwningProcess -and $processIds -notcontains $connection.OwningProcess) {
      $processIds += $connection.OwningProcess
    }
  }
}
foreach ($processId in $processIds) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  $commandLine = [string]$process.CommandLine
  Write-Output ($processId.ToString() + [char]9 + $commandLine)
}
exit 0
`;

  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ],
    { encoding: "utf8" },
  );
  if (result.error) {
    if (process.env.DEBUG_DEV_PORTS) {
      console.warn(`Port cleanup skipped: ${result.error.message}`);
    }
    return;
  }

  const output = result.stdout || "";
  if (result.status !== 0 && process.env.DEBUG_DEV_PORTS) {
    console.warn((result.stderr || "Port cleanup returned a nonzero status.").trim());
  }

  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [pidText, ...commandParts] = line.split("\t");
      const pid = Number(pidText);
      const commandLine = commandParts.join("\t");
      if (!Number.isFinite(pid) || !shouldStopProcess(commandLine)) return;

      try {
        process.kill(pid);
        console.log(`Freed dev port from PID ${pid}`);
      } catch (error) {
        console.warn(`Could not stop PID ${pid}: ${error.message}`);
      }
    });
};

const stopUnixPorts = () => {
  const devProcessPattern = /\b(node|npm|npx|tsx|vite)\b/i;

  ports.forEach((port) => {
    let output = "";
    try {
      output = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
        encoding: "utf8",
      });
    } catch {
      return;
    }

    output
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length > 1)
      .forEach(([command, pidText]) => {
        const pid = Number(pidText);
        if (!Number.isFinite(pid) || !devProcessPattern.test(command)) return;

        try {
          process.kill(pid);
          console.log(`Freed dev port ${port} from PID ${pid}`);
        } catch (error) {
          console.warn(`Could not stop PID ${pid}: ${error.message}`);
        }
      });
  });
};

if (ports.length === 0) {
  process.exit(0);
}

try {
  if (os.platform() === "win32") {
    stopWindowsPorts();
  } else {
    stopUnixPorts();
  }
} catch (error) {
  if (process.env.DEBUG_DEV_PORTS) {
    console.warn(`Port cleanup skipped: ${error.message}`);
  }
}
