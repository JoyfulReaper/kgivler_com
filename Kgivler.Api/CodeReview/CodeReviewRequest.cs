/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

namespace Kgivler.Api.CodeReview;

public sealed record CodeReviewRequest(
    string Code,
    string? Language = null);

public sealed record CodeReviewResponse(
    string Review);