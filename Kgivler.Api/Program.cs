/*
 * Random Steam Game
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("MainSiteCorsPolicy", policy =>
    {
        var allowedOrigins = new List<string>
        {
            "https://kgivler.com",
            "https://www.kgivler.com"
        };

        // Append local development tools if running locally
        if (builder.Environment.IsDevelopment())
        {
            allowedOrigins.Add("http://localhost:5500");   // VS Code Live Server default
            allowedOrigins.Add("http://127.0.0.1:5500");   // Alternate Live Server loopback
            allowedOrigins.Add("http://localhost:3000");   // Typical Vite/React dev server port
        }

        policy.WithOrigins(allowedOrigins.ToArray())
              .WithMethods("GET", "POST")
              .WithHeaders("Content-Type", "Authorization");
    });
});

var app = builder.Build();
app.UseCors("MainSiteCorsPolicy");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Routes
long globalTrafficCounter = 0;
app.MapGet("/api/system/usage", async () =>
{
    long currentHits = Interlocked.Increment(ref globalTrafficCounter);

    var currentProcess = Process.GetCurrentProcess();
    var uptimeSpan = TimeSpan.FromMilliseconds(Environment.TickCount64);

    var storage = GetStorageMetrics();
    var ram = GetRamMetrics();
    var gpu = GetGpuMetrics();
    var cpuUsage = GetCpuUsage();
    var stardate = GetStarDate();
    var weather = await GetLocalWeather();

    var telemetry = new
    {
        OS = RuntimeInformation.OSDescription,
        Architecture = RuntimeInformation.OSArchitecture.ToString(),
        Framework = RuntimeInformation.FrameworkDescription,
        Uptime = $"{uptimeSpan.Days}d {uptimeSpan.Hours}h {uptimeSpan.Minutes}m",
        AppMemoryUsageMB = currentProcess.WorkingSet64 / (1024 * 1024),
        CpuTimeSec = Math.Round(currentProcess.TotalProcessorTime.TotalSeconds, 2),

        // Core Performance Metrics
        CpuUsage = cpuUsage,
        CpuCores = Environment.ProcessorCount,
        ProcessCount = Process.GetProcesses().Length,
        Storage = storage,
        RAM = ram,
        GPU = gpu,

        // Meta Metrics
        Stardate = stardate,
        Weather = weather,
        TotalRequestsHandled = currentHits
    };

    return Results.Ok(telemetry);
});

app.Run();


#region Telemetry Helper Methods 
// TODO move to a helper class or something

static string GetCpuUsage()
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

static string GetStorageMetrics()
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

static string GetRamMetrics()
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

static string GetGpuMetrics()
{
    // Ensure we are on a supported host platform before shelling out to nvidia-smi
    if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && !RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
    {
        return "Unsupported OS";
    }

    try
    {
        var result = ExecuteCommand("nvidia-smi", "--query-gpu=name,utilization.gpu,utilization.memory --format=csv,noheader,nounits");
        if (string.IsNullOrWhiteSpace(result))
        {
            return "GPU Sleeping or Driver Unavailable";
        }

        var components = result.Split(',');
        if (components.Length >= 3)
        {
            return $"{components[0].Trim()} (Load: {components[1].Trim()}% VRAM: {components[2].Trim()}%)";
        }

        return result.Trim();
    }
    catch
    {
        return "No discrete GPU detected";
    }
}

static string GetStarDate()
{
    var now = DateTime.UtcNow;
    double stardate = 41000 + (now.Year - 1987) * 1000 + (now.DayOfYear / (DateTime.IsLeapYear(now.Year) ? 366.0 : 365.0)) * 1000;
    return $"{stardate:F1}";
}

static async Task<string> GetLocalWeather()
{
    try
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd("curl");
        var weather = await client.GetStringAsync("https://wttr.in?format=3");
        return weather.Trim();
    }
    catch
    {
        return "Weather data offline";
    }
}

static string ExecuteCommand(string fileName, string arguments)
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

#endregion