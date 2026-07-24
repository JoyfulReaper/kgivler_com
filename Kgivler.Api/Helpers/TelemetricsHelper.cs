/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

namespace Kgivler.Api.Helpers;

using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

internal static class TelemetricsHelper
{
    internal static string GetCpuUsage()
    {
        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                var output = ExecuteCommand("wmic", "cpu get loadpercentage /Value");
                var match = Regex.Match(output, @"LoadPercentage=(\d+)");

                if (match.Success)
                {
                    return $"{match.Groups[1].Value}%";
                }
                return "Metrics unavailable";
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                if (File.Exists("/proc/loadavg"))
                {
                    var loadLines = File.ReadAllText("/proc/loadavg").Split(' ');
                    if (loadLines.Length >= 3)
                    {
                        return $"Load: {loadLines[0]} {loadLines[1]} {loadLines[2]}";
                    }
                }
                return "Metrics unavailable";
            }

            return "Unsupported OS";
        }
        catch
        {
            return "CPU tracking error";
        }
    }

    internal static string GetStorageMetrics()
    {
        try
        {
            string rootDrive;

            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                rootDrive = "C:\\";
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                rootDrive = "/";
            }
            else
            {
                return "Unsupported OS";
            }

            var driveInfo = new DriveInfo(rootDrive);

            double totalSpaceGB = Math.Round((double)driveInfo.TotalSize / (1024 * 1024 * 1024), 1);
            double freeSpaceGB = Math.Round((double)driveInfo.AvailableFreeSpace / (1024 * 1024 * 1024), 1);
            double usedSpaceGB = totalSpaceGB - freeSpaceGB;

            return $"{usedSpaceGB}GB / {totalSpaceGB}GB ({Math.Round((usedSpaceGB / totalSpaceGB) * 100)}%)";
        }
        catch
        {
            return "Storage metrics unavailable";
        }
    }

    internal static string GetRamMetrics()
    {
        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                var output = ExecuteCommand("wmic", "OS get FreePhysicalMemory,TotalVisibleMemorySize /Value");

                var totalMatch = Regex.Match(output, @"TotalVisibleMemorySize=(\d+)");
                var freeMatch = Regex.Match(output, @"FreePhysicalMemory=(\d+)");

                if (totalMatch.Success && freeMatch.Success)
                {
                    double totalGB = Math.Round(double.Parse(totalMatch.Groups[1].Value) / (1024 * 1024), 1);
                    double freeKB = double.Parse(freeMatch.Groups[1].Value);
                    double totalKB = double.Parse(totalMatch.Groups[1].Value);
                    double usedGB = Math.Round((totalKB - freeKB) / (1024 * 1024), 1);

                    return $"{usedGB}GB / {totalGB}GB ({Math.Round((usedGB / totalGB) * 100)}%)";
                }
                return "Metrics unavailable";
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                var meminfo = File.ReadAllText("/proc/meminfo");
                var totalMatch = Regex.Match(meminfo, @"MemTotal:\s+(\d+)");
                var availableMatch = Regex.Match(meminfo, @"MemAvailable:\s+(\d+)");

                if (totalMatch.Success && availableMatch.Success)
                {
                    double totalGB = Math.Round(double.Parse(totalMatch.Groups[1].Value) / (1024 * 1024), 1);
                    double availableKB = double.Parse(availableMatch.Groups[1].Value);
                    double totalKB = double.Parse(totalMatch.Groups[1].Value);
                    double usedGB = Math.Round((totalKB - availableKB) / (1024 * 1024), 1);

                    return $"{usedGB}GB / {totalGB}GB ({Math.Round((usedGB / totalGB) * 100)}%)";
                }
                return "Metrics unavailable";
            }

            return "Unsupported OS";
        }
        catch
        {
            return "RAM tracking error";
        }
    }

    internal static object GetGpuMetrics()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && !RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            return new { Error = "Unsupported OS" };
        }

        try
        {
            var result = ExecuteCommand("nvidia-smi", "--query-gpu=name,memory.used,memory.total,utilization.gpu,utilization.memory --format=csv,noheader,nounits");
            if (string.IsNullOrWhiteSpace(result))
            {
                return new { Error = "GPU Sleeping or Driver Unavailable" };
            }

            var components = result.Split(',');
            if (components.Length >= 4)
            {
                return new
                {
                    Name = components[0].Trim(),
                    VramUsedMB = components[1].Trim(),
                    VramTotalMB = components[2].Trim(),
                    LoadPercentage = components[3].Trim()
                };
            }

            return new { Error = result.Trim() };
        }
        catch
        {
            return new { Error = "No discrete GPU detected" };
        }
    }

    internal static string GetStarDate()
    {
        var now = DateTime.UtcNow;
        double stardate = 41000 + (now.Year - 1987) * 1000 + (now.DayOfYear / (DateTime.IsLeapYear(now.Year) ? 366.0 : 365.0)) * 1000;
        return $"{stardate:F1}";
    }

    internal static string ExecuteCommand(string fileName, string arguments)
    {
        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process == null) return string.Empty;

            return process.StandardOutput.ReadToEnd();
        }
        catch
        {
            return string.Empty;
        }
    }
}