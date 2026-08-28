using Server.Services;

namespace Server.Endpoints;

public static class FolderEndpoints
{
    public static void MapFolderEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/folders").WithTags("Folders");

        g.MapGet("", async (FolderService svc) => Results.Ok(await svc.ListAsync()));

        g.MapGet("/tree", async (FolderService svc) => Results.Ok(await svc.GetTreeAsync()));

        g.MapPost("", async (FolderService svc, CreateFolderReq req) =>
        {
            try
            {
                var normalizedParent = req.ParentId == "root" ? null : req.ParentId;
                var f = await svc.CreateAsync(req.Name, normalizedParent);
                return Results.Created($"/api/folders/{f.Id}", f);
            }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
            catch (InvalidOperationException ex) { return Results.Conflict(new { error = ex.Message }); }
        });

        g.MapPut("/{id}", async (FolderService svc, string id, RenameReq req) =>
        {
            try
            {
                var f = await svc.RenameAsync(id, req.Name);
                return Results.Ok(f);
            }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
            catch (InvalidOperationException ex) { return Results.Conflict(new { error = ex.Message }); }
        });

        g.MapDelete("/{id}", async (FolderService svc, string id) =>
        {
            try { await svc.DeleteAsync(id); return Results.NoContent(); }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
            catch (InvalidOperationException ex) { return Results.Conflict(new { error = ex.Message }); }
        });

        g.MapPut("/{id}/move", async (FolderService svc, string id, MoveReq req) =>
        {
            try
            {
                var target = req.TargetParentId == "root" ? null : req.TargetParentId;
                var f = await svc.MoveAsync(id, target);
                return Results.Ok(f);
            }
            catch (KeyNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return Results.BadRequest(new { error = ex.Message }); }
        });
    }

    public record CreateFolderReq(string Name, string? ParentId);
    public record RenameReq(string Name);
    public record MoveReq(string? TargetParentId);
}
