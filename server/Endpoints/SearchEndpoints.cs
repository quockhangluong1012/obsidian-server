using Server.Services;

namespace Server.Endpoints;

public static class SearchEndpoints
{
    public static void MapSearchEndpoints(this WebApplication app)
    {
        app.MapGet("/api/search", async (SearchService svc, string? q, int? limit) =>
        {
            if (string.IsNullOrWhiteSpace(q)) return Results.Ok(Array.Empty<object>());
            try
            {
                var res = await svc.SearchAsync(q!, limit ?? 20);
                if (res.Count == 0)
                {
                    // fallback to LIKE for folder names etc
                    res = await svc.SearchAllAsync(q!);
                }
                return Results.Ok(res);
            }
            catch (Exception)
            {
                // FTS syntax error fallback
                var res = await svc.SearchAllAsync(q!);
                return Results.Ok(res);
            }
        }).WithTags("Search");

        // Command palette compatible: /api/palette?q=
        app.MapGet("/api/palette", async (SearchService svc, FolderService folderSvc, NoteService noteSvc, string? q) =>
        {
            q = q?.Trim() ?? "";
            var searchRes = string.IsNullOrWhiteSpace(q)
                ? new List<object>()
                : await svc.SearchAsync(q, 20);
            // Also include folders
            var folders = await folderSvc.ListAsync();
            var folderMatches = folders.Where(f => string.IsNullOrWhiteSpace(q) || f.Name.Contains(q, StringComparison.OrdinalIgnoreCase))
                .Take(10).Select(f => new { id = f.Id, name = f.Name, kind = "folder", path = "" });
            return Results.Ok(folderMatches.Concat(searchRes.Take(10)));
        }).WithTags("Search");
    }
}
