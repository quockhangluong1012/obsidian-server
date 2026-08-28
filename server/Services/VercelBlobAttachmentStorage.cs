using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Server.Services;

public class VercelBlobAttachmentStorage : IAttachmentStorage
{
    private readonly HttpClient _http;
    private readonly VercelBlobOptions _opt;
    private readonly ILogger<VercelBlobAttachmentStorage> _log;

    public VercelBlobAttachmentStorage(HttpClient http, IOptions<VercelBlobOptions> opt, ILogger<VercelBlobAttachmentStorage> log)
    {
        _opt = opt.Value;
        _log = log;
        _http = http;
        _http.BaseAddress = new Uri(_opt.BaseUrl.TrimEnd('/') + "/");
    }

    public bool IsRemote => true;

    public async Task<StoredBlob> UploadAsync(string id, string fileName, string contentType, Stream content, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opt.Token))
            throw new InvalidOperationException("VercelBlob:Token is not configured");

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
        var key = (_opt.KeyPrefix.TrimEnd('/') + "/" + id + ext).TrimStart('/');

        var url = "v2/blob/upload?" + (_opt.AddRandomSuffix ? "addRandomSuffix=1&" : "") + "pathname=" + Uri.EscapeDataString(key);
        var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.Token);
        req.Headers.Add("x-content-type", contentType);

        // Stream the body as the raw file content
        var ms = new MemoryStream();
        await content.CopyToAsync(ms, ct);
        ms.Position = 0;
        var streamContent = new StreamContent(ms);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        req.Content = streamContent;

        using var resp = await _http.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            _log.LogError("Vercel Blob upload failed: {Status} {Body}", (int)resp.StatusCode, body);
            throw new InvalidOperationException($"Vercel Blob upload failed ({(int)resp.StatusCode}): {body}");
        }

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        return new StoredBlob(
            Url: root.GetProperty("url").GetString() ?? throw new InvalidOperationException("Vercel Blob response missing 'url'"),
            Pathname: key
        );
    }

    public Task<Stream?> OpenReadAsync(string pathname, CancellationToken ct = default)
    {
        // Vercel Blob reads happen via the public URL directly. We do not proxy bytes through
        // the .NET server in remote mode — the client should hit the blob URL straight.
        return Task.FromResult<Stream?>(null);
    }

    public async Task<StoredBlobDelete> DeleteAsync(string pathname, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opt.Token))
            return new StoredBlobDelete(false, "token missing");

        var url = "v2/blob/" + Uri.EscapeDataString(pathname);
        var req = new HttpRequestMessage(HttpMethod.Delete, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.Token);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.IsSuccessStatusCode) return new StoredBlobDelete(true);
        var body = await resp.Content.ReadAsStringAsync(ct);
        _log.LogWarning("Vercel Blob delete failed: {Status} {Body}", (int)resp.StatusCode, body);
        return new StoredBlobDelete(false, $"status={(int)resp.StatusCode}");
    }
}
