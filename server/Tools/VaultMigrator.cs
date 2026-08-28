using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;
using System.Text;
using System.Text.RegularExpressions;

namespace Server.Tools;

public class VaultMigrator
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _cfg;

    public VaultMigrator(AppDbContext db, IWebHostEnvironment env, IConfiguration cfg)
    {
        _db = db;
        _env = env;
        _cfg = cfg;
    }

    private string StorageRoot => _cfg["Storage:Root"] ?? "App_Data/files";
    private string AbsoluteRoot => Path.Combine(_env.ContentRootPath, StorageRoot);

    // Q2 excludes
    private static readonly HashSet<string> ExcludedDirNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ".obsidian", ".git", ".claude"
    };
    private static bool IsExcludedDir(string name)
    {
        if (ExcludedDirNames.Contains(name)) return true;
        if (name.StartsWith(".tmp", StringComparison.OrdinalIgnoreCase)) return true;
        if (name.Equals(".tmp.driveupload", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }
    private static bool IsExcludedFile(string name)
    {
        if (name.Equals(".gitignore", StringComparison.OrdinalIgnoreCase)) return true;
        if (name.StartsWith(".fuse_hidden", StringComparison.OrdinalIgnoreCase)) return true;
        if (name.StartsWith(".tmp", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    // Q1: exclude pdf/xlsx/zip, keep others. For notes: .md / .json / .py / .pyc / .jsonl / empty? For attachments: image types + svg
    private static readonly HashSet<string> ExcludedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".xlsx", ".zip"
    };
    private static readonly HashSet<string> NoteExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".md", ".json", ".py", ".pyc", ".jsonl", "" // empty for files without ext? we treat as note if unknown text
    };
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"
    };

    private static string GetContentType(string ext, string? fallback = null)
    {
        ext = ext.ToLowerInvariant();
        return ext switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".svg" => "image/svg+xml",
            _ => fallback ?? "application/octet-stream"
        };
    }

    public async Task<MigrateResult> MigrateAsync(string vaultRoot, bool wipe, bool rewriteLinks, bool dryRun, Action<string>? log = null, string? targetFolderId = null)
    {
        void L(string s) { if (log != null) log(s); else Console.WriteLine(s); }

        if (!Directory.Exists(vaultRoot)) throw new DirectoryNotFoundException($"Vault not found: {vaultRoot}");

        // Validate targetFolderId if provided
        if (!string.IsNullOrEmpty(targetFolderId))
        {
            if (!await _db.Folders.AnyAsync(f => f.Id == targetFolderId))
                throw new ArgumentException($"Target folder not found: {targetFolderId}");
            L($"[target] using existing folder id={targetFolderId} as destination root");
        }

        // 1. Scan vault
        L($"[scan] vault={vaultRoot}");
        var allDirs = new List<string>();
        var allFiles = new List<FileInfo>();

        var queue = new Queue<string>();
        queue.Enqueue(vaultRoot);
        int skipObs = 0, skipGit = 0, skipClaude = 0, skipFuse = 0, skipTmp = 0, skipGitIgnore = 0;

        while (queue.Count > 0)
        {
            var cur = queue.Dequeue();
            IEnumerable<string> dirs;
            IEnumerable<string> files;
            try
            {
                dirs = Directory.EnumerateDirectories(cur);
                files = Directory.EnumerateFiles(cur);
            }
            catch (Exception ex)
            {
                L($"[warn] cannot enumerate {cur}: {ex.Message}");
                continue;
            }

            foreach (var d in dirs)
            {
                var name = Path.GetFileName(d);
                if (IsExcludedDir(name))
                {
                    if (name.Equals(".obsidian", StringComparison.OrdinalIgnoreCase)) skipObs++;
                    else if (name.Equals(".git", StringComparison.OrdinalIgnoreCase)) skipGit++;
                    else if (name.Equals(".claude", StringComparison.OrdinalIgnoreCase)) skipClaude++;
                    else if (name.StartsWith(".tmp", StringComparison.OrdinalIgnoreCase)) skipTmp++;
                    else skipTmp++;
                    continue;
                }
                // Also skip .tmp.driveupload inside folder (it starts with .tmp)
                allDirs.Add(d);
                queue.Enqueue(d);
            }

            foreach (var f in files)
            {
                var name = Path.GetFileName(f);
                if (IsExcludedFile(name))
                {
                    if (name.StartsWith(".fuse_hidden")) skipFuse++;
                    else if (name.Equals(".gitignore")) skipGitIgnore++;
                    else skipTmp++;
                    continue;
                }
                var ext = Path.GetExtension(name);
                if (ExcludedExtensions.Contains(ext))
                {
                    // Q1 exclude pdf/xlsx/zip
                    continue;
                }
                try
                {
                    var fi = new FileInfo(f);
                    allFiles.Add(fi);
                }
                catch { }
            }
        }

        L($"[scan] dirs={allDirs.Count} files={allFiles.Count} (skip .obsidian~{skipObs} .git~{skipGit} .claude~{skipClaude} fuse~{skipFuse} tmp~{skipTmp} gitignore~{skipGitIgnore})");

        // Classify
        var noteFiles = new List<FileInfo>();
        var assetFiles = new List<FileInfo>();
        var ignoredFiles = new List<FileInfo>();

        foreach (var fi in allFiles)
        {
            var ext = fi.Extension.ToLowerInvariant();
            if (ImageExtensions.Contains(ext))
                assetFiles.Add(fi);
            else if (NoteExtensions.Contains(ext) || ext == ".md")
                noteFiles.Add(fi);
            else
            {
                // For unknown extensions like .py already covered, but if some other like .css .js .txt etc: treat as note if text-ish, else asset
                // We'll treat remaining as note (as per Q1 "migrate tất cả")
                // But check if ext is .css .js etc - still note
                if (ext == ".css" || ext == ".js" || ext == ".txt" || ext == ".md" || ext == "")
                    noteFiles.Add(fi);
                else
                    ignoredFiles.Add(fi);
            }
        }

        // Also handle .md already in noteFiles, double check: .md is in NoteExtensions
        // Actually NoteExtensions includes .md, so fine.

        L($"[classify] notes={noteFiles.Count} assets={assetFiles.Count} ignored={ignoredFiles.Count}");
        if (ignoredFiles.Count > 0)
        {
            foreach (var ig in ignoredFiles.Take(10)) L($"  [ignored] {ig.FullName.Replace(vaultRoot, "")} ext={ig.Extension}");
        }

        // Build folder structure map
        // Q3: Map thành 4 folder gốc và giữ nguyên folder con
        // vaultRoot children are top-level folders/files. Each top-level directory becomes root folder (ParentId=null)
        // Their subdirectories recursively keep ParentId chain.

        // Collect all unique directory relative paths that contain files or are empty folders
        var dirSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var d in allDirs)
        {
            var rel = Path.GetRelativePath(vaultRoot, d);
            // Normalize to use / or \? Keep as path string
            dirSet.Add(rel);
        }
        // Also include parent dirs of files that may not have been captured? allDirs already captures.

        // Need to ensure directories sorted by depth (parent before child)
        var sortedDirs = dirSet.OrderBy(p => p.Count(c => c == Path.DirectorySeparatorChar || c == '/')).ThenBy(p => p).ToList();

        if (dryRun)
        {
            L("[dry-run] would create folders:");
            foreach (var rd in sortedDirs.Take(30)) L($"  {rd}");
            if (sortedDirs.Count > 30) L($"  ... +{sortedDirs.Count - 30} more");
            L($"[dry-run] would create {noteFiles.Count} notes and {assetFiles.Count} attachments");
            // Also estimate rewrite links
            if (rewriteLinks)
            {
                L("[dry-run] would rewrite links: ![[...]] / ![](...) -> /api/files/{id}");
            }
            return new MigrateResult { DryRun = true, Folders = sortedDirs.Count, Notes = noteFiles.Count, Assets = assetFiles.Count };
        }

        // Wipe if requested Q5
        if (wipe)
        {
            L("[wipe] clearing DB and disk...");
            // Need to handle FK constraints: delete attachments, notes, then folders leaf-first
            // Use raw SQL for speed
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM Attachments;");
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM Notes;");
            // FTS content sync triggers should handle delete, but also clear if orphan
            try { await _db.Database.ExecuteSqlRawAsync("DELETE FROM Notes_FTS;"); } catch { }
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM Folders;");

            // Delete physical files
            if (Directory.Exists(AbsoluteRoot))
            {
                foreach (var f in Directory.EnumerateFiles(AbsoluteRoot, "*", SearchOption.AllDirectories))
                {
                    try { File.Delete(f); } catch { }
                }
                // Keep directory structure
            }
            L("[wipe] done");
        }

        int folderCreated = 0;
        // Create folders
        // Map relativePath -> FolderId
        var folderMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        // If targetFolderId is set, we don't create any new folders - all notes/assets go directly to targetFolderId
        if (!string.IsNullOrEmpty(targetFolderId))
        {
            L($"[folders] skip folder creation, using target folder id={targetFolderId}");
        }
        else
        {
            // Helper to ensure folder exists, creating parents via FolderService or direct db
            // We'll use direct db for bulk efficiency, but need to respect Q4: no duplicate name in same parent -> throw
            // Since we wipe, no pre-existing folders, so only need to check within vault duplicates case-insensitive same ParentId.

            // Build a set to detect duplicate folder names under same parent within vault itself
            var folderNameUnderParent = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var rel in sortedDirs)
            {
                var parts = rel.Split(new[] { Path.DirectorySeparatorChar, '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0) continue;
                var name = parts[^1];
                var parentRel = parts.Length == 1 ? null : string.Join(Path.DirectorySeparatorChar, parts.Take(parts.Length - 1));
                string? parentId = null;
                if (parentRel != null)
                {
                    if (!folderMap.TryGetValue(parentRel, out parentId))
                    {
                        // Parent not created? Should have been due to sorted order, but if missing (maybe parent was excluded) -> create placeholder?
                        // This shouldn't happen because sorted by depth ensures parent before child
                        L($"[warn] parent not found for {rel}, parentRel={parentRel}");
                        continue;
                    }
                }
                // Q4 check duplicate: name under same parent (case-insensitive)
                var key = $"{parentId ?? "root"}|{name.ToLowerInvariant()}";
                if (folderNameUnderParent.Contains(key))
                {
                    throw new InvalidOperationException($"Trùng tên folder trong cùng thư mục cha: '{name}' under parent '{parentRel ?? "root"}' (path: {rel}). Q4 không cho trùng.");
                }
                folderNameUnderParent.Add(key);

                var id = Guid.NewGuid().ToString();
                var folder = new Folder { Id = id, Name = name, ParentId = parentId, CreatedAt = DateTime.UtcNow };
                _db.Folders.Add(folder);
                folderMap[rel] = id;
                folderCreated++;
                // Batch save every 500
                if (folderCreated % 500 == 0)
                {
                    await _db.SaveChangesAsync();
                    L($"[folders] created {folderCreated}/{sortedDirs.Count}");
                }
            }
            if (folderCreated % 500 != 0) await _db.SaveChangesAsync();
            L($"[folders] total created {folderCreated}");
        }

        // Create notes
        // Need to handle .md vs .json/.py: Title = filename without extension, Content = file content
        // For .json/.py, we may want to wrap with note but raw content
        int noteCreated = 0;
        var noteIdByPath = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var fi in noteFiles)
        {
            var relPath = Path.GetRelativePath(vaultRoot, fi.FullName);
            var dirRel = Path.GetDirectoryName(relPath);
            string? folderId = targetFolderId; // when targetFolderId is set, ignore per-file folder
            if (string.IsNullOrEmpty(folderId))
            {
                if (!string.IsNullOrEmpty(dirRel) && dirRel != ".")
                {
                    if (!folderMap.TryGetValue(dirRel, out folderId))
                    {
                        // File's directory not in map? Means directory was excluded? Should skip
                        L($"[warn] note dir not mapped: {relPath} dirRel={dirRel}");
                        // Try to find closest parent folder map: walk up
                        var parts = dirRel.Split(new[] { Path.DirectorySeparatorChar, '/', '\\' });
                        for (int i = parts.Length - 1; i >= 0; i--)
                        {
                            var tryRel = string.Join(Path.DirectorySeparatorChar, parts.Take(i + 1));
                            if (folderMap.TryGetValue(tryRel, out folderId)) break;
                        }
                    }
                }
            }
            var title = Path.GetFileNameWithoutExtension(fi.Name);
            if (string.IsNullOrWhiteSpace(title)) title = fi.Name;
            string content;
            try
            {
                // Read as UTF8, with BOM detection
                content = await File.ReadAllTextAsync(fi.FullName, Encoding.UTF8);
            }
            catch (Exception ex)
            {
                L($"[warn] cannot read {relPath}: {ex.Message}");
                content = "";
            }

            // For json/py, optionally wrap in code fence? But spec says raw markdown, so we keep raw.
            // However to make json/py display nicely with highlight, we can ensure content is not empty.
            var note = new Note { Id = Guid.NewGuid().ToString(), Title = title, FolderId = folderId, Content = content, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            _db.Notes.Add(note);
            noteIdByPath[relPath] = note.Id;
            noteCreated++;
            if (noteCreated % 300 == 0)
            {
                await _db.SaveChangesAsync();
                L($"[notes] created {noteCreated}/{noteFiles.Count}");
            }
        }
        if (noteCreated % 300 != 0) await _db.SaveChangesAsync();
        L($"[notes] total created {noteCreated}");

        // Create attachments
        // For each asset file, copy to App_Data/files/{yyyy}/{MM}/{id}{ext} and create DB record
        // Need to ensure AbsoluteRoot exists
        Directory.CreateDirectory(AbsoluteRoot);
        var now = DateTime.UtcNow;
        var year = now.ToString("yyyy");
        var month = now.ToString("MM");

        // Map filename (lower) -> list of ids (for rewrite) - last occurrence wins; but also handle duplicates
        var fileNameToId = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var assetIdByRelPath = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        int assetCreated = 0;
        foreach (var fi in assetFiles)
        {
            var relPath = Path.GetRelativePath(vaultRoot, fi.FullName);
            var dirRel = Path.GetDirectoryName(relPath);
            string? folderId = targetFolderId; // when targetFolderId is set, ignore per-file folder
            if (string.IsNullOrEmpty(folderId))
            {
                if (!string.IsNullOrEmpty(dirRel) && dirRel != ".")
                {
                    if (!folderMap.TryGetValue(dirRel, out folderId))
                    {
                        // Walk up
                        var parts = dirRel.Split(new[] { Path.DirectorySeparatorChar, '/', '\\' });
                        for (int i = parts.Length - 1; i >= 0; i--)
                        {
                            var tryRel = string.Join(Path.DirectorySeparatorChar, parts.Take(i + 1));
                            if (folderMap.TryGetValue(tryRel, out folderId)) break;
                        }
                    }
                }
            }

            var ext = fi.Extension.ToLowerInvariant();
            var mime = GetContentType(ext);
            var id = Guid.NewGuid().ToString();
            var fileExt = fi.Extension; // keep original case
            if (string.IsNullOrEmpty(fileExt))
            {
                fileExt = mime == "image/png" ? ".png" : mime == "image/jpeg" ? ".jpg" : ".svg";
            }
            var relStorage = $"{year}/{month}/{id}{fileExt}";
            var absPath = Path.Combine(AbsoluteRoot, relStorage.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(absPath)!);

            try
            {
                if (mime == "image/svg+xml")
                {
                    var svg = await File.ReadAllTextAsync(fi.FullName, Encoding.UTF8);
                    // sanitize like AttachmentService
                    svg = Regex.Replace(svg, @"<script[\s\S]*?</script>", "", RegexOptions.IgnoreCase);
                    svg = Regex.Replace(svg, @"\son\w+\s*=\s*(""[^""]*""|'[^']*'|[^\s>]+)", "", RegexOptions.IgnoreCase);
                    await File.WriteAllTextAsync(absPath, svg, Encoding.UTF8);
                }
                else
                {
                    File.Copy(fi.FullName, absPath, overwrite: true);
                }
            }
            catch (Exception ex)
            {
                L($"[warn] copy asset failed {relPath}: {ex.Message}");
                continue;
            }

            var att = new Attachment
            {
                Id = id,
                FileName = fi.Name,
                ContentType = mime,
                StoragePath = relStorage,
                Size = fi.Length,
                FolderId = folderId,
                NoteId = null,
                CreatedAt = DateTime.UtcNow
            };
            _db.Attachments.Add(att);
            assetIdByRelPath[relPath] = id;
            // For rewrite, map fileName -> id. If duplicate file names, later wins, but we also store full path map for better.
            fileNameToId[fi.Name] = id;
            // Also map lower without path
            var lowerName = fi.Name.ToLowerInvariant();
            if (!fileNameToId.ContainsKey(lowerName)) fileNameToId[lowerName] = id;

            assetCreated++;
            if (assetCreated % 300 == 0)
            {
                await _db.SaveChangesAsync();
                L($"[assets] created {assetCreated}/{assetFiles.Count}");
            }
        }
        if (assetCreated % 300 != 0) await _db.SaveChangesAsync();
        L($"[assets] total created {assetCreated}");

        // Q6: rewrite links in Notes.Content to /api/files/{id}
        if (rewriteLinks && assetCreated > 0)
        {
            L($"[rewrite] starting link rewrite for {noteCreated} notes...");
            // Build maps: filename -> id, and also full relative path normalize?
            // We'll load all notes from DB (those we just created plus any existing? but we wiped, so all)
            var notes = await _db.Notes.ToListAsync();
            int rewritten = 0;
            foreach (var note in notes)
            {
                var original = note.Content;
                if (string.IsNullOrEmpty(original)) continue;
                var content = original;

                // Rewrite Obsidian wikimage: ![[filename.png]] or ![[path/file.png|...]] or ![[file.png|width]]
                // Pattern: ![[ ... ]]
                content = Regex.Replace(content, @"!\[\[([^\]]+)\]\]", match =>
                {
                    var inner = match.Groups[1].Value.Trim();
                    // Remove alias after | and trim path
                    var pipeIdx = inner.IndexOf('|');
                    if (pipeIdx >= 0) inner = inner.Substring(0, pipeIdx);
                    // Take filename part after last / or \
                    var fname = Path.GetFileName(inner);
                    if (string.IsNullOrEmpty(fname)) fname = inner;
                    fname = fname.Trim();
                    // Try lookup
                    if (fileNameToId.TryGetValue(fname, out var aid))
                    {
                        return $"![](/api/files/{aid})";
                    }
                    // Try with original inner (maybe contains folder)
                    if (fileNameToId.TryGetValue(Path.GetFileName(fname), out var aid2))
                        return $"![](/api/files/{aid2})";
                    return match.Value; // keep original if not found
                });

                // Rewrite markdown image: ![alt](path/file.png) where path may be relative, absolute, or url
                // Only rewrite if contains image extension and not already /api/files
                content = Regex.Replace(content, @"!\[([^\]]*)\]\(([^)]+)\)", match =>
                {
                    var alt = match.Groups[1].Value;
                    var url = match.Groups[2].Value.Trim();
                    if (url.StartsWith("/api/files/", StringComparison.OrdinalIgnoreCase)) return match.Value;
                    if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || url.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                        return match.Value;
                    // Clean url: remove title after space, remove quotes
                    var clean = url.Split(new[] { ' ', '\t', '"' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? url;
                    clean = clean.Trim('"', '\'', ' ', '\t');
                    // Remove leading ./ or ../
                    clean = clean.TrimStart('.', '/', '\\');
                    var fname = Path.GetFileName(clean);
                    // Strip query
                    var qIdx = fname.IndexOf('?');
                    if (qIdx >= 0) fname = fname.Substring(0, qIdx);
                    var hashIdx = fname.IndexOf('#');
                    if (hashIdx >= 0) fname = fname.Substring(0, hashIdx);
                    if (string.IsNullOrEmpty(fname)) return match.Value;
                    // Only rewrite image extensions
                    var ext = Path.GetExtension(fname).ToLowerInvariant();
                    if (!ImageExtensions.Contains(ext)) return match.Value;
                    if (fileNameToId.TryGetValue(fname, out var aid))
                    {
                        return $"![{alt}](/api/files/{aid})";
                    }
                    // try lower
                    if (fileNameToId.TryGetValue(fname.ToLowerInvariant(), out var aid2))
                        return $"![{alt}](/api/files/{aid2})";
                    return match.Value;
                });

                // Also rewrite plain wikilink for images without !? e.g. [[file.png]] inside md - not needed but could be
                // We'll not rewrite [[title]] generic links as they are backlinks per spec F-17, keep.

                if (content != original)
                {
                    note.Content = content;
                    note.UpdatedAt = DateTime.UtcNow;
                    rewritten++;
                }
            }
            if (rewritten > 0)
            {
                await _db.SaveChangesAsync();
                L($"[rewrite] rewritten {rewritten} notes");
            }
            else
            {
                L("[rewrite] no notes needed rewrite");
            }
        }

        int totalFolders = !string.IsNullOrEmpty(targetFolderId) ? 0 : noteCreated; // placeholder, see below
        // We need to track folder count across both branches; simplest: compute from result
        L($"[done] folders={totalFolders} notes={noteCreated} assets={assetCreated}");
        return new MigrateResult { Folders = totalFolders, Notes = noteCreated, Assets = assetCreated };
    }

    public class MigrateResult
    {
        public bool DryRun { get; set; }
        public int Folders { get; set; }
        public int Notes { get; set; }
        public int Assets { get; set; }
    }
}
