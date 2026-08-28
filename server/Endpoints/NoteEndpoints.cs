using Server.Services;

namespace Server.Endpoints;

public static class NoteEndpoints
{
    public static void MapNoteEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/notes").WithTags("Notes");

        g.MapGet("", async (NoteService svc, string? folderId) =>
        {
            var normalized = folderId == "root" ? null : folderId;
            return Results.Ok(await svc.ListAsync(normalized));
        });

        g.MapGet("/{id}", async (NoteService svc, string id) =>
        {
            var n = await svc.GetAsync(id);
            return n == null ? Results.NotFound(new { error = "Note not found" }) : Results.Ok(n);
        });

        g.MapPost("", async (NoteService svc, CreateNoteReq req) =>
        {
            try
            {
                var folderId = req.FolderId == "root" ? null : req.FolderId;
                var n = await svc.CreateAsync(req.Title, folderId, req.Content ?? "");
                return Results.Created($"/api/notes/{n.Id}", n);
            }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        g.MapPut("/{id}", async (NoteService svc, string id, UpdateNoteReq req) =>
        {
            try
            {
                var n = await svc.UpdateAsync(id, req.Title, req.Content);
                return Results.Ok(n);
            }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        });

        g.MapDelete("/{id}", async (NoteService svc, string id) =>
        {
            try { await svc.DeleteAsync(id); return Results.NoContent(); }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        });

        g.MapPut("/{id}/move", async (NoteService svc, string id, MoveNoteReq req) =>
        {
            try
            {
                var target = req.TargetFolderId == "root" ? null : req.TargetFolderId;
                var n = await svc.MoveAsync(id, target);
                return Results.Ok(n);
            }
            catch (Exception ex) when (ex is KeyNotFoundException) { return Results.NotFound(new { error = ex.Message }); }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        g.MapPost("/{id}/duplicate", async (NoteService svc, string id) =>
        {
            try { var n = await svc.DuplicateAsync(id); return Results.Created($"/api/notes/{n.Id}", n); }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        });

        g.MapGet("/{id}/export", async (NoteService svc, string id) =>
        {
            var n = await svc.GetAsync(id);
            if (n == null) return Results.NotFound();
            var bytes = System.Text.Encoding.UTF8.GetBytes(n.Content ?? "");
            return Results.File(bytes, "text/markdown", $"{n.Title}.md");
        });
    }

    public record CreateNoteReq(string Title, string? FolderId, string? Content);
    public record UpdateNoteReq(string? Title, string? Content);
    public record MoveNoteReq(string? TargetFolderId);
}
