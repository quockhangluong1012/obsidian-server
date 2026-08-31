namespace Server.Services;

public class LocalAttachmentStorage : IAttachmentStorage
{
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _cfg;

    public LocalAttachmentStorage(IWebHostEnvironment env, IConfiguration cfg)
    {
        _env = env;
        _cfg = cfg;
    }

    public string StorageRoot => _cfg["Storage:Root"] ?? "App_Data/files";

    public string AbsoluteRoot => Path.Combine(_env.ContentRootPath, StorageRoot);

    public string GetAbsolutePath(string storagePath)
        => Path.Combine(AbsoluteRoot, storagePath.Replace('/', Path.DirectorySeparatorChar));

    public async Task<StoredBlob> UploadAsync(string id, string fileName, string contentType, Stream content, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(ext))
        {
            ext = contentType switch
            {
                "image/png" => ".png",
                "image/jpeg" => ".jpg",
                "image/webp" => ".webp",
                "image/gif" => ".gif",
                "image/svg+xml" => ".svg",
                "application/json" => ".json",
                "text/plain" => ".txt",
                "text/markdown" => ".md",
                "text/csv" => ".csv",
                _ => ".bin",
            };
        }
        var now = DateTime.UtcNow;
        var rel = $"{now:yyyy}/{now:MM}/{id}{ext}";
        var abs = GetAbsolutePath(rel);
        Directory.CreateDirectory(Path.GetDirectoryName(abs)!);

        await using (var fs = new FileStream(abs, FileMode.Create, FileAccess.Write))
        {
            await content.CopyToAsync(fs, ct);
        }

        return new StoredBlob(Url: $"/api/files/{id}", Pathname: rel);
    }

    public Task<Stream?> OpenReadAsync(string pathname, CancellationToken ct = default)
    {
        var abs = GetAbsolutePath(pathname);
        if (!File.Exists(abs)) return Task.FromResult<Stream?>(null);
        Stream s = new FileStream(abs, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<Stream?>(s);
    }

    public Task<StoredBlobDelete> DeleteAsync(string pathname, CancellationToken ct = default)
    {
        try
        {
            var abs = GetAbsolutePath(pathname);
            if (File.Exists(abs)) File.Delete(abs);
            return Task.FromResult(new StoredBlobDelete(true));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new StoredBlobDelete(false, ex.Message));
        }
    }
}
