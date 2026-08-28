using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

public class FolderService(AppDbContext db)
{
    public Task<List<Folder>> ListAsync() => db.Folders.AsNoTracking().OrderBy(x => x.Name).ToListAsync();

    public async Task<Folder> CreateAsync(string name, string? parentId)
    {
        name = name.Trim();
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name required");
        if (parentId != null && !await db.Folders.AnyAsync(x => x.Id == parentId))
            throw new ArgumentException("Parent not found");
        var clash = await db.Folders.AnyAsync(x => x.ParentId == parentId && x.Name.ToLower() == name.ToLower());
        if (clash) throw new InvalidOperationException("Tên này đã tồn tại trong thư mục.");
        var f = new Folder { Name = name, ParentId = parentId };
        db.Folders.Add(f);
        await db.SaveChangesAsync();
        return f;
    }

    public async Task<Folder> RenameAsync(string id, string name)
    {
        name = name.Trim();
        var f = await db.Folders.FindAsync(id) ?? throw new KeyNotFoundException("Folder not found");
        var clash = await db.Folders.AnyAsync(x => x.Id != id && x.ParentId == f.ParentId && x.Name.ToLower() == name.ToLower());
        if (clash) throw new InvalidOperationException("Tên này đã tồn tại trong thư mục.");
        f.Name = name;
        await db.SaveChangesAsync();
        return f;
    }

    public async Task DeleteAsync(string id)
    {
        var f = await db.Folders.FindAsync(id) ?? throw new KeyNotFoundException("Folder not found");
        var hasChildren = await db.Folders.AnyAsync(x => x.ParentId == id);
        var hasNotes = await db.Notes.AnyAsync(x => x.FolderId == id);
        var hasAttachments = await db.Attachments.AnyAsync(x => x.FolderId == id);
        if (hasChildren || hasNotes || hasAttachments) throw new InvalidOperationException("Thư mục không rỗng.");
        db.Folders.Remove(f);
        await db.SaveChangesAsync();
    }

    public async Task<Folder> MoveAsync(string id, string? targetParentId)
    {
        var f = await db.Folders.FindAsync(id) ?? throw new KeyNotFoundException("Folder not found");
        if (targetParentId == id) throw new InvalidOperationException("Không thể di chuyển vào chính nó.");
        if (targetParentId != null)
        {
            if (!await db.Folders.AnyAsync(x => x.Id == targetParentId)) throw new ArgumentException("Target not found");
            // prevent moving into descendant
            var cur = targetParentId;
            while (cur != null)
            {
                if (cur == id) throw new InvalidOperationException("Không thể di chuyển vào thư mục con.");
                cur = await db.Folders.Where(x => x.Id == cur).Select(x => x.ParentId).FirstOrDefaultAsync();
            }
            var clash = await db.Folders.AnyAsync(x => x.Id != id && x.ParentId == targetParentId && x.Name.ToLower() == f.Name.ToLower());
            if (clash) throw new InvalidOperationException("Tên này đã tồn tại trong thư mục đích.");
        }
        else
        {
            var clash = await db.Folders.AnyAsync(x => x.Id != id && x.ParentId == null && x.Name.ToLower() == f.Name.ToLower());
            if (clash) throw new InvalidOperationException("Tên này đã tồn tại trong thư mục đích.");
        }
        f.ParentId = targetParentId;
        await db.SaveChangesAsync();
        return f;
    }

    public async Task<object> GetTreeAsync()
    {
        var folders = await db.Folders.AsNoTracking().ToListAsync();
        var notes = await db.Notes.AsNoTracking().Select(x => new { x.Id, x.FolderId, x.Title }).ToListAsync();
        var attachments = await db.Attachments.AsNoTracking().Select(x => new { x.Id, x.FolderId, x.FileName }).ToListAsync();

        // Build tree recursively
        object Build(string? parentId)
        {
            var children = folders.Where(f => f.ParentId == parentId).OrderBy(f => f.Name).Select(f => new
            {
                id = f.Id,
                name = f.Name,
                kind = "folder",
                parentId = f.ParentId,
                createdAt = f.CreatedAt,
                children = Build(f.Id)
            }).ToList<object>();

            var noteNodes = notes.Where(n => n.FolderId == parentId).OrderBy(n => n.Title).Select(n => new
            {
                id = n.Id,
                name = n.Title,
                kind = "note",
                parentId = n.FolderId
            }).ToList<object>();

            var assetNodes = attachments.Where(a => a.FolderId == parentId).OrderBy(a => a.FileName).Select(a => new
            {
                id = a.Id,
                name = a.FileName,
                kind = "asset",
                parentId = a.FolderId
            }).ToList<object>();

            return children.Concat(noteNodes).Concat(assetNodes).ToList();
        }

        return Build(null);
    }
}
