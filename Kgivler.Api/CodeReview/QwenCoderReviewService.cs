/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 * 
 * This class was created with the assistance of Codex :p
 */

using JoyfulReaperLib.MissionControl;
using Kgivler.Api.Events;
using System.Diagnostics;
using System.Text;

namespace Kgivler.Api.CodeReview;

public sealed class QwenCoderReviewService
{
    private const string DefaultModel = "qwen2.5-coder-3b-instruct@q6_k";
    private const int SinglePassMaxChars = 12_000;
    private const int ChunkedMaxChars = 48_000;
    private const int ChunkTargetChars = 5_500;
    private const int SinglePassMaxTokens = 800;
    private const int ChunkReviewMaxTokens = 550;
    private const int SynthesisMaxTokens = 650;
    private static readonly TimeSpan SinglePassTimeout = TimeSpan.FromSeconds(90);
    private static readonly TimeSpan ChunkReviewTimeout = TimeSpan.FromSeconds(45);
    private static readonly TimeSpan SynthesisTimeout = TimeSpan.FromSeconds(60);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<QwenCoderReviewService> _logger;
    private readonly IMissionControlClient _missionControlClient;

    public QwenCoderReviewService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IMissionControlClient missionControlClient,
        ILogger<QwenCoderReviewService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
        _missionControlClient = missionControlClient;
    }

    private static List<string> DetectReviewHints(string code)
    {
        var hints = new List<string>();

        if ((code.Contains(".substring(0, count)", StringComparison.Ordinal) ||
             code.Contains(".Substring(0, count)", StringComparison.Ordinal) ||
             code.Contains(".substring(0, length)", StringComparison.Ordinal) ||
             code.Contains(".Substring(0, length)", StringComparison.Ordinal)) &&
            !code.Contains("Math.Min", StringComparison.Ordinal) &&
            !code.Contains("Math.min", StringComparison.Ordinal))
        {
            hints.Add("Possible substring bounds bug: caller-provided count/length may exceed the string length.");
        }

        if (code.Contains("innerHTML", StringComparison.Ordinal))
            hints.Add("Possible unsafe DOM rendering: code contains innerHTML.");

        if (code.Contains("localStorage.setItem", StringComparison.Ordinal))
            hints.Add("Possible sensitive persistence: code stores data in localStorage.");

        if (code.Contains("console.log", StringComparison.Ordinal))
            hints.Add("Possible debug/user-data logging: code contains console.log.");

        if (code.Contains("response.json()", StringComparison.Ordinal) &&
            !code.Contains("response.ok", StringComparison.Ordinal))
            hints.Add("Possible missing fetch status check: response.json() appears without response.ok.");

        if (code.Contains("ReadAsStringAsync", StringComparison.Ordinal) &&
            !code.Contains("IsSuccessStatusCode", StringComparison.Ordinal))
            hints.Add("Possible missing HTTP status check: response body is read without IsSuccessStatusCode.");

        if (code.Contains("CommandText = $", StringComparison.Ordinal) ||
            code.Contains("CommandText = \"", StringComparison.Ordinal) && code.Contains(" + "))
            hints.Add("Possible SQL injection: SQL command text may be built with string interpolation/concatenation.");

        if ((code.Contains("SELECT", StringComparison.OrdinalIgnoreCase) ||
             code.Contains("DELETE", StringComparison.OrdinalIgnoreCase) ||
             code.Contains("INSERT", StringComparison.OrdinalIgnoreCase) ||
             code.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)) &&
            (code.Contains("$_GET", StringComparison.Ordinal) ||
             code.Contains("$\"", StringComparison.Ordinal) ||
             code.Contains("'$'", StringComparison.Ordinal) ||
             code.Contains(" + ", StringComparison.Ordinal)))
        {
            hints.Add("Possible SQL injection: SQL appears to be built with user-controlled values.");
        }

        if (code.Contains("Substring(", StringComparison.Ordinal) &&
            code.Contains("<=", StringComparison.Ordinal))
            hints.Add("Possible substring bounds bug: loop with <= and Substring may read past the end.");

        if (code.Contains("Authorization", StringComparison.Ordinal) &&
            code.Contains("Bearer", StringComparison.Ordinal))
            hints.Add("Possible hardcoded bearer token or auth header.");

        if (code.Contains("127.0.0.1", StringComparison.Ordinal) ||
            code.Contains("localhost", StringComparison.Ordinal))
            hints.Add("Possible hardcoded local service URL.");

        if (code.Contains("os.popen", StringComparison.Ordinal) ||
            code.Contains("subprocess", StringComparison.Ordinal))
        {
            hints.Add("Possible command injection: shell command execution is used.");
        }

        if ((code.Contains("request.args", StringComparison.Ordinal) ||
             code.Contains("request.GET", StringComparison.Ordinal) ||
             code.Contains("$_GET", StringComparison.Ordinal)) &&
            (code.Contains("os.popen", StringComparison.Ordinal) ||
             code.Contains("subprocess", StringComparison.Ordinal) ||
             code.Contains("exec(", StringComparison.Ordinal)))
        {
            hints.Add("Possible command injection: request input may flow into shell execution.");
        }

        if (code.Contains("$_GET", StringComparison.Ordinal) ||
            code.Contains("$_POST", StringComparison.Ordinal))
        {
            hints.Add("Possible unsanitized user input: PHP request data is used.");
        }

        if (code.Contains("echo", StringComparison.Ordinal) &&
            (code.Contains("$_GET", StringComparison.Ordinal) ||
             code.Contains("$row", StringComparison.Ordinal)))
        {
            hints.Add("Possible XSS: PHP output may include unsanitized user/database content.");
        }

        if (code.Contains("new mysqli", StringComparison.Ordinal) &&
            (code.Contains("\"root\"", StringComparison.Ordinal) ||
             code.Contains("\"password", StringComparison.Ordinal) ||
             code.Contains("password123", StringComparison.Ordinal)))
        {
            hints.Add("Possible hardcoded database credentials.");
        }

        if (code.Contains(".substring(", StringComparison.Ordinal) &&
            code.Contains("<=", StringComparison.Ordinal))
        {
            hints.Add("Possible substring bounds bug: loop with <= and substring may read past the end.");
        }

        if (code.Contains("File.ReadAllBytesAsync", StringComparison.Ordinal) &&
            (code.Contains("+ fileName", StringComparison.Ordinal) ||
             code.Contains("uploads/", StringComparison.Ordinal)))
        {
            hints.Add("Possible path traversal: user-controlled filename may be used to read files.");
        }

        if (code.Contains("http.Get(", StringComparison.Ordinal) &&
            code.Contains("_,", StringComparison.Ordinal))
        {
            hints.Add("Possible ignored HTTP error: Go code ignores the error returned by http.Get.");
        }

        if (code.Contains("fmt.Fprintf", StringComparison.Ordinal) &&
            code.Contains("%s", StringComparison.Ordinal) &&
            code.Contains("Query().Get", StringComparison.Ordinal))
        {
            hints.Add("Possible unsafe HTML output: request query value is written into the response.");
        }

        return hints;
    }

    public async Task<IResult> ReviewAsync(
    CodeReviewRequest request,
    CancellationToken cancellationToken)
    {
        var occurredAt = DateTimeOffset.UtcNow;
        var stopwatch = Stopwatch.StartNew();
        var correlationId = Guid.NewGuid().ToString("N");

        var code = request.Code?.Trim();
        var language = string.IsNullOrWhiteSpace(request.Language)
            ? null
            : request.Language.Trim();

        var model = _configuration["LmStudio:Model"] ?? DefaultModel;

        if (string.IsNullOrWhiteSpace(code))
        {
            await PublishCodeReviewEventAsync(
                language,
                codeLength: 0,
                reviewMode: "not-started",
                chunkCount: 0,
                reviewLength: 0,
                model,
                stopwatch,
                outcome: "validation-error",
                succeeded: false,
                occurredAt,
                correlationId);

            return Results.BadRequest(new
            {
                title = "Paste some code first."
            });
        }

        if (code.Length > ChunkedMaxChars)
        {
            await PublishCodeReviewEventAsync(
                language,
                code.Length,
                reviewMode: "not-started",
                chunkCount: 0,
                reviewLength: 0,
                model,
                stopwatch,
                outcome: "code-too-large",
                succeeded: false,
                occurredAt,
                correlationId);

            return Results.BadRequest(new
            {
                title = $"Code is too large. Keep it under {ChunkedMaxChars:N0} characters."
            });
        }

        var lmStudio = _httpClientFactory.CreateClient("LmStudio");

        if (code.Length <= SinglePassMaxChars)
        {
            var review = await ReviewSinglePassAsync(
                lmStudio,
                model,
                language,
                code,
                cancellationToken);

            if (string.IsNullOrWhiteSpace(review))
            {
                await PublishCodeReviewEventAsync(
                    language,
                    code.Length,
                    reviewMode: "single-pass",
                    chunkCount: 1,
                    reviewLength: 0,
                    model,
                    stopwatch,
                    outcome: "empty-review",
                    succeeded: false,
                    occurredAt,
                    correlationId);

                return Results.Problem(
                    title: "LM Studio returned an empty review.",
                    statusCode: StatusCodes.Status502BadGateway);
            }

            var finalReview = review.Trim();

            await PublishCodeReviewEventAsync(
                language,
                code.Length,
                reviewMode: "single-pass",
                chunkCount: 1,
                reviewLength: finalReview.Length,
                model,
                stopwatch,
                outcome: "served",
                succeeded: true,
                occurredAt,
                correlationId);

            return Results.Ok(new CodeReviewResponse(finalReview));
        }

        var chunks = SplitIntoChunks(code, ChunkTargetChars);
        var chunkReviews = new List<string>(chunks.Count);

        for (var i = 0; i < chunks.Count; i++)
        {
            var chunk = chunks[i];

            var review = await ReviewChunkAsync(
                lmStudio,
                model,
                language,
                chunk,
                i + 1,
                chunks.Count,
                cancellationToken);

            if (string.IsNullOrWhiteSpace(review))
            {
                await PublishCodeReviewEventAsync(
                    language,
                    code.Length,
                    reviewMode: "chunked",
                    chunkCount: chunks.Count,
                    reviewLength: 0,
                    model,
                    stopwatch,
                    outcome: "chunk-review-failed",
                    succeeded: false,
                    occurredAt,
                    correlationId);

                return Results.Problem(
                    title: $"LM Studio returned an empty review for chunk {i + 1}.",
                    statusCode: StatusCodes.Status502BadGateway);
            }

            chunkReviews.Add(review.Trim());
        }

        var synthesis = await SynthesizeChunkReviewsAsync(
            lmStudio,
            model,
            language,
            chunkReviews,
            cancellationToken);

        var synthesisSucceeded = !string.IsNullOrWhiteSpace(synthesis);

        var finalChunkedReview = synthesisSucceeded
            ? synthesis!.Trim()
            : string.Join("\n\n", chunkReviews);

        await PublishCodeReviewEventAsync(
            language,
            code.Length,
            reviewMode: "chunked",
            chunkCount: chunks.Count,
            reviewLength: finalChunkedReview.Length,
            model,
            stopwatch,
            outcome: synthesisSucceeded
                ? "served"
                : "served-without-synthesis",
            succeeded: true,
            occurredAt,
            correlationId);

        return Results.Ok(new CodeReviewResponse(finalChunkedReview));
    }

    private async Task PublishCodeReviewEventAsync(
        string? language,
        int codeLength,
        string reviewMode,
        int chunkCount,
        int reviewLength,
        string model,
        Stopwatch stopwatch,
        string outcome,
        bool succeeded,
        DateTimeOffset occurredAt,
        string correlationId)
    {
        stopwatch.Stop();

        try
        {
            await _missionControlClient.TryPublishAsync(
                eventType: KgivlerEventTypes.CodeReviewCompleted,
                payload: new CodeReviewCompletedEvent(
                    Language: language ?? "auto",
                    CodeLength: codeLength,
                    ReviewMode: reviewMode,
                    ChunkCount: chunkCount,
                    ReviewLength: reviewLength,
                    Model: model,
                    DurationMilliseconds: stopwatch.ElapsedMilliseconds,
                    Outcome: outcome,
                    Succeeded: succeeded),
                occurredAt: occurredAt,
                correlationId: correlationId,
                cancellationToken: CancellationToken.None);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Failed to publish code-review telemetry event {CorrelationId}.",
                correlationId);
        }
    }

    private async Task<string?> ReviewSinglePassAsync(
        HttpClient lmStudio,
        string model,
        string? language,
        string code,
        CancellationToken cancellationToken)
    {
        var messages = BuildSinglePassMessages(language, code);
        return await GetReviewAsync(
            lmStudio,
            model,
            messages,
            SinglePassMaxTokens,
            SinglePassTimeout,
            cancellationToken);
    }

    private async Task<string?> ReviewChunkAsync(
        HttpClient lmStudio,
        string model,
        string? language,
        CodeChunk chunk,
        int chunkNumber,
        int chunkCount,
        CancellationToken cancellationToken)
    {
        var messages = BuildChunkMessages(language, chunk, chunkNumber, chunkCount);
        return await GetReviewAsync(
            lmStudio,
            model,
            messages,
            ChunkReviewMaxTokens,
            ChunkReviewTimeout,
            cancellationToken);
    }

    private async Task<string?> SynthesizeChunkReviewsAsync(
        HttpClient lmStudio,
        string model,
        string? language,
        IReadOnlyList<string> chunkReviews,
        CancellationToken cancellationToken)
    {
        var messages = BuildSynthesisMessages(language, chunkReviews);
        return await GetReviewAsync(
            lmStudio,
            model,
            messages,
            SynthesisMaxTokens,
            SynthesisTimeout,
            cancellationToken);
    }

    private async Task<string?> GetReviewAsync(
        HttpClient lmStudio,
        string model,
        List<LmStudioMessage> messages,
        int maxTokens,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        var lmRequest = new LmStudioChatRequest
        {
            Model = model,
            Temperature = 0.0,
            MaxTokens = maxTokens,
            Stream = false,
            Messages = messages
        };

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);

        try
        {
            var response = await lmStudio.PostAsJsonAsync(
                "chat/completions",
                lmRequest,
                timeoutCts.Token);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(timeoutCts.Token);

                _logger.LogWarning(
                    "LM Studio returned {StatusCode}: {Error}",
                    response.StatusCode,
                    error);

                return null;
            }

            var lmResponse = await response.Content.ReadFromJsonAsync<LmStudioChatResponse>(
                cancellationToken: timeoutCts.Token);

            return lmResponse?
                .Choices?
                .FirstOrDefault()?
                .Message?
                .Content?
                .Trim();
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("QwenCoder review timed out after {Timeout}.", timeout);
            return null;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Could not reach LM Studio.");
            return null;
        }
    }

    private static List<LmStudioMessage> BuildSinglePassMessages(string? language, string code)
    {
        var numberedCode = NumberLines(code);

        var hints = DetectReviewHints(code);
        var detectedHints = hints.Count == 0
            ? "No static hints detected."
            : string.Join("\n", hints.Select(hint => $"- {hint}"));

        return
        [
            new LmStudioMessage
        {
            Role = "system",
            Content = """
            You are QwenCoder, a small best-effort code review assistant.

            This is a rough review, not a formal audit.
            Look for only obvious issues:
            - syntax mistakes
            - runtime bugs
            - missing null/empty checks
            - missing response/status checks
            - hardcoded keys, tokens, secrets, bearer tokens, or localhost URLs
            - unsafe HTML or DOM injection
            - logging user input or code
            - storing sensitive data in localStorage
            - simple best-practice mistakes that are easy to fix

            Static hints may be provided by a simple pre-scan.
            Treat static hints as leads to verify against the code.
            Do not blindly report a hint unless the code supports it.
            Do not say "No obvious issues found" if a static hint is clearly supported by the code.

            Keep it short and practical.
            Use bullet points.
            Use line numbers if you can.
            If nothing obvious stands out, say exactly: No obvious issues found.
            """
        },
        new LmStudioMessage
        {
            Role = "user",
            Content = $"""
            Language hint: {language ?? "auto"}

            Static hints from a simple pre-scan:
            {detectedHints}

            Use the hints as things to verify against the code.
            Do not blindly report a hint unless the code supports it.
            Do not say "No obvious issues found" if any hint is supported by the code.

            Review the code below for obvious issues only.

            ```text
            {numberedCode}
            ```
            """
        }
        ];
    }

    private static List<LmStudioMessage> BuildChunkMessages(
        string? language,
        CodeChunk chunk,
        int chunkNumber,
        int chunkCount)
    {
        var numberedChunk = NumberLines(chunk.Content, chunk.StartLine);

        var hints = DetectReviewHints(chunk.Content);
        var detectedHints = hints.Count == 0
            ? "No static hints detected."
            : string.Join("\n", hints.Select(hint => $"- {hint}"));

        return
        [
            new LmStudioMessage
        {
            Role = "system",
            Content = """
            You are reviewing one excerpt from a larger file.

            This is a rough pass.
            Look for only obvious issues:
            - syntax mistakes
            - runtime bugs
            - missing null/empty checks
            - missing response/status checks
            - hardcoded keys, tokens, secrets, bearer tokens, or localhost URLs
            - unsafe HTML or DOM injection
            - logging user input or code
            - storing sensitive data in localStorage
            - simple best-practice mistakes that are easy to fix

            Static hints may be provided by a simple pre-scan.
            Treat static hints as leads to verify against the excerpt.
            Do not blindly report a hint unless the excerpt supports it.
            Do not say "No obvious issues found" if a static hint is clearly supported by the excerpt.

            Keep it short and practical.
            Use bullet points.
            Use line numbers if you can.
            If nothing obvious stands out, say exactly: No obvious issues found.
            """
        },
        new LmStudioMessage
        {
            Role = "user",
            Content = $"""
            Language hint: {language ?? "auto"}
            Chunk: {chunkNumber} of {chunkCount}
            Lines: {chunk.StartLine}-{chunk.EndLine}

            Static hints from a simple pre-scan:
            {detectedHints}

            Use the hints as things to verify against this excerpt.
            Do not blindly report a hint unless the excerpt supports it.
            Do not say "No obvious issues found" if any hint is supported by the excerpt.

            Review this excerpt for obvious issues only.

            ```text
            {numberedChunk}
            ```
            """
        }
        ];
    }

    private static List<LmStudioMessage> BuildSynthesisMessages(
        string? language,
        IReadOnlyList<string> chunkReviews)
    {
        var joinedReviews = string.Join("\n\n", chunkReviews.Select(review => $"""
        ---
        {review}
        """));

        return
        [
            new LmStudioMessage
            {
                Role = "system",
                Content = """
                You are consolidating partial code review notes for one file.

                Merge duplicates and keep only obvious issues.
                Keep it short and practical.
                Use bullet points.
                If the notes do not contain any obvious issues, return exactly: No obvious issues found.
                """
            },
            new LmStudioMessage
            {
                Role = "user",
                Content = $"""
                Language hint: {language ?? "auto"}

                Consolidate these review notes into a single final review.
                Keep only the obvious findings.
                Remove duplicates.
                Keep the answer short.
                If the notes are empty or only contain generic advice, say exactly: No obvious issues found.

                {joinedReviews}

                Return the final answer as clean markdown with bullet points only.
                """
            }
        ];
    }

    private static string NumberLines(string text, int startLine = 1)
    {
        var lines = text.Replace("\r\n", "\n").Split('\n');
        var builder = new StringBuilder();

        for (var i = 0; i < lines.Length; i++)
        {
            if (i > 0)
            {
                builder.Append('\n');
            }

            builder.Append(startLine + i);
            builder.Append(" | ");
            builder.Append(lines[i]);
        }

        return builder.ToString();
    }

    private static List<CodeChunk> SplitIntoChunks(string code, int targetChars)
    {
        var chunks = new List<CodeChunk>();
        var lines = code.Replace("\r\n", "\n").Split('\n');
        var current = new StringBuilder();
        var startLine = 1;

        for (var i = 0; i < lines.Length; i++)
        {
            var line = lines[i];
            var lineWithNewline = line + "\n";

            if (current.Length > 0 && current.Length + lineWithNewline.Length > targetChars)
            {
                chunks.Add(new CodeChunk(startLine, i, current.ToString().TrimEnd('\r', '\n')));
                current.Clear();
                startLine = i + 1;
            }

            if (lineWithNewline.Length > targetChars)
            {
                var remaining = lineWithNewline.AsSpan();
                while (remaining.Length > 0)
                {
                    var sliceLength = Math.Min(targetChars, remaining.Length);
                    var slice = remaining[..sliceLength].ToString();
                    remaining = remaining[sliceLength..];

                    if (current.Length > 0)
                    {
                        chunks.Add(new CodeChunk(startLine, i, current.ToString().TrimEnd('\r', '\n')));
                        current.Clear();
                        startLine = i + 1;
                    }

                    chunks.Add(new CodeChunk(i + 1, i + 1, slice.TrimEnd('\r', '\n')));
                }

                continue;
            }

            current.Append(lineWithNewline);
        }

        if (current.Length > 0)
        {
            chunks.Add(new CodeChunk(startLine, lines.Length, current.ToString().TrimEnd('\r', '\n')));
        }

        return chunks;
    }

    private sealed record CodeChunk(int StartLine, int EndLine, string Content);
}
