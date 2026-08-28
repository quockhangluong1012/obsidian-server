namespace Server.Services;

public class VercelBlobOptions
{
    public const string SectionName = "VercelBlob";

    public string Token { get; set; } = string.Empty;
    /// <summary>
    /// Override Vercel Blob REST base. Defaults to https://blob.vercel-storage.com.
    /// </summary>
    public string BaseUrl { get; set; } = "https://blob.vercel-storage.com";
    /// <summary>
    /// Prefix for all uploaded blobs (acts like a folder). Defaults to "obsidian/".
    /// </summary>
    public string KeyPrefix { get; set; } = "obsidian/";
    /// <summary>
    /// If true, the server will randomize the suffix on every upload (default true).
    /// </summary>
    public bool AddRandomSuffix { get; set; } = true;
}
