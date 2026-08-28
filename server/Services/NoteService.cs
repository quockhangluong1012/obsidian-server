using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

public class NoteService(AppDbContext db)
{
    public async Task<List<Note>> ListAsync(string? folderId)
    {
        var q = db.Notes.AsNoTracking().AsQueryable();
        if (folderId != null) q = q.Where(x => x.FolderId == folderId);
        var notes = await q.OrderByDescending(x => x.UpdatedAt).ToListAsync();
        return await ResolveLegacyAttachmentUrlsAsync(notes);
    }

    public async Task<Note?> GetAsync(string id)
    {
        var note = await db.Notes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return note == null ? null : (await ResolveLegacyAttachmentUrlsAsync([note]))[0];
    }

    public async Task<Note> CreateAsync(string title, string? folderId, string content)
    {
        title = string.IsNullOrWhiteSpace(title) ? "Không có tiêu đề" : title.Trim();
        if (folderId != null && !await db.Folders.AnyAsync(x => x.Id == folderId))
            throw new ArgumentException("Folder not found");
        var n = new Note
        {
            Title = title,
            FolderId = folderId,
            Content = await ResolveLegacyAttachmentUrlsAsync(content ?? string.Empty)
        };
        db.Notes.Add(n);
        await db.SaveChangesAsync();
        return n;
    }

    public async Task<Note> UpdateAsync(string id, string? title, string? content)
    {
        var n = await db.Notes.FindAsync(id) ?? throw new KeyNotFoundException("Note not found");
        if (title != null) n.Title = string.IsNullOrWhiteSpace(title) ? n.Title : title.Trim();
        if (content != null) n.Content = await ResolveLegacyAttachmentUrlsAsync(content);
        n.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return n;
    }

    public async Task DeleteAsync(string id)
    {
        var n = await db.Notes.FindAsync(id) ?? throw new KeyNotFoundException("Note not found");
        db.Notes.Remove(n);
        await db.SaveChangesAsync();
    }

    public async Task<Note> MoveAsync(string id, string? targetFolderId)
    {
        var n = await db.Notes.FindAsync(id) ?? throw new KeyNotFoundException("Note not found");
        if (targetFolderId != null && !await db.Folders.AnyAsync(x => x.Id == targetFolderId))
            throw new ArgumentException("Target folder not found");
        n.FolderId = targetFolderId;
        n.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return n;
    }

    public async Task<Note> DuplicateAsync(string id)
    {
        var n = await db.Notes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Note not found");
        var copy = new Note
        {
            Title = n.Title + " (copy)",
            FolderId = n.FolderId,
            Content = await ResolveLegacyAttachmentUrlsAsync(n.Content)
        };
        db.Notes.Add(copy);
        await db.SaveChangesAsync();
        return copy;
    }

    private async Task<List<Note>> ResolveLegacyAttachmentUrlsAsync(List<Note> notes)
    {
        if (!notes.Any(note => ContainsLegacyBlobUrl(note.Content))) return notes;

        var replacements = await LoadLegacyAttachmentUrlReplacementsAsync();
        foreach (var note in notes) note.Content = ReplaceLegacyAttachmentUrls(note.Content, replacements);
        return notes;
    }

    private async Task<string> ResolveLegacyAttachmentUrlsAsync(string content)
    {
        if (!ContainsLegacyBlobUrl(content)) return content;
        return ReplaceLegacyAttachmentUrls(content, await LoadLegacyAttachmentUrlReplacementsAsync());
    }

    private Task<Dictionary<string, string>> LoadLegacyAttachmentUrlReplacementsAsync()
    {
        return db.Attachments.AsNoTracking()
            .Where(attachment => attachment.Url.Contains(".blob.vercel-storage.com/"))
            .Select(attachment => new { attachment.Url, attachment.Id })
            .ToDictionaryAsync(attachment => attachment.Url, attachment => $"/api/files/{attachment.Id}");
    }

    private static bool ContainsLegacyBlobUrl(string content) =>
        content.Contains(".blob.vercel-storage.com/", StringComparison.OrdinalIgnoreCase);

    private static string ReplaceLegacyAttachmentUrls(string content, IReadOnlyDictionary<string, string> replacements)
    {
        foreach (var (blobUrl, proxyUrl) in replacements)
            content = content.Replace(blobUrl, proxyUrl, StringComparison.Ordinal);

        return content;
    }
}
