/*
 * Random Steam Game
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Kgivler.Api.BackgroundServices;

public class SystemCpuMonitor : BackgroundService
{
    private static string _currentCpuUsage = "Initializing...";
    public static string CurrentCpuUsage => _currentCpuUsage;

    private PerformanceCounter? _windowsCounter;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Initialize the persistent Windows counter once if on Windows
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                _windowsCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                _windowsCounter.NextValue(); // First call clears the baseline 0% bug
            }
            catch
            {
                _currentCpuUsage = "Permissions required";
            }
        }

        // Linux tracking metrics
        long lastUser = 0, lastNice = 0, lastSys = 0, lastIdle = 0, lastIowait = 0, lastIrq = 0, lastSoftIrq = 0;

        // Continuous lightweight polling loop
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && _windowsCounter != null)
                {
                    _currentCpuUsage = $"{Math.Round(_windowsCounter.NextValue())}%";
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    if (File.Exists("/proc/stat"))
                    {
                        var lines = await File.ReadAllLinesAsync("/proc/stat", stoppingToken);
                        var cpuLine = lines.FirstOrDefault(l => l.StartsWith("cpu "));

                        if (cpuLine != null)
                        {
                            var parts = cpuLine.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                            if (parts.Length >= 8)
                            {
                                long user = long.Parse(parts[1]);
                                long nice = long.Parse(parts[2]);
                                long sys = long.Parse(parts[3]);
                                long idle = long.Parse(parts[4]);
                                long iowait = long.Parse(parts[5]);
                                long irq = long.Parse(parts[6]);
                                long softirq = long.Parse(parts[7]);

                                long totalDiff = (user + nice + sys + idle + iowait + irq + softirq) -
                                                 (lastUser + lastNice + lastSys + lastIdle + lastIowait + lastIrq + lastSoftIrq);
                                long idleDiff = (idle + iowait) - (lastIdle + lastIowait);

                                if (totalDiff > 0)
                                {
                                    double usage = 100.0 * (1.0 - ((double)idleDiff / totalDiff));
                                    _currentCpuUsage = $"{Math.Round(usage)}%";
                                }

                                lastUser = user; lastNice = nice; lastSys = sys; lastIdle = idle;
                                lastIowait = iowait; lastIrq = irq; lastSoftIrq = softirq;
                            }
                        }
                    }
                }
            }
            catch
            {
                _currentCpuUsage = "CPU tracking error";
            }

            await Task.Delay(2000, stoppingToken); // Poll every 2 seconds
        }
    }

    public override void Dispose()
    {
        _windowsCounter?.Dispose();
        base.Dispose();
    }
}