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
        return await q.OrderByDescending(x => x.UpdatedAt).ToListAsync();
    }

    public Task<Note?> GetAsync(string id)
    {
        return db.Notes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
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
            Content = content ?? string.Empty
        };
        db.Notes.Add(n);
        await db.SaveChangesAsync();
        return n;
    }

    public async Task<Note> UpdateAsync(string id, string? title, string? content)
    {
        var n = await db.Notes.FindAsync(id) ?? throw new KeyNotFoundException("Note not found");
        if (title != null) n.Title = string.IsNullOrWhiteSpace(title) ? n.Title : title.Trim();
        if (content != null) n.Content = content;
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
            throw new ArgumentException("Folder not found");
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
            Content = n.Content
        };
        db.Notes.Add(copy);
        await db.SaveChangesAsync();
        return copy;
    }
}