using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Tools;

public static class Inspect
{
    public static async Task RunAsync(AppDbContext db)
    {
        Console.WriteLine($"Total Notes: {await db.Notes.CountAsync()}");
        Console.WriteLine($"Total Folders: {await db.Folders.CountAsync()}");
        Console.WriteLine();

        var folders = await db.Folders.ToListAsync();
        var notes = await db.Notes.ToListAsync();
        var byFolder = notes.GroupBy(n => n.FolderId ?? "ROOT").ToDictionary(g => g.Key, g => g.ToList());

        void Walk(string? parentId, string path)
        {
            var children = folders.Where(f => f.ParentId == parentId).ToList();
            foreach (var f in children)
            {
                var p = string.IsNullOrEmpty(path) ? f.Name : path + "/" + f.Name;
                if (byFolder.TryGetValue(f.Id, out var fns))
                {
                    if (fns.Count > 0)
                    {
                        Console.WriteLine($"=== Folder: {p} ({fns.Count} notes) ===");
                        foreach (var n in fns.OrderBy(n => n.Title))
                        {
                            Console.WriteLine($"  [{n.Id[..8]}] {n.Title}  (len={n.Content?.Length ?? 0})");
                        }
                        Console.WriteLine();
                    }
                }
                Walk(f.Id, p);
            }
        }

        Walk(null, "");
        Console.WriteLine("--- root notes ---");
        if (byFolder.TryGetValue("ROOT", out var rootNotes))
        {
            foreach (var n in rootNotes.OrderBy(n => n.Title))
                Console.WriteLine($"  [{n.Id[..8]}] {n.Title}  (len={n.Content?.Length ?? 0})");
        }
    }
}
