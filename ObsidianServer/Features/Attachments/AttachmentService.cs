using Microsoft.EntityFrameworkCore;
using ObsidianServer.Data;

namespace ObsidianServer.Features.Attachments;

public sealed class AttachmentService(IDbContextFactory<ObsidianDbContext> databaseFactory)
{
    public const long MaximumFileSize = 10 * 1024 * 1024;
    private static readonly HashSet<string> AllowedContentTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

    public async Task<StoredAttachment> SaveAsync(string fileName, string contentType, Stream source, long size, Guid? folderId = null, Guid? noteId = null, CancellationToken cancellationToken = default)
    {
        if (size is <= 0 or > MaximumFileSize || !AllowedContentTypes.Contains(contentType))
            throw new InvalidOperationException("Upload an image or SVG smaller than 10 MB.");

        await using var buffer = new MemoryStream((int)size);
        await source.CopyToAsync(buffer, cancellationToken);
        var attachment = new Attachment { FileName = Path.GetFileName(fileName), ContentType = contentType, Data = buffer.ToArray(), Size = size, FolderId = folderId, NoteId = noteId };
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        database.Attachments.Add(attachment);
        await database.SaveChangesAsync(cancellationToken);
        return new StoredAttachment(attachment.Id, $"/api/files/{attachment.Id}");
    }

    public async Task<IReadOnlyList<AttachmentSummary>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        return await database.Attachments.AsNoTracking()
            .OrderBy(attachment => attachment.FileName)
            .Select(attachment => new AttachmentSummary(attachment.Id, attachment.FileName, attachment.ContentType, attachment.Size, attachment.FolderId, attachment.NoteId))
            .ToListAsync(cancellationToken);
    }

    public async Task MoveAsync(Guid id, Guid? folderId, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        if (folderId is Guid target && !await database.Folders.AnyAsync(folder => folder.Id == target, cancellationToken))
            throw new InvalidOperationException("Target folder was not found.");

        var attachment = await database.Attachments.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("File was not found.");
        attachment.FolderId = folderId;
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task RenameAsync(Guid id, string fileName, CancellationToken cancellationToken = default)
    {
        var normalized = fileName?.Trim() ?? string.Empty;
        if (normalized.Length == 0 || normalized.Length > 255) throw new InvalidOperationException("File name must contain 1 to 255 characters.");

        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var attachment = await database.Attachments.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("File was not found.");
        attachment.FileName = normalized;
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var attachment = await database.Attachments.FindAsync([id], cancellationToken);
        if (attachment is null) return;
        database.Attachments.Remove(attachment);
        await database.SaveChangesAsync(cancellationToken);
    }
}

public sealed record StoredAttachment(Guid Id, string Url);
public sealed record AttachmentSummary(Guid Id, string FileName, string ContentType, long Size, Guid? FolderId, Guid? NoteId);
