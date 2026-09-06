using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

public class AttachmentService
{
    private static readonly HashSet<string> AllowedMime = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml",
        "application/json", "text/plain", "text/markdown", "text/csv"
    };

    private static readonly Regex ScriptTagRegex = new(@"<script[\s\S]*?</script>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex OnHandlerRegex = new(@"\son\w+\s*=\s*(""[^""]*""|'[^']*'|[^\s>]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly IAttachmentStorage _storage;

    public AttachmentService(AppDbContext db, IAttachmentStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    public IAttachmentStorage Storage => _storage;

    /// <summary>Attachments never sit as direct siblings of notes — they always live in an "assets" subfolder of their logical parent folder.</summary>
    private const string AssetsFolderName = "assets";

    /// <summary>Resolves (creating if needed) the "assets" subfolder under <paramref name="parentFolderId"/>. If <paramref name="parentFolderId"/> already IS an assets folder, returns it unchanged to avoid nesting assets/assets.</summary>
    private async Task<string> ResolveAssetFolderIdAsync(string? parentFolderId)
    {
        if (parentFolderId != null)
        {
            var parentName = await _db.Folders.AsNoTracking().Where(f => f.Id == parentFolderId).Select(f => f.Name).FirstOrDefaultAsync();
            if (parentName != null && string.Equals(parentName, AssetsFolderName, StringComparison.OrdinalIgnoreCase))
                return parentFolderId;
        }
        var existing = await _db.Folders.FirstOrDefaultAsync(f => f.ParentId == parentFolderId && f.Name.ToLower() == AssetsFolderName);
        if (existing != null) return existing.Id;
        var created = new Folder { Name = AssetsFolderName, ParentId = parentFolderId };
        _db.Folders.Add(created);
        await _db.SaveChangesAsync();
        return created.Id;
    }

    /// <summary>One-time (idempotent) fixup for attachments saved before assets-subfolder nesting existed: relocates any attachment sitting directly in a non-assets folder into that folder's "assets" subfolder. Safe to call on every startup — a no-op once every attachment already lives under an "assets" folder.</summary>
    public async Task NormalizeExistingAttachmentsAsync()
    {
        var folderIds = await _db.Attachments.Select(a => a.FolderId).Distinct().ToListAsync();
        var dirty = false;
        foreach (var fid in folderIds)
        {
            if (fid != null)
            {
                var name = await _db.Folders.AsNoTracking().Where(f => f.Id == fid).Select(f => f.Name).FirstOrDefaultAsync();
                if (name != null && string.Equals(name, AssetsFolderName, StringComparison.OrdinalIgnoreCase))
                    continue;
            }
            var assetsFolderId = await ResolveAssetFolderIdAsync(fid);
            var rows = await _db.Attachments.Where(a => a.FolderId == fid).ToListAsync();
            foreach (var a in rows) a.FolderId = assetsFolderId;
            dirty = dirty || rows.Count > 0;
        }
        if (dirty) await _db.SaveChangesAsync();
    }

    public Task<List<Attachment>> ListAsync(string? folderId)
    {
        var q = _db.Attachments.AsNoTracking().AsQueryable();
        if (folderId != null) q = q.Where(x => x.FolderId == folderId);
        return q.OrderByDescending(x => x.CreatedAt).ToListAsync();
    }

    public Task<List<Attachment>> ListByNoteAsync(string noteId)
    {
        return _db.Attachments.AsNoTracking()
            .Where(x => x.NoteId == noteId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }

    public Task<Attachment?> GetAsync(string id) => _db.Attachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);

    public async Task<Attachment> MoveAsync(string id, string? targetFolderId)
    {
        var a = await _db.Attachments.FindAsync(id) ?? throw new KeyNotFoundException("File not found");
        if (targetFolderId != null && targetFolderId != "root" && !await _db.Folders.AnyAsync(x => x.Id == targetFolderId))
            throw new ArgumentException("Target folder not found");
        if (targetFolderId == "root") targetFolderId = null;
        a.FolderId = await ResolveAssetFolderIdAsync(targetFolderId);
        await _db.SaveChangesAsync();
        return a;
    }

    public async Task DeleteAsync(string id)
    {
        var a = await _db.Attachments.FindAsync(id) ?? throw new KeyNotFoundException("File not found");
        _db.Attachments.Remove(a);
        await _db.SaveChangesAsync();
        try
        {
            var del = await _storage.DeleteAsync(a.StoragePath);
            if (!del.Deleted)
            {
                // log only — DB row is already gone
            }
        }
        catch { /* best-effort cleanup */ }
    }

    public async Task<Attachment> SaveAsync(IFormFile file, string? noteId, string? folderId)
    {
        if (file.Length == 0) throw new ArgumentException("Empty file");
        if (file.Length > 10 * 1024 * 1024) throw new InvalidOperationException("File quá lớn (tối đa 10MB).");
        var mime = file.ContentType?.ToLowerInvariant() ?? "application/octet-stream";
        if (!AllowedMime.Contains(mime))
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            mime = ext switch
            {
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                ".gif" => "image/gif",
                ".svg" => "image/svg+xml",
                ".json" => "application/json",
                ".txt" => "text/plain",
                ".md" => "text/markdown",
                ".csv" => "text/csv",
                _ => throw new InvalidOperationException($"Loại file không hỗ trợ: {mime}")
            };
        }
        if (noteId != null && !await _db.Notes.AnyAsync(x => x.Id == noteId))
            throw new ArgumentException("Note not found");
        if (folderId != null && folderId != "root" && !await _db.Folders.AnyAsync(x => x.Id == folderId))
            throw new ArgumentException("Folder not found");
        if (folderId == "root") folderId = null;

        var isSvg = mime == "image/svg+xml";
        var id = Guid.NewGuid().ToString();

        // Stream the file (with optional SVG sanitization) into the configured storage
        StoredBlob stored;
        if (isSvg)
        {
            using var reader = new StreamReader(file.OpenReadStream());
            var svg = await reader.ReadToEndAsync();
            svg = ScriptTagRegex.Replace(svg, string.Empty);
            svg = OnHandlerRegex.Replace(svg, string.Empty);
            using var sanitized = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(svg));
            stored = await _storage.UploadAsync(id, file.FileName, mime, sanitized);
        }
        else
        {
            await using var src = file.OpenReadStream();
            stored = await _storage.UploadAsync(id, file.FileName, mime, src);
        }

        if (folderId == null && noteId != null)
        {
            folderId = await _db.Notes.Where(x => x.Id == noteId).Select(x => x.FolderId).FirstOrDefaultAsync();
        }
        folderId = await ResolveAssetFolderIdAsync(folderId);

        var att = new Attachment
        {
            Id = id,
            FileName = file.FileName,
            ContentType = mime,
            StoragePath = stored.Pathname,
            Url = $"/api/files/{id}",
            Size = file.Length,
            FolderId = folderId,
            NoteId = noteId
        };
        _db.Attachments.Add(att);
        await _db.SaveChangesAsync();
        return att;
    }
}
