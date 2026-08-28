using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ObsidianServer.Data;

namespace ObsidianServer.Features.Attachments;

public static class AttachmentEndpoints
{
    private const long MaximumFileSize = 10 * 1024 * 1024;
    private static readonly HashSet<string> AllowedContentTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

    public static IEndpointRouteBuilder MapAttachmentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/files");
        group.MapGet("/{id:guid}", GetAsync);
        group.MapPost("/", UploadAsync).DisableAntiforgery();
        return endpoints;
    }

    private static async Task<IResult> GetAsync(Guid id, IDbContextFactory<ObsidianDbContext> databaseFactory, CancellationToken cancellationToken)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var attachment = await database.Attachments.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return attachment is null
            ? Results.NotFound()
            : Results.File(attachment.Data, attachment.ContentType, enableRangeProcessing: false);
    }

    private static async Task<IResult> UploadAsync(IFormFile? file, [FromForm] Guid? folderId, [FromForm] Guid? noteId, IDbContextFactory<ObsidianDbContext> databaseFactory, CancellationToken cancellationToken)
    {
        if (file is null || file.Length is 0 || file.Length > MaximumFileSize || !AllowedContentTypes.Contains(file.ContentType))
            return Results.BadRequest(new { error = "Upload an image or SVG smaller than 10 MB." });

        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var resolvedFolderId = folderId;
        if (resolvedFolderId is null && noteId is Guid note)
            resolvedFolderId = await database.Notes.AsNoTracking().Where(item => item.Id == note).Select(item => item.FolderId).SingleOrDefaultAsync(cancellationToken);

        await using var stream = file.OpenReadStream();
        await using var buffer = new MemoryStream((int)file.Length);
        await stream.CopyToAsync(buffer, cancellationToken);
        var attachment = new Attachment
        {
            FileName = Path.GetFileName(file.FileName),
            ContentType = file.ContentType,
            Data = buffer.ToArray(),
            Size = file.Length,
            FolderId = resolvedFolderId,
            NoteId = noteId
        };

        database.Attachments.Add(attachment);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/files/{attachment.Id}", new { id = attachment.Id, url = $"/api/files/{attachment.Id}" });
    }
}
