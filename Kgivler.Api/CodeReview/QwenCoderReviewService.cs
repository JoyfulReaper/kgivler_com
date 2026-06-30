/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 * 
 * This class was created with the assistance of Codex :p
 */

using System.Text;

namespace Kgivler.Api.CodeReview;

public sealed class QwenCoderReviewService
{
    private const string DefaultModel = "qwen2.5-coder-3b-instruct@q6_k";
    private const int SinglePassMaxChars = 12_000;
    private const int ChunkedMaxChars = 48_000;
    private const int ChunkTargetChars = 5_500;
    private const int SinglePassMaxTokens = 1_500;
    private const int ChunkReviewMaxTokens = 700;
    private const int SynthesisMaxTokens = 1_200;
    private static readonly TimeSpan SinglePassTimeout = TimeSpan.FromSeconds(90);
    private static readonly TimeSpan ChunkReviewTimeout = TimeSpan.FromSeconds(45);
    private static readonly TimeSpan SynthesisTimeout = TimeSpan.FromSeconds(60);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<QwenCoderReviewService> _logger;

    public QwenCoderReviewService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<QwenCoderReviewService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<IResult> ReviewAsync(
        CodeReviewRequest request,
        CancellationToken cancellationToken)
    {
        var code = request.Code?.Trim();

        if (string.IsNullOrWhiteSpace(code))
        {
            return Results.BadRequest(new { title = "Paste some code first." });
        }

        if (code.Length > ChunkedMaxChars)
        {
            return Results.BadRequest(new
            {
                title = $"Code is too large. Keep it under {ChunkedMaxChars:N0} characters."
            });
        }

        var model = _configuration["LmStudio:Model"] ?? DefaultModel;
        var lmStudio = _httpClientFactory.CreateClient("LmStudio");

        if (code.Length <= SinglePassMaxChars)
        {
            var review = await ReviewSinglePassAsync(
                lmStudio,
                model,
                request.Language,
                code,
                cancellationToken);

            return string.IsNullOrWhiteSpace(review)
                ? Results.Problem(
                    title: "LM Studio returned an empty review.",
                    statusCode: StatusCodes.Status502BadGateway)
                : Results.Ok(new CodeReviewResponse(review.Trim()));
        }

        var chunks = SplitIntoChunks(code, ChunkTargetChars);
        var chunkReviews = new List<string>(chunks.Count);

        for (var i = 0; i < chunks.Count; i++)
        {
            var chunk = chunks[i];
            var review = await ReviewChunkAsync(
                lmStudio,
                model,
                request.Language,
                chunk,
                i + 1,
                chunks.Count,
                cancellationToken);

            if (string.IsNullOrWhiteSpace(review))
            {
                return Results.Problem(
                    title: $"LM Studio returned an empty review for chunk {i + 1}.",
                    statusCode: StatusCodes.Status502BadGateway);
            }

            chunkReviews.Add($"""
            Chunk {i + 1}/{chunks.Count} (lines {chunk.StartLine}-{chunk.EndLine}):
            {review.Trim()}
            """);
        }

        var synthesis = await SynthesizeChunkReviewsAsync(
            lmStudio,
            model,
            request.Language,
            chunkReviews,
            cancellationToken);

        var finalReview = string.IsNullOrWhiteSpace(synthesis)
            ? string.Join("\n\n", chunkReviews)
            : synthesis.Trim();

        return Results.Ok(new CodeReviewResponse(finalReview));
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
            Temperature = 0.15,
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
        return
        [
            new LmStudioMessage
            {
                Role = "system",
                Content = """
                You are QwenCoder running a concise code review for Kyle's personal website.

                Review the code like a practical senior C#, JavaScript, and web developer.

                Focus on:
                - actual bugs
                - security problems
                - performance problems
                - error handling
                - readability
                - concrete fixes

                Do not rewrite the entire file.
                Use short headings and bullet points.
                When you suggest a fix, include only the smallest relevant code snippet or diff hunk.
                Prefer 1 to 5 lines per snippet.
                Never paste a full file or a full function unless it is already tiny.
                Keep the response tight and stop after the highest-value findings.
                """
            },
            new LmStudioMessage
            {
                Role = "user",
                Content = $"""
                Language hint: {language ?? "auto"}

                Review this code and return concise findings with small code snippets only:

                ```text
                {code}
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
        return
        [
            new LmStudioMessage
            {
                Role = "system",
                Content = """
                You are reviewing one chunk of a larger code file.

                Focus only on issues that are visible in this excerpt.
                Be concise and practical.
                Use short headings and bullet points.
                When suggesting a fix, quote only the relevant lines as a tiny snippet or diff hunk.
                Never restate the whole chunk.
                """
            },
            new LmStudioMessage
            {
                Role = "user",
                Content = $"""
                Language hint: {language ?? "auto"}
                Chunk: {chunkNumber} of {chunkCount}
                Lines: {chunk.StartLine}-{chunk.EndLine}

                Review this chunk and answer with only the most important findings and tiny code snippets:

                ```text
                {chunk.Content}
                ```

                If you need more room, prioritize the highest-impact issues over minor style notes.
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

                Merge duplicates, keep the most important findings, and organize the final answer by severity.
                Keep it concise and actionable.
                Use tiny code snippets only when they clarify the fix.
                Do not paste entire files, large functions, or long blocks of code.
                Do not mention that the notes came from chunks.
                """
            },
            new LmStudioMessage
            {
                Role = "user",
                Content = $"""
                Language hint: {language ?? "auto"}

                Consolidate these review notes into a single final review.
                Use short bullets and tiny code snippets only where needed.
                Do not include long code blocks or full-file rewrites.

                {joinedReviews}

                Keep the final response tight, but complete enough that it does not trail off mid-thought.
                """
            }
        ];
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
