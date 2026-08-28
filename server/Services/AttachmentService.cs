using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

public class AttachmentService(AppDbContext db, IWebHostEnvironment env, IConfiguration cfg)
{
    private string StorageRoot => cfg["Storage:Root"] ?? "data/files";
    private string AbsoluteRoot => Path.Combine(env.ContentRootPath, StorageRoot);

    private static readonly HashSet<string> AllowedMime = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"
    };

    public string GetAbsolutePath(Attachment a) => Path.Combine(AbsoluteRoot, a.StoragePath.Replace('/', Path.DirectorySeparatorChar));

    public Task<List<Attachment>> ListAsync(string? folderId)
    {
        var q = db.Attachments.AsNoTracking().AsQueryable();
        if (folderId != null) q = q.Where(x => x.FolderId == folderId);
        return q.OrderByDescending(x => x.CreatedAt).ToListAsync();
    }

    public Task<Attachment?> GetAsync(string id) => db.Attachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);

    public async Task<Attachment> MoveAsync(string id, string? targetFolderId)
    {
        var a = await db.Attachments.FindAsync(id) ?? throw new KeyNotFoundException("File not found");
        if (targetFolderId != null && targetFolderId != "root" && !await db.Folders.AnyAsync(x => x.Id == targetFolderId))
            throw new ArgumentException("Target folder not found");
        // normalize root -> null
        if (targetFolderId == "root") targetFolderId = null;
        a.FolderId = targetFolderId;
        await db.SaveChangesAsync();
        return a;
    }

    public async Task DeleteAsync(string id)
    {
        var a = await db.Attachments.FindAsync(id) ?? throw new KeyNotFoundException("File not found");
        var abs = GetAbsolutePath(a);
        db.Attachments.Remove(a);
        await db.SaveChangesAsync();
        try { if (File.Exists(abs)) File.Delete(abs); } catch { /* ignore */ }
    }

    public async Task<Attachment> SaveAsync(IFormFile file, string? noteId, string? folderId)
    {
        if (file.Length == 0) throw new ArgumentException("Empty file");
        if (file.Length > 10 * 1024 * 1024) throw new InvalidOperationException("File quá lớn (tối đa 10MB).");
        var mime = file.ContentType?.ToLowerInvariant() ?? "application/octet-stream";
        if (!AllowedMime.Contains(mime))
        {
            // fallback by extension
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            mime = ext switch
            {
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                ".gif" => "image/gif",
                ".svg" => "image/svg+xml",
                _ => throw new InvalidOperationException($"Loại file không hỗ trợ: {mime}")
            };
        }
        if (noteId != null && !await db.Notes.AnyAsync(x => x.Id == noteId))
            throw new ArgumentException("Note not found");
        if (folderId != null && folderId != "root" && !await db.Folders.AnyAsync(x => x.Id == folderId))
            throw new ArgumentException("Folder not found");
        if (folderId == "root") folderId = null;

        // If svg, sanitize: strip <script> and on* handlers (basic)
        var isSvg = mime == "image/svg+xml";
        var id = Guid.NewGuid().ToString();
        var ext2 = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext2))
            ext2 = mime == "image/png" ? ".png" : mime == "image/jpeg" ? ".jpg" : mime == "image/webp" ? ".webp" : mime == "image/gif" ? ".gif" : ".svg";
        var now = DateTime.UtcNow;
        var rel = $"{now:yyyy}/{now:MM}/{id}{ext2}";
        var abs = Path.Combine(AbsoluteRoot, rel.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(abs)!);

        if (isSvg)
        {
            using var reader = new StreamReader(file.OpenReadStream());
            var svg = await reader.ReadToEndAsync();
            // basic sanitize: remove script tags and on* attributes
            svg = System.Text.RegularExpressions.Regex.Replace(svg, @"<script[\s\S]*?</script>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            svg = System.Text.RegularExpressions.Regex.Replace(svg, @"\son\w+\s*=\s*(""[^""]*""|'[^']*'|[^\s>]+)", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            await File.WriteAllTextAsync(abs, svg);
        }
        else
        {
            using var fs = new FileStream(abs, FileMode.Create, FileAccess.Write);
            await file.CopyToAsync(fs);
        }

        // If folderId not provided, try to infer from note's folder
        if (folderId == null && noteId != null)
        {
            folderId = await db.Notes.Where(x => x.Id == noteId).Select(x => x.FolderId).FirstOrDefaultAsync();
        }

        var att = new Attachment
        {
            Id = id,
            FileName = file.FileName,
            ContentType = mime,
            StoragePath = rel,
            Size = file.Length,
            FolderId = folderId,
            NoteId = noteId
        };
        db.Attachments.Add(att);
        await db.SaveChangesAsync();
        return att;
    }
}
