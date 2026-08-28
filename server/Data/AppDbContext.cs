using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Folder> Folders => Set<Folder>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Attachment> Attachments => Set<Attachment>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Folder>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ParentId).HasMaxLength(64);
            e.Property(x => x.Name).IsRequired().HasMaxLength(450);
            e.HasIndex(x => new { x.ParentId, x.Name }).IsUnique();
            e.HasOne(x => x.Parent).WithMany(x => x.Children).HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
        });
        b.Entity<Note>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Title).IsRequired().HasMaxLength(450);
            e.Property(x => x.FolderId).HasMaxLength(64);
            e.HasIndex(x => x.FolderId);
            e.HasOne(x => x.Folder).WithMany().HasForeignKey(x => x.FolderId).OnDelete(DeleteBehavior.SetNull);
        });
        b.Entity<Attachment>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.FileName).IsRequired().HasMaxLength(450);
            e.Property(x => x.StoragePath).IsRequired().HasMaxLength(900);
            e.Property(x => x.Url).IsRequired().HasMaxLength(2000);
            e.Property(x => x.FolderId).HasMaxLength(64);
            e.Property(x => x.NoteId).HasMaxLength(64);
            e.HasIndex(x => x.FolderId);
            e.HasIndex(x => x.NoteId);
            e.HasOne(x => x.Folder).WithMany().HasForeignKey(x => x.FolderId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Note).WithMany().HasForeignKey(x => x.NoteId).OnDelete(DeleteBehavior.SetNull);
        });
    }

    public async Task MigrateAndSeedAsync()
    {
        await Database.MigrateAsync();
        // Legacy remote attachments stored an unauthenticated Vercel Blob URL. Serve them
        // through the application endpoint, which authenticates the storage request.
        await Database.ExecuteSqlRawAsync(@"
            UPDATE n
            SET Content = REPLACE(n.Content, a.Url, '/api/files/' + a.Id)
            FROM Notes AS n
            CROSS JOIN Attachments AS a
            WHERE a.Url LIKE 'https://%.blob.vercel-storage.com/%'
              AND n.Content LIKE '%' + a.Url + '%';

            UPDATE Attachments
            SET Url = '/api/files/' + Id
            WHERE Url LIKE 'https://%.blob.vercel-storage.com/%';
        ");

        // SQL Server Full-Text Search: enable on DB + create catalog/index over Notes(Title, Content)
        // Safe to re-run; check existence first to avoid SQL errors.
        try
        {
            await Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'NotesCatalog')
                BEGIN
                    IF CAST(SERVERPROPERTY('IsFullTextInstalled') AS INT) = 1
                    BEGIN
                        EXEC('CREATE FULLTEXT CATALOG NotesCatalog AS DEFAULT;')
                    END
                END
            ");

            await Database.ExecuteSqlRawAsync(@"
                IF CAST(SERVERPROPERTY('IsFullTextInstalled') AS INT) = 1
                   AND NOT EXISTS (
                       SELECT 1 FROM sys.fulltext_indexes i
                       JOIN sys.tables t ON i.object_id = t.object_id
                       WHERE t.name = 'Notes'
                   )
                BEGIN
                    EXEC('CREATE FULLTEXT INDEX ON [Notes] (Title, Content) KEY INDEX PK_Notes WITH STOPLIST = SYSTEM;')
                END
            ");
        }
        catch
        {
            // Full-Text is optional; if unavailable the LIKE fallback in SearchService will still work.
        }
    }
}
