namespace Server.Models;

public class Attachment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    /// <summary>Relative path under Storage:Root (local) or blob key (remote), e.g. 2026/08/{id}.png</summary>
    public string StoragePath { get; set; } = string.Empty;
    /// <summary>Public URL for serving the file. Local: /api/files/{id}. Remote: Vercel Blob URL.</summary>
    public string Url { get; set; } = string.Empty;
    public long Size { get; set; }
    /// <summary>Display folder in tree (move only changes this), null = vault root</summary>
    public string? FolderId { get; set; }
    public Folder? Folder { get; set; }
    public string? NoteId { get; set; }
    public Note? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
