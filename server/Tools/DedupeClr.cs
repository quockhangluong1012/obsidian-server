using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Tools;

public static class DedupeClr
{
    /// <summary>
    /// For CLR via CSharp folder, remove duplicate notes that were just re-imported.
    /// Keep the OLDEST note (by CreatedAt) for each unique Title; delete newer duplicates.
    /// </summary>
    public static async Task<int> RunAsync(AppDbContext db, string folderId)
    {
        var notes = await db.Notes.Where(n => n.FolderId == folderId).ToListAsync();
        var byTitle = notes.GroupBy(n => n.Title).Where(g => g.Count() > 1).ToList();
        int deleted = 0;
        foreach (var grp in byTitle)
        {
            // keep oldest (smallest CreatedAt)
            var ordered = grp.OrderBy(n => n.CreatedAt).ToList();
            var keeper = ordered.First();
            var dupes = ordered.Skip(1).ToList();
            foreach (var d in dupes)
            {
                Console.WriteLine($"  delete dupe: [{d.Id[..8]}] {d.Title}  (created={d.CreatedAt:o})  keep [{keeper.Id[..8]}] (created={keeper.CreatedAt:o})");
                db.Notes.Remove(d);
                deleted++;
            }
        }
        if (deleted > 0) await db.SaveChangesAsync();
        return deleted;
    }
}
