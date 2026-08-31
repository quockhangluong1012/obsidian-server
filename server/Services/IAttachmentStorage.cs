namespace Server.Services;

public record StoredBlob(string Url, string Pathname);

public record StoredBlobDelete(bool Deleted, string? Reason = null);

public interface IAttachmentStorage
{
    /// <summary>
    /// Upload the given content and return provider-specific URL + pathname.
    /// The application serves every attachment at /api/files/{id}; the provider URL is not exposed to clients.
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
}