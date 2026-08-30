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

// Default bind only when ASPNETCORE_URLS is not set (so you can move off 5050 if busy).
if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls("http://127.0.0.1:5050");
}

var app = builder.Build();

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
