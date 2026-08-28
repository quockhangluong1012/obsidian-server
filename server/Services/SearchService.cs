using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Server.Data;

namespace Server.Services;

public class SearchService(AppDbContext db)
{
    public async Task<List<object>> SearchAsync(string q, int limit = 20)
    {
        q = q?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(q)) return new List<object>();

        // Build a safe CONTAINS prefix query: append * to each whitespace-separated token
        // (e.g. "hello world" -> "hello* AND world*") so partial words match too.
        var tokens = q.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        var containsQuery = string.Join(" AND ", tokens.Select(t => EscapeForContains(t) + "*"));

        // SQL Server Full-Text: FREETEXTTABLE for natural-language ranking, falls back to CONTAINSTABLE
        // We also pull a snippet by locating the first match in Content.
        var sql = @"
            SELECT TOP (@limit)
                n.Id, n.Title, n.FolderId, n.Content, n.UpdatedAt, k.[RANK]
            FROM FREETEXTTABLE([Notes], (Title, Content), @q) AS k
            INNER JOIN [Notes] n ON n.Id = k.[KEY]
            ORDER BY k.[RANK] DESC;
        ";

        var conn = db.Database.GetDbConnection();
        await conn.OpenAsync();
        try
        {
            using var cmd = (SqlCommand)conn.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.Add(new SqlParameter("@q", System.Data.SqlDbType.NVarChar) { Value = q });
            cmd.Parameters.Add(new SqlParameter("@limit", System.Data.SqlDbType.Int) { Value = limit });

            var list = new List<object>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var content = reader.IsDBNull(3) ? "" : reader.GetString(3);
                var title = reader.IsDBNull(1) ? "" : reader.GetString(1);
                list.Add(new
                {
                    id = reader.GetString(0),
                    title = title,
                    folderId = reader.IsDBNull(2) ? null : reader.GetString(2),
                    content = content,
                    updatedAt = reader.GetDateTime(4),
                    snippet = BuildSnippet(content, q)
                });
            }
            return list;
        }
        catch
        {
            // FTS not available / query syntax error -> return empty so caller can fallback to LIKE
            return new List<object>();
        }
        finally
        {
            await conn.CloseAsync();
        }
    }

    // Escape CONTAINS special characters by wrapping each token in quotes
    private static string EscapeForContains(string token)
    {
        // Strip CONTAINS operators; allow only letters, digits, underscore inside a quoted token
        var cleaned = new string(token.Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '-').ToArray());
        return "\"" + cleaned.Replace("\"", "\"\"") + "\"";
    }

    // Build a small HTML snippet around the first match. Like SQLite's snippet() but a tiny implementation.
    private static string BuildSnippet(string content, string q, int radius = 32)
    {
        if (string.IsNullOrEmpty(content)) return "";
        var lowerContent = content.ToLowerInvariant();
        var lowerQ = q.ToLowerInvariant();
        var idx = lowerContent.IndexOf(lowerQ, StringComparison.Ordinal);
        if (idx < 0)
        {
            // try any token
            foreach (var tok in q.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries))
            {
                idx = lowerContent.IndexOf(tok.ToLowerInvariant(), StringComparison.Ordinal);
                if (idx >= 0) break;
            }
        }
        int start = idx < 0 ? 0 : Math.Max(0, idx - radius);
        int end = Math.Min(content.Length, start + radius * 2);
        if (start > 0) start = Math.Min(start + 3, content.Length);
        var snippet = content.Substring(start, end - start);
        if (start > 0) snippet = "..." + snippet;
        if (end < content.Length) snippet += "...";
        // Highlight literal occurrences of q (case-insensitive, simple)
        foreach (var tok in q.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries))
        {
            if (string.IsNullOrWhiteSpace(tok)) continue;
            snippet = System.Text.RegularExpressions.Regex.Replace(
                snippet,
                System.Text.RegularExpressions.Regex.Escape(tok),
                m => $"<mark>{m.Value}</mark>",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        }
        return snippet;
    }

    // Fallback LIKE search when FTS not available or for folder names
    public async Task<List<object>> SearchAllAsync(string q)
    {
        q = q.ToLowerInvariant();
        var notes = await db.Notes.AsNoTracking()
            .Where(n => n.Title.ToLower().Contains(q) || n.Content.ToLower().Contains(q))
            .Take(20)
            .Select(n => new { id = n.Id, name = n.Title, kind = "note", path = "" })
            .ToListAsync<object>();
        var folders = await db.Folders.AsNoTracking()
            .Where(f => f.Name.ToLower().Contains(q))
            .Take(10)
            .Select(f => new { id = f.Id, name = f.Name, kind = "folder", path = "" })
            .ToListAsync<object>();
        return folders.Concat(notes).ToList();
    }
}
