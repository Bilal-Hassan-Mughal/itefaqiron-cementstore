using System.Text.Json.Serialization;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SourceAFIS;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNameCaseInsensitive = true;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// Cloud hosts (Railway, Render, Fly.io) set PORT — bind all interfaces.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}
else if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls("http://127.0.0.1:5050");
}

var app = builder.Build();

var matcherApiKey = Environment.GetEnvironmentVariable("MATCHER_API_KEY");

app.Use(async (context, next) =>
{
    if (string.IsNullOrWhiteSpace(matcherApiKey) || context.Request.Path == "/health")
    {
        await next();
        return;
    }

    if (!context.Request.Headers.TryGetValue("X-Matcher-Key", out var provided) ||
        provided != matcherApiKey)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { error = "Unauthorized" });
        return;
    }

    await next();
});

app.MapGet("/health", () => Results.Ok(new { ok = true, matcher = "SourceAFIS", version = typeof(FingerprintTemplate).Assembly.GetName().Version?.ToString() }));

app.MapPost("/extract", (ExtractRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.PngBase64))
        return Results.BadRequest(new { error = "PngBase64 is required" });

    try
    {
        var template = ExtractTemplate(req.PngBase64);
        return Results.Ok(new ExtractResponse(Convert.ToBase64String(template.ToByteArray())));
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapPost("/match", (MatchRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.ProbePng))
        return Results.BadRequest(new { error = "ProbePng is required" });
    if (req.Candidates is null || req.Candidates.Count == 0)
        return Results.BadRequest(new { error = "Candidates are required" });

    try
    {
        var probe = ExtractTemplate(req.ProbePng);
        var matcher = new FingerprintMatcher(probe);

        double best = -1;
        int bestIndex = -1;
        var scores = new List<double>(req.Candidates.Count);

        for (int i = 0; i < req.Candidates.Count; i++)
        {
            try
            {
                var cand = new FingerprintTemplate(Convert.FromBase64String(req.Candidates[i]));
                double score = matcher.Match(cand);
                scores.Add(score);
                if (score > best)
                {
                    best = score;
                    bestIndex = i;
                }
            }
            catch
            {
                scores.Add(-1);
            }
        }

        return Results.Ok(new MatchResponse(bestIndex, best, scores));
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.Run();

static FingerprintTemplate ExtractTemplate(string pngBase64)
{
    byte[] pngBytes = Convert.FromBase64String(pngBase64);
    using var image = Image.Load<L8>(pngBytes);
    var pixels = new byte[image.Width * image.Height];
    image.CopyPixelDataTo(pixels);

    var fpImage = new FingerprintImage(
        image.Width,
        image.Height,
        pixels,
        new FingerprintImageOptions { Dpi = 500 }
    );
    return new FingerprintTemplate(fpImage);
}

record ExtractRequest(string PngBase64);
record ExtractResponse(string Template);
record MatchRequest(string ProbePng, List<string> Candidates);
record MatchResponse(int BestIndex, double BestScore, List<double> Scores);
