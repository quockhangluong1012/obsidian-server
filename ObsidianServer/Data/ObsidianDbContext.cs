using Microsoft.EntityFrameworkCore;

namespace ObsidianServer.Data;

public sealed class ObsidianDbContext(DbContextOptions<ObsidianDbContext> options) : DbContext(options)
{
    public DbSet<Folder> Folders => Set<Folder>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Attachment> Attachments => Set<Attachment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Folder>().Property(folder => folder.CreatedAt).HasConversion<string>();
        modelBuilder.Entity<Note>().Property(note => note.CreatedAt).HasConversion<string>();
        modelBuilder.Entity<Note>().Property(note => note.UpdatedAt).HasConversion<string>();
        modelBuilder.Entity<Attachment>().Property(attachment => attachment.CreatedAt).HasConversion<string>();
        modelBuilder.Entity<Folder>(entity =>
        {
            entity.HasKey(folder => folder.Id);
            entity.Property(folder => folder.Name).HasMaxLength(160).IsRequired();
            entity.HasIndex(folder => new { folder.ParentId, folder.Name }).IsUnique();
            entity.HasOne<Folder>().WithMany().HasForeignKey(folder => folder.ParentId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Note>(entity =>
        {
            entity.HasKey(note => note.Id);
            entity.Property(note => note.Title).HasMaxLength(200).IsRequired();
            entity.Property(note => note.Content).IsRequired();
            entity.HasIndex(note => new { note.FolderId, note.Title });
            entity.HasOne<Folder>().WithMany().HasForeignKey(note => note.FolderId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Attachment>(entity =>
        {
            entity.HasKey(attachment => attachment.Id);
            entity.Property(attachment => attachment.FileName).HasMaxLength(255).IsRequired();
            entity.Property(attachment => attachment.ContentType).HasMaxLength(100).IsRequired();
            entity.Property(attachment => attachment.Data).IsRequired();
            entity.HasIndex(attachment => attachment.FolderId);
            entity.HasOne<Folder>().WithMany().HasForeignKey(attachment => attachment.FolderId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Note>().WithMany().HasForeignKey(attachment => attachment.NoteId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}

public sealed class Folder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public Guid? ParentId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Note
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Title { get; set; }
    public Guid? FolderId { get; set; }
    public required string Content { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Attachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public required byte[] Data { get; set; }
    public long Size { get; set; }
    /// <summary>Where the attachment is shown in the tree. Independent of its permanent <c>/api/files/{id}</c> path.</summary>
    public Guid? FolderId { get; set; }
    public Guid? NoteId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}