using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ObsidianServer.Data;

namespace ObsidianServer.Features.Workspace;

public sealed partial class WorkspaceService(IDbContextFactory<ObsidianDbContext> databaseFactory)
{
    public async Task<IReadOnlyList<FolderSummary>> GetFoldersAsync(CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        return await database.Folders.AsNoTracking()
            .OrderBy(folder => folder.Name)
            .Select(folder => new FolderSummary(folder.Id, folder.Name, folder.ParentId))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<NoteSummary>> GetNotesAsync(Guid? folderId, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var query = database.Notes.AsNoTracking().AsQueryable();
        if (folderId is Guid selectedFolder)
            query = query.Where(note => note.FolderId == selectedFolder);

        return await query.OrderByDescending(note => note.UpdatedAt)
            .Select(note => new NoteSummary(note.Id, note.Title, note.FolderId, note.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<NoteDocument?> GetNoteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        return await database.Notes.AsNoTracking().Where(note => note.Id == id)
            .Select(note => new NoteDocument(note.Id, note.Title, note.FolderId, note.Content, note.UpdatedAt))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<NoteDocument> CreateNoteAsync(Guid? folderId, string title, CancellationToken cancellationToken = default)
    {
        var normalizedTitle = NormalizeRequired(title, 200, "Title");
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        if (folderId is Guid parent && !await database.Folders.AnyAsync(folder => folder.Id == parent, cancellationToken))
            throw new InvalidOperationException("Folder was not found.");

        var note = new Note { FolderId = folderId, Title = normalizedTitle, Content = "# " + normalizedTitle + Environment.NewLine };
        database.Notes.Add(note);
        await database.SaveChangesAsync(cancellationToken);
        return new NoteDocument(note.Id, note.Title, note.FolderId, note.Content, note.UpdatedAt);
    }

    public async Task<NoteDocument> DuplicateNoteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var source = await database.Notes.AsNoTracking().SingleOrDefaultAsync(note => note.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Note was not found.");

        var baseName = $"{source.Title} copy";
        var taken = await database.Notes.AsNoTracking()
            .Where(note => note.FolderId == source.FolderId)
            .Select(note => note.Title)
            .ToListAsync(cancellationToken);
        var takenSet = taken.ToHashSet(StringComparer.CurrentCultureIgnoreCase);
        var name = baseName;
        for (var suffix = 2; takenSet.Contains(name); suffix++) name = $"{baseName} {suffix}";

        var copy = new Note { FolderId = source.FolderId, Title = name, Content = source.Content };
        database.Notes.Add(copy);
        await database.SaveChangesAsync(cancellationToken);
        return new NoteDocument(copy.Id, copy.Title, copy.FolderId, copy.Content, copy.UpdatedAt);
    }

    public async Task SaveNoteAsync(Guid id, string title, string content, CancellationToken cancellationToken = default)
    {
        var normalizedTitle = NormalizeRequired(title, 200, "Title");
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var note = await database.Notes.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Note was not found.");
        note.Title = normalizedTitle;
        note.Content = content ?? string.Empty;
        note.UpdatedAt = DateTimeOffset.UtcNow;
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task MoveNoteAsync(Guid id, Guid? targetFolderId, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        if (targetFolderId is Guid target && !await database.Folders.AnyAsync(folder => folder.Id == target, cancellationToken))
            throw new InvalidOperationException("Target folder was not found.");

        var note = await database.Notes.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Note was not found.");
        note.FolderId = targetFolderId;
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteNoteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var note = await database.Notes.FindAsync([id], cancellationToken);
        if (note is null) return;
        database.Notes.Remove(note);
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task<FolderSummary> CreateFolderAsync(string name, Guid? parentId, CancellationToken cancellationToken = default)
    {
        var normalizedName = NormalizeRequired(name, 160, "Folder name");
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        if (parentId is Guid parent && !await database.Folders.AnyAsync(folder => folder.Id == parent, cancellationToken))
            throw new InvalidOperationException("Parent folder was not found.");
        var folder = new Folder { Name = normalizedName, ParentId = parentId };
        database.Folders.Add(folder);
        await database.SaveChangesAsync(cancellationToken);
        return new FolderSummary(folder.Id, folder.Name, folder.ParentId);
    }

    public async Task RenameFolderAsync(Guid id, string name, CancellationToken cancellationToken = default)
    {
        var normalizedName = NormalizeRequired(name, 160, "Folder name");
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var folder = await database.Folders.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Folder was not found.");

        var clash = await database.Folders.AsNoTracking()
            .AnyAsync(item => item.Id != id && item.ParentId == folder.ParentId && item.Name.ToLower() == normalizedName.ToLower(), cancellationToken);
        if (clash) throw new InvalidOperationException("A folder with this name already exists here.");

        folder.Name = normalizedName;
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task MoveFolderAsync(Guid id, Guid? targetParentId, CancellationToken cancellationToken = default)
    {
        if (targetParentId == id) throw new InvalidOperationException("A folder cannot be moved into itself.");

        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var folders = await database.Folders.Select(folder => new { folder.Id, folder.ParentId }).ToListAsync(cancellationToken);
        var parentById = folders.ToDictionary(folder => folder.Id, folder => folder.ParentId);

        var walker = targetParentId;
        while (walker is Guid current)
        {
            if (current == id) throw new InvalidOperationException("A folder cannot be moved into one of its own subfolders.");
            walker = parentById.TryGetValue(current, out var next) ? next : null;
        }

        var folder = await database.Folders.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Folder was not found.");
        folder.ParentId = targetParentId;
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteFolderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var hasChildren = await database.Folders.AnyAsync(folder => folder.ParentId == id, cancellationToken)
            || await database.Notes.AnyAsync(note => note.FolderId == id, cancellationToken)
            || await database.Attachments.AnyAsync(attachment => attachment.FolderId == id, cancellationToken);
        if (hasChildren) throw new InvalidOperationException("Move or remove this folder's notes, files and folders first.");
        var folder = await database.Folders.FindAsync([id], cancellationToken);
        if (folder is null) return;
        database.Folders.Remove(folder);
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<NoteSummary>> SearchAsync(string searchTerm, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(searchTerm)) return [];
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        return await database.Notes.FromSqlInterpolated($"SELECT n.* FROM Notes n JOIN Notes_FTS f ON f.rowid = n.rowid WHERE Notes_FTS MATCH {searchTerm + "*"} ORDER BY rank")
            .AsNoTracking().Take(100)
            .Select(note => new NoteSummary(note.Id, note.Title, note.FolderId, note.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    /// <summary>Other notes whose content links to this one with an Obsidian-style <c>[[Title]]</c> reference.</summary>
    public async Task<IReadOnlyList<NoteSummary>> GetBacklinksAsync(Guid noteId, CancellationToken cancellationToken = default)
    {
        await using var database = await databaseFactory.CreateDbContextAsync(cancellationToken);
        var title = await database.Notes.AsNoTracking().Where(note => note.Id == noteId).Select(note => note.Title).SingleOrDefaultAsync(cancellationToken);
        if (title is null) return [];

        var needle = $"[[{title}]]";
        return await database.Notes.AsNoTracking()
            .Where(note => note.Id != noteId && note.Content.Contains(needle))
            .Select(note => new NoteSummary(note.Id, note.Title, note.FolderId, note.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    /// <summary>Hashtags (<c>#tag</c>) found in note content. Pure text scan — no database access.</summary>
    public static IReadOnlyList<string> ExtractTags(string content)
    {
        if (string.IsNullOrEmpty(content)) return [];
        var seen = new List<string>();
        foreach (Match match in TagPattern().Matches(content))
        {
            var tag = match.Value;
            if (!seen.Contains(tag, StringComparer.CurrentCultureIgnoreCase)) seen.Add(tag);
        }
        return seen;
    }

    [GeneratedRegex(@"(?<=^|\s)#[\p{L}\p{N}_-]{1,50}", RegexOptions.CultureInvariant)]
    private static partial Regex TagPattern();

    private static string NormalizeRequired(string value, int maximumLength, string field)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length == 0 || normalized.Length > maximumLength) throw new InvalidOperationException($"{field} must contain 1 to {maximumLength} characters.");
        return normalized;
    }
}

public sealed record FolderSummary(Guid Id, string Name, Guid? ParentId);
public sealed record NoteSummary(Guid Id, string Title, Guid? FolderId, DateTimeOffset UpdatedAt);
public sealed record NoteDocument(Guid Id, string Title, Guid? FolderId, string Content, DateTimeOffset UpdatedAt);
