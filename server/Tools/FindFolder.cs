using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Tools;

public static class FindFolder
{
    public static async Task RunAsync(AppDbContext db, string name)
    {
        var f = await db.Folders.FirstOrDefaultAsync(x => x.Name == name);
        if (f == null) Console.WriteLine($"NOT FOUND: {name}");
        else Console.WriteLine($"FOUND: id={f.Id} name={f.Name} parent={f.ParentId}");
    }
}
