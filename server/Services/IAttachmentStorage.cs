namespace Server.Services;

public record StoredBlob(string Url, string Pathname, string? PublicId = null);

public record StoredBlobDelete(bool Deleted, string? Reason = null);

public interface IAttachmentStorage
{
    /// <summary>
    /// Upload the given content and return provider-specific URL + pathname.
    /// For local: URL is /api/files/{id} and pathname is the relative path.
    /// For Vercel Blob: URL is the public https://... blob URL and pathname is the blob key.
    /// </summary>
    Task<StoredBlob> UploadAsync(string id, string fileName, string contentType, Stream content, CancellationToken ct = default);

    /// <summary>
    /// Open a read stream for the stored blob. Returns null if missing.
    /// </summary>
    Task<Stream?> OpenReadAsync(string pathname, CancellationToken ct = default);

    /// <summary>
    /// Delete the stored blob by its pathname.
    /// </summary>
    Task<StoredBlobDelete> DeleteAsync(string pathname, CancellationToken ct = default);

    /// <summary>
    /// True if the provider stores data outside the local file system.
    /// Local provider: false. Vercel Blob: true.
    /// </summary>
    bool IsRemote { get; }
}
