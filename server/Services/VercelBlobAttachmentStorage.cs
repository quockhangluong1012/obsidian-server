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
    }

    private Uri StoreBase => new(_opt.BaseUrl.TrimEnd('/') + "/");

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

        // Vercel Blob direct upload: PUT {storeBaseUrl}/{pathname}[?addRandomSuffix=1]
        // Use absolute URI to avoid HttpClient relative-URI query escaping.
        var uploadUri = new Uri(StoreBase, key);
        if (_opt.AddRandomSuffix)
        {
            var ub = new UriBuilder(uploadUri) { Query = "addRandomSuffix=1" };
            uploadUri = ub.Uri;
        }
        var req = new HttpRequestMessage(HttpMethod.Put, uploadUri);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.Token);
        req.Headers.Add("x-content-type", contentType);

        // Send the input stream without buffering the attachment in server memory.
        var streamContent = new StreamContent(content);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
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
        var returnedUrl = root.GetProperty("url").GetString() ?? throw new InvalidOperationException("Vercel Blob response missing 'url'");
        var returnedPath = root.TryGetProperty("pathname", out var pn) ? pn.GetString() ?? key : key;
        return new StoredBlob(Url: returnedUrl, Pathname: returnedPath);
    }

    public async Task<Stream?> OpenReadAsync(string pathname, CancellationToken ct = default)
    {
        // The store is private, so reads need the same Bearer token as uploads/deletes.
        // Proxy the bytes through the server instead of redirecting the browser to the blob URL.
        var url = new Uri(StoreBase, pathname);
        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.Token);

        var resp = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!resp.IsSuccessStatusCode)
        {
            resp.Dispose();
            return null;
        }
        return await resp.Content.ReadAsStreamAsync(ct);
    }

    public async Task<StoredBlobDelete> DeleteAsync(string pathname, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opt.Token))
            return new StoredBlobDelete(false, "token missing");

        var url = new Uri(StoreBase, pathname);
        var req = new HttpRequestMessage(HttpMethod.Delete, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.Token);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.IsSuccessStatusCode) return new StoredBlobDelete(true);
        var body = await resp.Content.ReadAsStringAsync(ct);
        _log.LogWarning("Vercel Blob delete failed: {Status} {Body}", (int)resp.StatusCode, body);
        return new StoredBlobDelete(false, $"status={(int)resp.StatusCode}");
    }
}
