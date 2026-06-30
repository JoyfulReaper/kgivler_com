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
    private const int SinglePassMaxTokens = 800;
    private const int ChunkReviewMaxTokens = 550;
    private const int SynthesisMaxTokens = 650;
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

            chunkReviews.Add(review.Trim());
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

                Secrets are high priority:
                - Always flag hardcoded tokens, API keys, passwords, bearer tokens, auth headers, or obvious secret strings.
                - Always flag localhost service URLs or local API endpoints if they look like production code.
                - If you see an Authorization header built from a hardcoded token, call that out.
                - If you see a string that looks like SUPER_SECRET_ADMIN_TOKEN or similar, flag it as a secret.

                Example findings:
                - L2-L2: hardcoded bearer token is in source code.
                  Fix: move the token to an environment variable or secret store.
                - L3-L3: localhost API URL is hardcoded in the client.
                  Fix: read the base URL from config instead.
                - L9-L9: innerHTML is used with untrusted model output.
                  Fix: use textContent or sanitize the HTML first.
                - L6-L10: response.json() is called without checking response.ok.
                  Fix: check response.ok before parsing the body.

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

                Review the code below for obvious issues only.
                Mention only the most obvious problems.
                Secrets and localhost URLs should be called out if you see them.
                Use line numbers if possible.
                If nothing obvious stands out, say exactly: No obvious issues found.

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

                Secrets are high priority:
                - Always flag hardcoded tokens, API keys, passwords, bearer tokens, auth headers, or obvious secret strings.
                - Always flag localhost service URLs or local API endpoints if they look like production code.
                - If you see an Authorization header built from a hardcoded token, call that out.
                - If you see a string that looks like SUPER_SECRET_ADMIN_TOKEN or similar, flag it as a secret.

                Example findings:
                - L2-L2: hardcoded API key is visible in the code.
                  Fix: load it from config instead of source.
                - L3-L3: localhost API URL is hardcoded in the client.
                  Fix: read the base URL from config instead.
                - L7-L7: localStorage is used for sensitive data.
                  Fix: avoid storing secrets in localStorage.
                - L12-L14: fetch response is parsed without checking response.ok.
                  Fix: guard the parse behind a success check.

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

                Review this excerpt for obvious issues only.
                Mention only the most obvious problems.
                Secrets and localhost URLs should be called out if you see them.
                Use line numbers if possible.
                If nothing obvious stands out, say exactly: No obvious issues found.

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
