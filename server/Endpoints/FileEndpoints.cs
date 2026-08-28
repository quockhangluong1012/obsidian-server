using Server.Services;

namespace Server.Endpoints;

public static class FileEndpoints
{
    public static void MapFileEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api").WithTags("Files");

        // List attachments (for tree)
        g.MapGet("/attachments", async (AttachmentService svc, string? folderId) =>
        {
            var normalized = folderId == "root" ? null : folderId;
            // if no folderId filter, return all? For tree we need all, but keep optional
            var list = await svc.ListAsync(null);
            if (normalized != null) list = list.Where(x => x.FolderId == normalized).ToList();
            return Results.Ok(list.Select(a => new
            {
                a.Id,
                a.FileName,
                a.ContentType,
                a.Size,
                a.FolderId,
                a.NoteId,
                a.CreatedAt,
                url = $"/api/files/{a.Id}",
                path = $"/api/files/{a.Id}"
            }));
        });

        g.MapGet("/files/{id}", async Task<IResult> (AttachmentService svc, string id, HttpContext ctx) =>
        {
            var a = await svc.GetAsync(id);
            if (a == null) return TypedResults.NotFound(new { error = "File not found" });
            var abs = svc.GetAbsolutePath(a);
            if (!File.Exists(abs)) return TypedResults.NotFound(new { error = "File missing on disk" });
            ctx.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            return TypedResults.PhysicalFile(abs, contentType: a.ContentType, enableRangeProcessing: true);
        });

        g.MapGet("/files/{id}/meta", async Task<IResult> (AttachmentService svc, string id) =>
        {
            var a = await svc.GetAsync(id);
            if (a == null) return TypedResults.NotFound(new { error = "File not found" });
            return TypedResults.Ok(new
            {
                a.Id,
                a.FileName,
                a.ContentType,
                a.Size,
                a.FolderId,
                a.NoteId,
                a.CreatedAt,
                url = $"/api/files/{a.Id}",
                path = $"/api/files/{a.Id}",
                storagePath = a.StoragePath
            });
        });

        g.MapPost("/files", async (AttachmentService svc, HttpRequest req) =>
        {
            if (!req.HasFormContentType) return Results.BadRequest(new { error = "Expected multipart/form-data" });
            var form = await req.ReadFormAsync();
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file == null) return Results.BadRequest(new { error = "Missing file field 'file'" });
            var noteId = form["noteId"].FirstOrDefault();
            var folderId = form["folderId"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(noteId)) noteId = null;
            if (string.IsNullOrWhiteSpace(folderId)) folderId = null;
            try
            {
                var a = await svc.SaveAsync(file, noteId, folderId);
                return Results.Created($"/api/files/{a.Id}", new
                {
                    a.Id,
                    a.FileName,
                    a.ContentType,
                    a.Size,
                    a.FolderId,
                    url = $"/api/files/{a.Id}",
                    path = $"/api/files/{a.Id}"
                });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).DisableAntiforgery();

        g.MapPut("/files/{id}/move", async (AttachmentService svc, string id, MoveFileReq req) =>
        {
            try
            {
                var a = await svc.MoveAsync(id, req.TargetFolderId);
                return Results.Ok(new
                {
                    a.Id,
                    a.FileName,
                    a.FolderId,
                    url = $"/api/files/{a.Id}",
                    path = $"/api/files/{a.Id}"
                });
            }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        g.MapDelete("/files/{id}", async (AttachmentService svc, string id) =>
        {
            try { await svc.DeleteAsync(id); return Results.NoContent(); }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
        });
    }

    public record MoveFileReq(string? TargetFolderId);
}
