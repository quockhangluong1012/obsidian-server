using Server.Services;

namespace Server.Endpoints;

public static class ReadingEndpoints
{
    public static void MapReadingEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/reading").WithTags("Reading");

        // Start tracking a note. The client calls this when a note becomes the active tab,
        // and End when it stops being active (switch note, hide tab, close app).
        g.MapPost("/sessions/start", async (ReadingTrackingService svc, StartReadingReq req) =>
        {
            try
            {
                var s = await svc.StartAsync(req.NoteId);
                return Results.Ok(new { id = s.Id, noteId = s.NoteId, startedAt = s.StartedAt });
            }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        });

        g.MapPost("/sessions/{id}/heartbeat", async (ReadingTrackingService svc, string id) =>
        {
            try
            {
                var s = await svc.HeartbeatAsync(id);
                return Results.Ok(new { id = s.Id, durationSeconds = s.DurationSeconds });
            }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        });

        // No request body: safe to call from navigator.sendBeacon on page unload.
        g.MapPost("/sessions/{id}/end", async (ReadingTrackingService svc, string id) =>
        {
            try
            {
                var s = await svc.EndAsync(id);
                return Results.Ok(new { id = s.Id, durationSeconds = s.DurationSeconds });
            }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        });

        // range: today | 7d | 30d | 1y | all. tz: IANA id (e.g. Asia/Ho_Chi_Minh) so "today"
        // and day/month buckets line up with the reader's local calendar, not UTC.
        g.MapGet("/summary", async (ReadingTrackingService svc, string? range, string? tz) =>
        {
            try { return Results.Ok(await svc.GetSummaryAsync(range ?? "today", tz)); }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        g.MapGet("/notes", async (ReadingTrackingService svc) => Results.Ok(await svc.GetNoteStatsAsync()));
    }

    public record StartReadingReq(string NoteId);
}
